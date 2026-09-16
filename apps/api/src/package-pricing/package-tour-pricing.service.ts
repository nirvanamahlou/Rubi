import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type {
  AuthenticatedActor,
  PackageTourDraftAdjustmentV1,
  PackageTourDraftSaveV1,
  PackageTourDraftV1,
  PackageTourPublicationV1,
  PackageTourPublishV1,
} from '@nora/contracts';
import { Prisma } from '@nora/database';
import { DatabaseService } from '../database/database.service';
import { PackagePricingService } from './package-pricing.service';

const roomCodes = [
  'double',
  'single',
  'triple',
  'doubleChild',
  'doubleTwoChildren',
  'family',
] as const;
const occupancy: Record<string, { adults: number; children: number } | null> = {
  single: { adults: 1, children: 0 },
  double: { adults: 2, children: 0 },
  triple: { adults: 3, children: 0 },
  doubleChild: { adults: 2, children: 1 },
  doubleTwoChildren: { adults: 2, children: 2 },
  family: null,
};
const amount = (value: string, scale: number) => {
  if (
    typeof value !== 'string' ||
    !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value) ||
    (value.split('.')[1]?.length ?? 0) > scale
  )
    throw new BadRequestException('مبلغ یا درصد با دقت نامعتبر وارد شده است.');
  return new Prisma.Decimal(value);
};
const sourceHash = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
const dateSpan = (start: string, end: string) =>
  (Date.parse(end + 'T00:00:00.000Z') - Date.parse(start + 'T00:00:00.000Z')) /
  86_400_000;

@Injectable()
export class PackageTourPricingService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(PackagePricingService)
    private readonly pricing: PackagePricingService,
  ) {}

  async get(
    tourId: string,
    batchId: string,
    actor: AuthenticatedActor,
  ): Promise<PackageTourDraftV1 | null> {
    const grid = await this.pricing.tourCostGrid(tourId, actor);
    const draft = await this.database.client.packagePricingTourDraft.findFirst({
      where: { tourDepartureId: tourId, batchId, branchId: grid.tour.branchId },
      include: { adjustments: { orderBy: { hotelRateId: 'asc' } } },
    });
    return draft ? this.toDraft(draft) : null;
  }

  async save(
    input: PackageTourDraftSaveV1,
    actor: AuthenticatedActor,
  ): Promise<PackageTourDraftV1> {
    const adultCurrency =
      input.adultFlightSaleCurrencyCode ?? input.currencyCode;
    const childCurrency =
      input.childFlightSaleCurrencyCode ?? input.currencyCode;
    const businessCurrency =
      input.businessUpliftCurrencyCode ?? input.currencyCode;
    if (
      input?.version !== 1 ||
      !Number.isSafeInteger(input.expectedVersion) ||
      input.expectedVersion < 0 ||
      !/^[A-Z]{3}$/.test(input.currencyCode ?? '') ||
      !/^[A-Z]{3}$/.test(adultCurrency) ||
      !/^[A-Z]{3}$/.test(childCurrency) ||
      !/^[A-Z]{3}$/.test(businessCurrency)
    )
      throw new BadRequestException('پیش‌نویس قیمت معتبر نیست.');
    const grid = await this.pricing.tourCostGrid(input.tourDepartureId, actor);
    const batch = grid.purchaseBatches.find(
      (item) => item.id === input.batchId,
    );
    if (!batch || input.currencyCode !== batch.currencyCode)
      throw new BadRequestException('بازه خرید و ارز همان نوبت تور لازم است.');
    const scale = input.currencyCode === 'IRR' ? 0 : 2;
    const adult = amount(input.adultFlightSale, scale);
    const child = amount(input.childFlightSale, scale);
    const business = amount(input.businessUplift, scale);
    const commission = amount(input.commissionPercent, 2);
    if (commission.gt(100))
      throw new BadRequestException('کمیسیون نمی‌تواند بیش از ۱۰۰ درصد باشد.');
    if (!Array.isArray(input.adjustments) || input.adjustments.length > 500)
      throw new BadRequestException('ردیف‌های تغییر قیمت معتبر نیستند.');
    const rowIds = new Set(batch.rows.map((row) => row.id));
    const seen = new Set<string>();
    const adjustments = input.adjustments.map((item) => {
      if (
        !rowIds.has(item.hotelRateId) ||
        seen.has(item.hotelRateId) ||
        !['increase', 'decrease'].includes(item.direction) ||
        !['percent', 'fixed'].includes(item.mode)
      )
        throw new BadRequestException(
          'تغییر قیمت باید متعلق به یک ردیف همین بازه باشد.',
        );
      seen.add(item.hotelRateId);
      const value = amount(item.value, item.mode === 'fixed' ? scale : 2);
      if (item.mode === 'percent' && value.gt(100))
        throw new BadRequestException('درصد تغییر قیمت بیش از ۱۰۰ مجاز نیست.');
      return {
        hotelRateId: item.hotelRateId,
        direction: item.direction,
        mode: item.mode,
        value,
      };
    });
    return this.database.client.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${input.tourDepartureId + ':' + input.batchId}, 0))`,
      );
      const existing = await tx.packagePricingTourDraft.findUnique({
        where: {
          tourDepartureId_batchId: {
            tourDepartureId: input.tourDepartureId,
            batchId: input.batchId,
          },
        },
      });
      if ((existing?.version ?? 0) !== input.expectedVersion)
        throw new ConflictException(
          'پیش‌نویس هم‌زمان تغییر کرده است؛ دوباره بارگذاری کنید.',
        );
      const now = new Date();
      const draft = existing
        ? await tx.packagePricingTourDraft.update({
            where: { id: existing.id },
            data: {
              version: { increment: 1 },
              currencyCode: input.currencyCode,
              adultFlightSale: adult,
              adultFlightSaleCurrencyCode: adultCurrency,
              childFlightSale: child,
              childFlightSaleCurrencyCode: childCurrency,
              businessUplift: business,
              businessUpliftCurrencyCode: businessCurrency,
              commissionPercent: commission,
              updatedByUserId: actor.userId,
              updatedAt: now,
            },
          })
        : await tx.packagePricingTourDraft.create({
            data: {
              id: randomUUID(),
              tourDepartureId: input.tourDepartureId,
              batchId: input.batchId,
              branchId: grid.tour.branchId,
              currencyCode: input.currencyCode,
              adultFlightSale: adult,
              adultFlightSaleCurrencyCode: adultCurrency,
              childFlightSale: child,
              childFlightSaleCurrencyCode: childCurrency,
              businessUplift: business,
              businessUpliftCurrencyCode: businessCurrency,
              commissionPercent: commission,
              createdByUserId: actor.userId,
              updatedByUserId: actor.userId,
              updatedAt: now,
            },
          });
      if (existing)
        await tx.packagePricingTourAdjustment.deleteMany({
          where: { draftId: draft.id },
        });
      if (adjustments.length)
        await tx.packagePricingTourAdjustment.createMany({
          data: adjustments.map((item) => ({
            id: randomUUID(),
            draftId: draft.id,
            ...item,
          })),
        });
      const saved = await tx.packagePricingTourDraft.findUniqueOrThrow({
        where: { id: draft.id },
        include: { adjustments: { orderBy: { hotelRateId: 'asc' } } },
      });
      return this.toDraft(saved);
    });
  }

  async publish(
    draftId: string,
    input: PackageTourPublishV1,
    actor: AuthenticatedActor,
  ): Promise<PackageTourPublicationV1> {
    if (
      input?.version !== 1 ||
      !Number.isSafeInteger(input.expectedDraftVersion) ||
      input.expectedDraftVersion < 1 ||
      !input.reason?.trim() ||
      input.reason.trim().length > 500
    )
      throw new BadRequestException(
        'دلیل و نسخه پیش‌نویس برای انتشار لازم است.',
      );
    const draft = await this.database.client.packagePricingTourDraft.findFirst({
      where: { id: draftId, branchId: { in: actor.branchIds } },
      include: { adjustments: true },
    });
    if (!draft) throw new NotFoundException('پیش‌نویس تور یافت نشد.');
    if (draft.version !== input.expectedDraftVersion)
      throw new ConflictException('نسخه پیش‌نویس قیمت تغییر کرده است.');
    if (draft.updatedByUserId === actor.userId)
      throw new ForbiddenException(
        'تأییدکننده انتشار باید غیر از آخرین ویرایشگر قیمت باشد.',
      );
    const grid = await this.pricing.tourCostGrid(draft.tourDepartureId, actor);
    const batch = grid.purchaseBatches.find(
      (item) => item.id === draft.batchId,
    );
    if (
      !batch ||
      batch.currencyCode !== draft.currencyCode ||
      dateSpan(grid.tour.startsOn, grid.tour.endsOn) !== grid.nights
    )
      throw new UnprocessableEntityException(
        'بازه خرید هتل یا ارز آن دیگر معتبر نیست.',
      );
    const hotelIds = new Set(batch.rows.map((row) => row.hotelId));
    const rateIds = new Set(batch.rows.map((row) => row.id));
    if (draft.adjustments.some((item) => !rateIds.has(item.hotelRateId)))
      throw new UnprocessableEntityException(
        'ردیف قیمت خرید هتلِ پیش‌نویس دیگر در این بازه نیست.',
      );
    if (grid.tour.package.hotelIds.some((id) => !hotelIds.has(id)))
      throw new UnprocessableEntityException(
        'برای تمام هتل‌های انتخاب‌شده نرخ خرید این بازه لازم است.',
      );
    if (grid.missingFlightOfferIds.length || grid.tour.remainingCapacity < 1)
      throw new UnprocessableEntityException(
        'نرخ پرداخت‌شده همه پروازها و ظرفیت تور لازم است.',
      );
    const outbound = grid.flightPurchaseCosts.find(
      (cost) => cost.offerId === grid.tour.outboundOfferId,
    );
    const returning = grid.tour.returnOfferId
      ? grid.flightPurchaseCosts.find(
          (cost) => cost.offerId === grid.tour.returnOfferId,
        )
      : undefined;
    if (
      !outbound ||
      (grid.tour.returnOfferId && !returning) ||
      grid.flightPurchaseCosts.some(
        (cost) => cost.currencyCode !== draft.currencyCode,
      )
    )
      throw new UnprocessableEntityException(
        'ارز خرید پرواز با پکیج برابر نیست یا پرداخت کامل نشده است.',
      );
    const scale = draft.currencyCode === 'IRR' ? 0 : 2;
    const adultPurchase = new Prisma.Decimal(outbound.adultUnitCost).add(
      returning?.adultUnitCost ?? '0',
    );
    const childPurchase = new Prisma.Decimal(outbound.childUnitCost).add(
      returning?.childUnitCost ?? '0',
    );
    const businessCabin =
      grid.tour.outbound.cabinClassCode === 'BUSINESS' ||
      grid.tour.returning?.cabinClassCode === 'BUSINESS';
    const byRow = new Map(
      draft.adjustments.map((item) => [item.hotelRateId, item]),
    );
    const prices = batch.rows.flatMap((row) =>
      roomCodes.map((roomCode) => {
        const factor = row.factors[roomCode];
        if (typeof factor !== 'string' || !/^\d+(?:\.\d{1,3})?$/.test(factor))
          throw new UnprocessableEntityException(
            'ضریب اتاق هتل در منبع خرید ناقص است.',
          );
        const perNight = new Prisma.Decimal(row.basePerNight)
          .mul(factor)
          .toDecimalPlaces(scale, Prisma.Decimal.ROUND_HALF_UP);
        const hotelPurchase = perNight.mul(grid.nights);
        const adjustment = byRow.get(row.id);
        const delta = adjustment
          ? adjustment.mode === 'percent'
            ? hotelPurchase
                .mul(adjustment.value)
                .div(100)
                .toDecimalPlaces(scale, Prisma.Decimal.ROUND_HALF_UP)
            : adjustment.value
          : new Prisma.Decimal(0);
        const hotelSale =
          adjustment?.direction === 'decrease'
            ? hotelPurchase.sub(delta)
            : hotelPurchase.add(delta);
        if (hotelSale.lt(0))
          throw new UnprocessableEntityException(
            'کاهش قیمت از هزینه خرید یک اتاق بیشتر است.',
          );
        const passengers = occupancy[roomCode];
        const packagePurchase = passengers
          ? hotelPurchase
              .add(adultPurchase.mul(passengers.adults))
              .add(childPurchase.mul(passengers.children))
          : null;
        const packageSale = passengers
          ? hotelSale
              .add(draft.adultFlightSale.mul(passengers.adults))
              .add(draft.childFlightSale.mul(passengers.children))
              .add(
                businessCabin ? draft.businessUplift.mul(passengers.adults) : 0,
              )
          : null;
        const commissionAmount = packageSale
          ? packageSale
              .mul(draft.commissionPercent)
              .div(100)
              .toDecimalPlaces(scale, Prisma.Decimal.ROUND_HALF_UP)
          : null;
        const netProfit =
          packageSale && packagePurchase && commissionAmount
            ? packageSale.sub(packagePurchase).sub(commissionAmount)
            : null;
        return {
          hotelRateId: row.id,
          roomCode,
          hotelPurchase,
          hotelSale,
          packagePurchase,
          packageSale,
          commissionAmount,
          netProfit,
          currencyCode: draft.currencyCode,
        };
      }),
    );
    const fingerprint = sourceHash({
      tour: grid.tour,
      batch,
      costs: grid.flightPurchaseCosts,
      draftVersion: draft.version,
      adjustments: draft.adjustments,
      prices: prices.map((item) => ({
        ...item,
        hotelPurchase: item.hotelPurchase.toString(),
        hotelSale: item.hotelSale.toString(),
      })),
    });
    return this.database.client.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${draftId}, 0))`,
      );
      const current = await tx.packagePricingTourDraft.findUnique({
        where: { id: draftId },
      });
      if (current?.version !== draft.version)
        throw new ConflictException('پیش‌نویس هنگام انتشار تغییر کرده است.');
      const latest = await tx.packagePricingTourPublishedVersion.findFirst({
        where: { draftId },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      const published = await tx.packagePricingTourPublishedVersion.create({
        data: {
          id: randomUUID(),
          draftId,
          version: (latest?.version ?? 0) + 1,
          draftVersion: draft.version,
          tourVersion: grid.tour.version,
          sourceFingerprint: fingerprint,
          reason: input.reason.trim(),
          outboundCostRevisionId: outbound.costRevisionId,
          returnCostRevisionId: returning?.costRevisionId ?? null,
          adultFlightSale: draft.adultFlightSale,
          adultFlightSaleCurrencyCode: draft.adultFlightSaleCurrencyCode,
          childFlightSale: draft.childFlightSale,
          childFlightSaleCurrencyCode: draft.childFlightSaleCurrencyCode,
          businessUplift: draft.businessUplift,
          businessUpliftCurrencyCode: draft.businessUpliftCurrencyCode,
          commissionPercent: draft.commissionPercent,
          currencyCode: draft.currencyCode,
          publishedByUserId: actor.userId,
          roomPrices: {
            create: prices.map((item) => ({ id: randomUUID(), ...item })),
          },
        },
        include: {
          roomPrices: {
            orderBy: [{ hotelRateId: 'asc' }, { roomCode: 'asc' }],
          },
        },
      });
      return this.toPublication(published);
    });
  }

  async publications(
    tourId: string,
    batchId: string,
    actor: AuthenticatedActor,
  ): Promise<readonly PackageTourPublicationV1[]> {
    const grid = await this.pricing.tourCostGrid(tourId, actor);
    const draft = await this.database.client.packagePricingTourDraft.findFirst({
      where: { tourDepartureId: tourId, batchId, branchId: grid.tour.branchId },
    });
    if (!draft) return [];
    const rows =
      await this.database.client.packagePricingTourPublishedVersion.findMany({
        where: { draftId: draft.id },
        orderBy: { version: 'desc' },
        include: {
          roomPrices: {
            orderBy: [{ hotelRateId: 'asc' }, { roomCode: 'asc' }],
          },
        },
      });
    return rows.map((row) => this.toPublication(row));
  }

  private toDraft(
    row: Prisma.PackagePricingTourDraftGetPayload<{
      include: { adjustments: true };
    }>,
  ): PackageTourDraftV1 {
    return {
      version: 1,
      expectedVersion: row.version,
      id: row.id,
      draftVersion: row.version,
      lastEditorUserId: row.updatedByUserId,
      tourDepartureId: row.tourDepartureId,
      batchId: row.batchId,
      currencyCode: row.currencyCode,
      adultFlightSale: row.adultFlightSale.toString(),
      adultFlightSaleCurrencyCode: row.adultFlightSaleCurrencyCode,
      childFlightSale: row.childFlightSale.toString(),
      childFlightSaleCurrencyCode: row.childFlightSaleCurrencyCode,
      businessUplift: row.businessUplift.toString(),
      businessUpliftCurrencyCode: row.businessUpliftCurrencyCode,
      commissionPercent: row.commissionPercent.toString(),
      adjustments: row.adjustments.map(
        (item): PackageTourDraftAdjustmentV1 => ({
          hotelRateId: item.hotelRateId,
          direction: item.direction as 'increase' | 'decrease',
          mode: item.mode as 'percent' | 'fixed',
          value: item.value.toString(),
        }),
      ),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toPublication(
    row: Prisma.PackagePricingTourPublishedVersionGetPayload<{
      include: { roomPrices: true };
    }>,
  ): PackageTourPublicationV1 {
    return {
      version: 1,
      id: row.id,
      draftId: row.draftId,
      priceVersion: row.version,
      draftVersion: row.draftVersion,
      tourVersion: row.tourVersion,
      currencyCode: row.currencyCode,
      adultFlightSale: row.adultFlightSale.toString(),
      adultFlightSaleCurrencyCode: row.adultFlightSaleCurrencyCode,
      childFlightSale: row.childFlightSale.toString(),
      childFlightSaleCurrencyCode: row.childFlightSaleCurrencyCode,
      businessUplift: row.businessUplift.toString(),
      businessUpliftCurrencyCode: row.businessUpliftCurrencyCode,
      commissionPercent: row.commissionPercent.toString(),
      outboundCostRevisionId: row.outboundCostRevisionId,
      returnCostRevisionId: row.returnCostRevisionId,
      roomPrices: row.roomPrices.map((item) => ({
        hotelRateId: item.hotelRateId,
        roomCode: item.roomCode,
        hotelPurchase: item.hotelPurchase.toString(),
        hotelSale: item.hotelSale.toString(),
        packagePurchase: item.packagePurchase?.toString() ?? null,
        packageSale: item.packageSale?.toString() ?? null,
        commissionAmount: item.commissionAmount?.toString() ?? null,
        netProfit: item.netProfit?.toString() ?? null,
        currencyCode: item.currencyCode,
      })),
      publishedAt: row.publishedAt.toISOString(),
    };
  }
}
