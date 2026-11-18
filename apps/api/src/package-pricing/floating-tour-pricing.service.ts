import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import * as Joi from 'joi';
import { Prisma } from '@nora/database';
import {
  type AuthenticatedActor,
  type FloatingTourImportOptions,
  type FloatingTourImportPreview,
  type FloatingTourSaleRow,
  type FloatingTourSaleSet,
  type TourPackageInputV1,
} from '@nora/contracts';
import { DatabaseService } from '../database/database.service';
import { MasterTravelDirectory } from '../master-data/master-travel-directory';
import { PackageTourPricingService } from './package-tour-pricing.service';
import { buildFloatingTourTemplate } from './floating-tour-template';
import {
  parseFloatingRows,
  readFloatingWorkbook,
  type FloatingHotelReference,
} from './floating-tour-import';

const optionsSchema = Joi.object({
  nights: Joi.number().integer().min(1).max(365).required(),
  mode: Joi.string().valid('DATED', 'MONTHLY').required(),
  calendar: Joi.string()
    .valid('PERSIAN', 'GREGORIAN')
    .when('mode', { is: 'MONTHLY', then: Joi.required() }),
  months: Joi.array()
    .items(Joi.number().integer().min(1).max(12))
    .unique()
    .max(12)
    .when('mode', { is: 'MONTHLY', then: Joi.array().min(1).required() }),
  combined: Joi.boolean(),
});
@Injectable()
export class FloatingTourPricingService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(MasterTravelDirectory)
    private readonly directory: MasterTravelDirectory,
    @Inject(PackageTourPricingService)
    private readonly pricing: PackageTourPricingService,
  ) {}
  private authorize(actor: AuthenticatedActor, manage = false) {
    if (
      !actor.permissions.includes(
        manage ? 'package_pricing.period.manage' : 'package_pricing.read',
      )
    )
      throw new ForbiddenException('مجوز کافی برای مدیریت قیمت پکیج ندارید.');
  }
  private async definition(id: string, actor: AuthenticatedActor) {
    const row = await this.db.client.tourPackage.findFirst({
      where: { id, branchId: { in: actor.branchIds } },
    });
    if (!row) throw new NotFoundException('تور در شعبه مجاز یافت نشد.');
    const definition = row.definition as unknown as TourPackageInputV1;
    if (!definition.details?.isFloating)
      throw new BadRequestException('این تور شناور نیست.');
    return { row, definition };
  }
  async list(actor: AuthenticatedActor) {
    this.authorize(actor);
    const rows = await this.db.client.tourPackage.findMany({
      where: { branchId: { in: actor.branchIds } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return {
      data: rows
        .filter(
          (r) =>
            (r.definition as unknown as TourPackageInputV1).details?.isFloating,
        )
        .map((r) => ({
          id: r.id,
          branchId: r.branchId,
          version: r.version,
          ...(r.definition as unknown as TourPackageInputV1),
        })),
    };
  }
  async get(
    id: string,
    actor: AuthenticatedActor,
  ): Promise<FloatingTourSaleSet> {
    this.authorize(actor);
    await this.definition(id, actor);
    const row = await this.db.client.floatingTourSaleCatalog.findUnique({
      where: { packageId: id },
    });
    return row
      ? {
          ...(row.payload as unknown as FloatingTourSaleSet),
          version: row.version,
        }
      : { version: 0, dated: [], monthly: null };
  }
  async template(id: string, actor: AuthenticatedActor) {
    this.authorize(actor);
    const { definition } = await this.definition(id, actor);
    return buildFloatingTourTemplate(definition);
  }
  async preview(
    id: string,
    bytes: Uint8Array,
    raw: unknown,
    actor: AuthenticatedActor,
  ): Promise<FloatingTourImportPreview> {
    this.authorize(actor, true);
    const parsed = optionsSchema.validate(raw, { convert: false });
    if (parsed.error)
      throw new BadRequestException('تعداد شب و تنظیمات بازه را بررسی کنید.');
    const options = parsed.value as FloatingTourImportOptions;
    const { row, definition } = await this.definition(id, actor);
    if (!definition.originId || !definition.destinationId)
      throw new BadRequestException('مسیر تور را تکمیل کنید.');
    if (definition.details?.isCombined && !options.combined)
      throw new BadRequestException(
        'برای تور ترکیبی، قیمت مشترک اقامت‌ها را انتخاب کنید.',
      );
    const current = await this.get(id, actor);
    const cities = options.combined
      ? (definition.details?.destinations?.map((s) => s.cityId) ?? [])
      : [definition.destinationId];
    if (!cities.length)
      throw new BadRequestException('مسیر تور ترکیبی را تکمیل کنید.');
    const hotels: FloatingHotelReference[] = [];
    for (const cityId of new Set(cities)) {
      for (let page = 1; page <= 100; page++) {
        const result = await this.directory.hotelRatePackChoices(
          'hotels',
          '',
          page,
          cityId,
        );
        hotels.push(
          ...result.data.map((h) => ({
            id: h.id,
            name: h.name,
            englishName: h.englishName,
            cityId,
          })),
        );
        if (page * 100 >= result.meta.total) break;
        if (page === 100)
          throw new BadRequestException('تعداد هتل‌ها از سقف مجاز بیشتر است.');
      }
    }
    const rows = parseFloatingRows(
      readFloatingWorkbook(bytes),
      options,
      definition,
      hotels,
      options.mode === 'DATED' ? current.dated : (current.monthly?.rows ?? []),
    );
    const fx = await this.pricing.buyRates();
    const Decimal = Prisma.Decimal.clone({ precision: 50 });
    const equivalent = (r: FloatingTourSaleRow): Prisma.Decimal | null => {
      if (!r.prices.double) return null;
      let total = new Decimal(0);
      for (const m of r.prices.double) {
        const rate = fx[m.currency];
        if (!rate)
          throw new BadRequestException(`Missing exchange rate: ${m.currency}`);
        total = total.plus(new Decimal(m.amount).mul(rate));
      }
      return total;
    };
    const values = new Map(rows.map((r) => [r, equivalent(r)]));
    rows.sort((a, b) => {
      const av = values.get(a)!,
        bv = values.get(b)!;
      if (av === null && bv !== null) return 1;
      if (bv === null && av !== null) return -1;
      if (av !== null && bv !== null && !av.eq(bv)) return av.comparedTo(bv);
      return a.stays
        .map((s) => s.hotelName)
        .join(' / ')
        .localeCompare(b.stays.map((s) => s.hotelName).join(' / '), 'en');
    });
    const digest = createHash('sha256')
      .update(
        JSON.stringify({
          packageVersion: row.version,
          expectedVersion: current.version,
          options,
          rows,
          fx,
        }),
      )
      .digest('hex');
    return {
      exchangeRates: fx,
      packageVersion: row.version,
      expectedVersion: current.version,
      digest,
      rows,
      options,
      warnings: [],
    };
  }
  async commit(
    id: string,
    bytes: Uint8Array,
    raw: unknown,
    expectedVersion: number,
    digest: string,
    actor: AuthenticatedActor,
  ) {
    if (
      !Number.isSafeInteger(expectedVersion) ||
      expectedVersion < 0 ||
      !/^[a-f0-9]{64}$/.test(digest)
    )
      throw new BadRequestException('ابتدا پیش‌نمایش معتبر دریافت کنید.');
    const preview = await this.preview(id, bytes, raw, actor);
    if (
      preview.expectedVersion !== expectedVersion ||
      preview.digest !== digest
    )
      throw new ConflictException(
        'اطلاعات هم‌زمان تغییر کرده است؛ پیش‌نمایش را دوباره دریافت کنید.',
      );
    const { row } = await this.definition(id, actor);
    return this.db.client.$transaction(async (tx) => {
      // Definition lock fences a simultaneous edit or branch change while validating imports.
      const locked = await tx.tourPackage.updateMany({
        where: { id, branchId: row.branchId, version: preview.packageVersion },
        data: { version: preview.packageVersion },
      });
      if (locked.count !== 1)
        throw new ConflictException('نسخه تور تغییر کرده است.');
      const existing = await tx.floatingTourSaleCatalog.findUnique({
        where: { packageId: id },
      });
      if ((existing?.version ?? 0) !== expectedVersion)
        throw new ConflictException('نسخه قیمت تغییر کرده است.');
      const current = existing?.payload as unknown as
        FloatingTourSaleSet | undefined;
      const touched = new Set(
        preview.rows.map((r) => `${r.startsOn}/${r.nights}`),
      );
      const payload: FloatingTourSaleSet = {
        version: expectedVersion + 1,
        dated:
          preview.options.mode === 'DATED'
            ? [
                ...(current?.dated ?? []).filter(
                  (r) => !touched.has(`${r.startsOn}/${r.nights}`),
                ),
                ...preview.rows,
              ]
            : (current?.dated ?? []),
        monthly:
          preview.options.mode === 'MONTHLY'
            ? {
                calendar: preview.options.calendar!,
                months: preview.options.months!,
                rows: preview.rows,
              }
            : (current?.monthly ?? null),
      };
      if (existing) {
        const changed = await tx.floatingTourSaleCatalog.updateMany({
          where: { packageId: id, version: expectedVersion },
          data: {
            version: expectedVersion + 1,
            payload: payload as unknown as Prisma.InputJsonValue,
          },
        });
        if (changed.count !== 1)
          throw new ConflictException('نسخه قیمت تغییر کرده است.');
      } else
        await tx.floatingTourSaleCatalog.create({
          data: {
            packageId: id,
            branchId: row.branchId,
            version: 1,
            payload: payload as unknown as Prisma.InputJsonValue,
          },
        });
      await tx.floatingTourSaleImport.create({
        data: {
          packageId: id,
          version: payload.version,
          actorUserId: actor.userId,
          digest,
          payload: preview as unknown as Prisma.InputJsonValue,
        },
      });
      return payload;
    });
  }
}
