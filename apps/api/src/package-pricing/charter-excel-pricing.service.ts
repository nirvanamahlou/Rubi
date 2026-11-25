import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type {
  AuthenticatedActor,
  FloatingTourImportOptions,
  FloatingTourImportPreview,
  FloatingTourSaleRow,
  TourDepartureV1,
} from '@nora/contracts';
import { tourStayPeriods } from '@nora/contracts';
import { Prisma } from '@nora/database';
import Joi from 'joi';
import { createHash } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { MasterTravelDirectory } from '../master-data/master-travel-directory';
import {
  charterExcelSales,
  usesCharterTickets,
  type CharterExcelHotel,
  type CharterExcelSale,
} from './charter-excel-pricing';
import {
  parseFloatingRows,
  readFloatingWorkbook,
  resolveFloatingHotelCells,
} from './floating-tour-import';
import { PackagePricingService } from './package-pricing.service';
import { buildFloatingTourTemplate } from './floating-tour-template';

const selectionsSchema = Joi.object()
  .pattern(Joi.string().max(300), Joi.string().guid())
  .max(500)
  .required();
type StoredPrices = { rows: FloatingTourSaleRow[]; sales: CharterExcelSale[] };

@Injectable()
export class CharterExcelPricingService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(PackagePricingService)
    private readonly pricing: PackagePricingService,
    @Inject(MasterTravelDirectory)
    private readonly directory: MasterTravelDirectory,
  ) {}

  private async latest(tourId: string) {
    return this.database.client.packagePricingCharterExcelVersion.findFirst({
      where: { tourDepartureId: tourId },
      orderBy: { version: 'desc' },
    });
  }

  async template(tourId: string, actor: AuthenticatedActor) {
    const { tour } = await this.pricing.tourCostGrid(tourId, actor);
    return buildFloatingTourTemplate(tour.package);
  }

  async read(tourId: string, actor: AuthenticatedActor) {
    const { tour } = await this.pricing.tourCostGrid(tourId, actor);
    const current = await this.latest(tour.id);
    return {
      version: current?.version ?? 0,
      rows:
        current &&
        current.tourVersion === tour.version &&
        usesCharterTickets(tour)
          ? (current.rows as unknown as StoredPrices).rows
          : [],
    };
  }

  async catalog(tour: TourDepartureV1) {
    if (!usesCharterTickets(tour)) return [];
    const publication = await this.latest(tour.id);
    if (!publication || publication.tourVersion !== tour.version) return [];
    return (publication.rows as unknown as StoredPrices).sales.map((sale) => ({
      ...sale,
      publicationId: publication.id,
    }));
  }

  private async prepare(
    id: string,
    bytes: Buffer,
    selections: unknown,
    actor: AuthenticatedActor,
  ): Promise<{
    tour: TourDepartureV1;
    preview: FloatingTourImportPreview;
    sales: CharterExcelSale[];
  }> {
    if (!actor.permissions.includes('package_pricing.period.manage'))
      throw new ForbiddenException();
    const parsed = selectionsSchema.validate(selections, { convert: false });
    if (parsed.error)
      throw new BadRequestException('انتخاب هتل‌های اکسل معتبر نیست.');
    const grid = await this.pricing.tourCostGrid(id, actor);
    const { tour } = grid;
    if (
      tour.isDeleted ||
      tour.isActive === false ||
      tour.package.publicationStatus === 'DRAFT' ||
      !usesCharterTickets(tour) ||
      tour.remainingCapacity < 1
    )
      throw new BadRequestException(
        'نوبت فعال با بلیت چارتر و ظرفیت فروش لازم است.',
      );
    if (grid.purchaseBatches.some((batch) => batch.rows.length > 0))
      throw new BadRequestException('برای این نوبت نرخ خرید هتل ثبت شده است.');
    const periods = tourStayPeriods(tour.package, tour.startsOn, tour.endsOn);
    const hotels: CharterExcelHotel[] = [];
    for (const cityId of new Set(periods.map((stay) => stay.cityId))) {
      for (let page = 1; page <= 100; page++) {
        const result = await this.directory.hotelRatePackChoices(
          'hotels',
          '',
          page,
          cityId,
        );
        hotels.push(
          ...result.data.map((hotel) => ({
            ...hotel,
            cityId,
            roomTypes: ('roomTypes' in hotel && hotel.roomTypes) || [],
          })),
        );
        if (page * result.meta.pageSize >= result.meta.total) break;
        if (page === 100)
          throw new BadRequestException('تعداد هتل‌ها از سقف مجاز بیشتر است.');
      }
    }
    const options: FloatingTourImportOptions = {
      mode: 'DATED',
      nights: grid.nights,
      combined: periods.length > 1,
      ...(periods.length > 1
        ? { destinationNights: periods.map((stay) => stay.nights) }
        : {}),
    };
    const workbook = readFloatingWorkbook(bytes);
    const hotelMatches = resolveFloatingHotelCells(
      workbook,
      hotels,
      parsed.value,
    );
    const current = await this.latest(id);
    const preview: FloatingTourImportPreview = {
      options,
      exchangeRates: {},
      packageVersion: tour.package.version,
      expectedVersion: current?.version ?? 0,
      rows: [],
      warnings: [],
      digest: '',
    };
    if (hotelMatches.length)
      return { tour, preview: { ...preview, hotelMatches }, sales: [] };
    const rows = parseFloatingRows(workbook, options, tour.package, hotels);
    const sales = charterExcelSales(rows, tour, hotels);
    if (sales.length > 1500)
      throw new BadRequestException(
        'تعداد ترکیب‌های قیمت از سقف مجاز بیشتر است.',
      );
    const keys = sales.map((sale) =>
      JSON.stringify([sale.hotelId, sale.roomCode]),
    );
    if (new Set(keys).size !== keys.length)
      throw new BadRequestException('ترکیب اتاق تکراری در فایل مجاز نیست.');
    preview.rows = rows;
    preview.warnings = rows.flatMap((row) =>
      row.stays
        .filter((stay) => !stay.service)
        .map(
          (stay) =>
            `Row ${row.sourceRows.join(', ')}: خدمات «${stay.hotelName}» وارد نشده است.`,
        ),
    );
    preview.digest = createHash('sha256')
      .update(
        JSON.stringify({
          id,
          tourVersion: tour.version,
          ticketVersions: [tour.outbound.version, tour.returning?.version],
          expectedVersion: preview.expectedVersion,
          rows,
          sales,
        }),
      )
      .digest('hex');
    return { tour, preview, sales };
  }

  async preview(
    id: string,
    bytes: Buffer,
    selections: unknown,
    actor: AuthenticatedActor,
  ) {
    return (await this.prepare(id, bytes, selections, actor)).preview;
  }

  async commit(
    id: string,
    bytes: Buffer,
    selections: unknown,
    digest: string,
    actor: AuthenticatedActor,
  ) {
    if (!/^[a-f0-9]{64}$/.test(digest))
      throw new BadRequestException('ابتدا پیش‌نمایش معتبر دریافت کنید.');
    const { tour, preview, sales } = await this.prepare(
      id,
      bytes,
      selections,
      actor,
    );
    if (preview.digest !== digest)
      throw new ConflictException(
        'اطلاعات تغییر کرده است؛ پیش‌نمایش را دوباره دریافت کنید.',
      );
    return this.database.client.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${'charter-excel:' + id}, 0))`,
      );
      const current = await tx.packagePricingCharterExcelVersion.findFirst({
        where: { tourDepartureId: id },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      if ((current?.version ?? 0) !== preview.expectedVersion)
        throw new ConflictException(
          'اطلاعات تغییر کرده است؛ پیش‌نمایش را دوباره دریافت کنید.',
        );
      const version = preview.expectedVersion + 1;
      await tx.packagePricingCharterExcelVersion.create({
        data: {
          tourDepartureId: id,
          tourVersion: tour.version,
          version,
          digest,
          rows: {
            rows: preview.rows,
            sales,
          } as unknown as Prisma.InputJsonObject,
          publishedByUserId: actor.userId,
        },
      });
      return { version, rows: preview.rows };
    });
  }
}
