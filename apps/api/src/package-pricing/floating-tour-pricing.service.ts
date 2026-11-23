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
  type FloatingTourFlightInput,
  type FloatingTourImportPreview,
  type FloatingTourSaleRow,
  type FloatingTourSaleSet,
  type FloatingTourWebsiteCandidate,
  type TourPackageInputV1,
} from '@nora/contracts';
import { DatabaseService } from '../database/database.service';
import { MasterTravelDirectory } from '../master-data/master-travel-directory';
import { PackageTourPricingService } from './package-tour-pricing.service';
import { buildFloatingTourTemplate } from './floating-tour-template';
import {
  parseFloatingRows,
  readFloatingWorkbook,
  resolveFloatingHotelCells,
  type FloatingHotelReference,
} from './floating-tour-import';
import { floatingWebsitePeriods } from './floating-tour-publication';
import {
  changeFloatingPeriod,
  readFloatingPeriodChange,
} from './floating-period-change';

const flightClock = Joi.string().pattern(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const airport = Joi.object({
  id: Joi.string().guid().required(),
  cityId: Joi.string().guid().required(),
  countryId: Joi.string().guid().required(),
  code: Joi.string()
    .pattern(/^[A-Z]{3}$/)
    .required(),
  name: Joi.string().trim().max(200).required(),
});
const flightLeg = Joi.object({
  departureClock: flightClock.required(),
  arrivalClock: flightClock.required(),
  carrierName: Joi.string().trim().max(160).required(),
  serviceNumber: Joi.string().trim().max(80).required(),
  cabinClassCode: Joi.string().valid('ECONOMY', 'BUSINESS', 'FIRST').required(),
  originAirport: airport.required(),
  destinationAirport: airport.required(),
});
const optionsSchema = Joi.object({
  hotelSelections: Joi.object()
    .pattern(/^\d{1,5}:\d{1,2}$/, Joi.string().guid().required())
    .max(10000),
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
  flightPattern: Joi.object({
    outbound: flightLeg.required(),
    inbound: flightLeg.required(),
  }).when('mode', { is: 'MONTHLY', then: Joi.forbidden() }),
  destinationNights: Joi.array()
    .items(Joi.number().integer().min(1).max(365))
    .min(2)
    .max(10)
    .when('combined', { is: true, otherwise: Joi.forbidden() }),
});

function applyFlightSchedule(
  rows: FloatingTourSaleRow[],
  options: FloatingTourImportOptions,
  current: FloatingTourSaleSet,
) {
  const pattern = options.flightPattern;
  const toLeg = (day: string, flight: FloatingTourFlightInput) => {
    const { departureClock, arrivalClock, ...details } = flight;
    const arrivalDay =
      arrivalClock <= departureClock
        ? new Date(Date.parse(day) + 86400000).toISOString().slice(0, 10)
        : day;
    return {
      ...details,
      departureAt: new Date(
        day + 'T' + departureClock + ':00+03:30',
      ).toISOString(),
      arrivalAt: new Date(
        arrivalDay + 'T' + arrivalClock + ':00+03:30',
      ).toISOString(),
    };
  };
  const errors: string[] = [];
  for (const row of rows) {
    if (pattern && row.startsOn && row.endsOn) {
      const outbound = toLeg(row.startsOn, pattern.outbound);
      const inbound = toLeg(row.endsOn, pattern.inbound);
      if (
        outbound.arrivalAt >= inbound.departureAt ||
        outbound.originAirport.id === outbound.destinationAirport.id ||
        inbound.originAirport.id === inbound.destinationAirport.id
      ) {
        errors.push(
          `Row ${row.sourceRows.join(', ')}: مسیر و ساعت پروازها را بررسی کنید؛ حرکت برگشت باید بعد از رسیدن پرواز رفت باشد.`,
        );
        continue;
      }
      row.flightSchedule = {
        startsOn: row.startsOn,
        endsOn: row.endsOn,
        outbound,
        inbound,
      };
    } else {
      const saved = current.dated.find(
        (previous) =>
          previous.startsOn === row.startsOn && previous.nights === row.nights,
      )?.flightSchedule;
      if (saved) row.flightSchedule = saved;
    }
  }
  if (errors.length) throw new BadRequestException(errors.join('\n'));
}

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
  async websiteCandidates(
    actor: AuthenticatedActor,
  ): Promise<{ data: FloatingTourWebsiteCandidate[] }> {
    if (!actor.permissions.includes('ticket_catalog.manage'))
      throw new ForbiddenException();
    const rows = await this.db.client.tourPackage.findMany({
      where: {
        branchId: { in: actor.branchIds },
        definition: { path: ['details', 'isFloating'], equals: true },
      },
      include: { floatingSaleCatalog: true },
      orderBy: { createdAt: 'desc' },
      take: 501,
    });
    if (rows.length > 500)
      throw new BadRequestException(
        'برای کاتالوگ بزرگ‌تر صفحه‌بندی تنظیم شود.',
      );
    return {
      data: rows.map((row) => {
        const prices = row.floatingSaleCatalog?.payload as unknown as
          FloatingTourSaleSet | undefined;
        const definition = row.definition as unknown as TourPackageInputV1;
        return {
          id: row.id,
          branchId: row.branchId,
          name: definition.name,
          destinationId: definition.destinationId,
          destinationIds: [
            ...new Set([
              definition.destinationId,
              ...(definition.details?.destinations?.map(
                (stay) => stay.cityId,
              ) ?? []),
            ]),
          ],
          canPublish: !!(prices?.dated.length || prices?.monthly?.rows.length),
          periods: floatingWebsitePeriods(prices),
        };
      }),
    };
  }
  /** Public sales projection: no workbook row numbers, commissions or inventory promises. */
  async websiteProduct(
    id: string,
    branchIds: string[],
    periodKey: string,
    requirePrices = true,
  ) {
    const { row, definition } = await this.definition(id, {
      branchIds,
    } as AuthenticatedActor);
    const catalog = await this.db.client.floatingTourSaleCatalog.findUnique({
      where: { packageId: id },
    });
    const prices = catalog?.payload as unknown as
      FloatingTourSaleSet | undefined;
    const period = floatingWebsitePeriods(prices).find(
      (item) => item.key === periodKey,
    );
    if (requirePrices && !period)
      throw new BadRequestException('قیمت منتشرشده پکیج الزامی است.');
    const project = (price: FloatingTourSaleRow) => ({
      startsOn: price.startsOn,
      endsOn: price.endsOn,
      nights: price.nights,
      stays: price.stays,
      prices: price.prices,
      ...(price.flightSchedule ? { flightSchedule: price.flightSchedule } : {}),
    });
    return {
      package: {
        ...definition,
        id: row.id,
        branchId: row.branchId,
        version: row.version,
      },
      version: catalog?.version ?? 0,
      periodKey,
      dated:
        period && !period.monthly
          ? (prices?.dated ?? [])
              .filter(
                (price) =>
                  !price.salesStopped &&
                  price.startsOn === period.startsOn &&
                  price.nights === period.nights,
              )
              .map(project)
          : [],
      monthly:
        prices?.monthly && period?.monthly
          ? {
              calendar: prices.monthly.calendar,
              months: prices.monthly.months,
              rows: prices.monthly.rows
                .filter(
                  (price) =>
                    !price.salesStopped && price.nights === period.nights,
                )
                .map(project),
            }
          : null,
    };
  }
  async list(actor: AuthenticatedActor) {
    this.authorize(actor);
    const rows = await this.db.client.tourPackage.findMany({
      where: { branchId: { in: actor.branchIds } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    const definitions = rows.flatMap((row) => {
      const definition = row.definition as unknown as TourPackageInputV1;
      return definition.details?.isFloating ? [{ row, definition }] : [];
    });
    const routeIds = (tour: TourPackageInputV1) => [
      tour.originId,
      ...(tour.details?.isCombined && tour.details.destinations?.length
        ? tour.details.destinations.map((stay) => stay.cityId)
        : [tour.destinationId]),
    ];
    const cityIds = [
      ...new Set(
        definitions
          .flatMap(({ definition }) => routeIds(definition))
          .filter(Boolean),
      ),
    ];
    const cities = await Promise.all(
      cityIds.map(async (id) => {
        try {
          return await this.directory.hotelRatePeriodCityNames([id]);
        } catch (error) {
          if (error instanceof NotFoundException) return [];
          throw error;
        }
      }),
    );
    const cityNames = new Map(
      cities.flat().map((city) => [city.id, city.name]),
    );
    return {
      data: definitions.map(({ row, definition }) => ({
        ...definition,
        id: row.id,
        branchId: row.branchId,
        version: row.version,
        createdAt: row.createdAt.toISOString(),
        routeNames: routeIds(definition).map((id) => cityNames.get(id) ?? ''),
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
  async changePeriod(
    id: string,
    raw: unknown,
    actor: AuthenticatedActor,
  ): Promise<FloatingTourSaleSet> {
    this.authorize(actor, true);
    const command = readFloatingPeriodChange(raw);
    const { row } = await this.definition(id, actor);
    return this.db.client.$transaction(async (tx) => {
      const locked = await tx.tourPackage.updateMany({
        where: { id, branchId: row.branchId, version: row.version },
        data: { version: row.version },
      });
      if (locked.count !== 1)
        throw new ConflictException('نسخه تور تغییر کرده است.');
      const existing = await tx.floatingTourSaleCatalog.findUnique({
        where: { packageId: id },
      });
      if (!existing || existing.version !== command.expectedVersion)
        throw new ConflictException('نسخه قیمت تغییر کرده است.');
      const current = {
        ...(existing.payload as unknown as FloatingTourSaleSet),
        version: existing.version,
      };
      const payload = changeFloatingPeriod(current, command);
      const changed = await tx.floatingTourSaleCatalog.updateMany({
        where: { packageId: id, version: command.expectedVersion },
        data: {
          version: payload.version,
          payload: payload as unknown as Prisma.InputJsonValue,
        },
      });
      if (changed.count !== 1)
        throw new ConflictException('نسخه قیمت تغییر کرده است.');
      await tx.floatingTourSaleImport.create({
        data: {
          packageId: id,
          version: payload.version,
          actorUserId: actor.userId,
          digest: createHash('sha256')
            .update(JSON.stringify(command))
            .digest('hex'),
          payload: {
            operation: command,
            previous: current,
          } as unknown as Prisma.InputJsonValue,
        },
      });
      return payload;
    });
  }
  async template(
    id: string,
    actor: AuthenticatedActor,
    destinationCount?: string,
  ) {
    this.authorize(actor);
    const { definition } = await this.definition(id, actor);
    const count =
      destinationCount === undefined ? undefined : Number(destinationCount);
    if (
      count !== undefined &&
      (!Number.isInteger(count) || count < 2 || count > 10)
    )
      throw new BadRequestException('تعداد مقصد باید بین ۲ تا ۱۰ باشد.');
    return buildFloatingTourTemplate(definition, count);
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
    if (
      options.destinationNights &&
      options.destinationNights.reduce((sum, n) => sum + n, 0) !==
        options.nights
    )
      throw new BadRequestException(
        'مجموع شب‌های مقصدها باید با تعداد شب بازه برابر باشد.',
      );
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
    if (!cities.length && !options.destinationNights)
      throw new BadRequestException('مسیر تور ترکیبی را تکمیل کنید.');
    const hotels: FloatingHotelReference[] = [];
    if (options.destinationNights) {
      for (let page = 1; page <= 100; page++) {
        const result = await this.directory.floatingHotelReferences(page);
        hotels.push(...result.data.filter((hotel) => hotel.cityId));
        if (page * 100 >= result.meta.total) break;
        if (page === 100)
          throw new BadRequestException('تعداد هتل‌ها از سقف مجاز بیشتر است.');
      }
    }
    for (const cityId of new Set(options.destinationNights ? [] : cities)) {
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
    const workbook = readFloatingWorkbook(bytes);
    const hotelMatches = resolveFloatingHotelCells(
      workbook,
      hotels,
      options.hotelSelections,
    );
    if (hotelMatches.length)
      return {
        hotelMatches,
        exchangeRates: {},
        packageVersion: row.version,
        expectedVersion: current.version,
        digest: '',
        rows: [],
        options,
        warnings: [],
      };
    const rows = parseFloatingRows(
      workbook,
      options,
      definition,
      hotels,
      options.mode === 'DATED' ? current.dated : (current.monthly?.rows ?? []),
    );
    if (options.mode === 'DATED') applyFlightSchedule(rows, options, current);
    const fx = await this.pricing.buyRates();
    const Decimal = Prisma.Decimal.clone({ precision: 50 });
    const equivalent = (r: FloatingTourSaleRow): Prisma.Decimal | null => {
      if (!r.prices.double) return null;
      let total = new Decimal(0);
      for (const m of r.prices.double) {
        const rate = fx[m.currency];
        if (!rate)
          throw new BadRequestException(
            `Row ${r.sourceRows.join(', ')}: نرخ تبدیل ارز ${m.currency} ثبت نشده است.`,
          );
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
      warnings: rows.flatMap((price) =>
        price.stays.flatMap((stay, index) =>
          stay.service
            ? []
            : [
                `Row ${price.sourceRows[index] ?? price.sourceRows[0]}: خدمات اقامت برای «${stay.hotelName}» وارد نشده است.`,
              ],
        ),
      ),
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
      const stoppedDated = new Set(
        (current?.dated ?? [])
          .filter((r) => r.salesStopped)
          .map((r) => `${r.startsOn}/${r.nights}`),
      );
      const sameMonthly =
        current?.monthly?.calendar === preview.options.calendar &&
        JSON.stringify([...(current?.monthly?.months ?? [])].sort()) ===
          JSON.stringify([...(preview.options.months ?? [])].sort());
      const stoppedMonthly = new Set(
        sameMonthly
          ? current?.monthly?.rows
              .filter((r) => r.salesStopped)
              .map((r) => r.nights)
          : [],
      );
      const payload: FloatingTourSaleSet = {
        version: expectedVersion + 1,
        dated:
          preview.options.mode === 'DATED'
            ? [
                ...(current?.dated ?? []).filter(
                  (r) => !touched.has(`${r.startsOn}/${r.nights}`),
                ),
                ...preview.rows.map((r) =>
                  stoppedDated.has(`${r.startsOn}/${r.nights}`)
                    ? { ...r, salesStopped: true }
                    : r,
                ),
              ]
            : (current?.dated ?? []),
        monthly:
          preview.options.mode === 'MONTHLY'
            ? {
                calendar: preview.options.calendar!,
                months: preview.options.months!,
                rows: preview.rows.map((r) =>
                  stoppedMonthly.has(r.nights)
                    ? { ...r, salesStopped: true }
                    : r,
                ),
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
