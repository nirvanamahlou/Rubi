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
import {
  calculateTourRoom,
  tourRoomOccupancy,
  type TourRoomCurrencyAmount,
} from '@nora/contracts';
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
    if (!input || typeof input !== 'object')
      throw new BadRequestException('پیش‌نویس قیمت معتبر نیست.');
    const adultCurrency =
      input.adultFlightSaleCurrencyCode ?? input.currencyCode;
    const childCurrency =
      input.childFlightSaleCurrencyCode ?? input.currencyCode;
    const businessCurrency =
      input.businessUpliftCurrencyCode ?? input.currencyCode;
    const commissionMode = input.commissionMode ?? 'percent';
    const commissionCurrency =
      input.commissionCurrencyCode ?? input.currencyCode;
    if (
      input?.version !== 1 ||
      !Number.isSafeInteger(input.expectedVersion) ||
      input.expectedVersion < 0 ||
      !/^[A-Z]{3}$/.test(input.currencyCode ?? '') ||
      !/^[A-Z]{3}$/.test(adultCurrency) ||
      !/^[A-Z]{3}$/.test(childCurrency) ||
      !/^[A-Z]{3}$/.test(businessCurrency) ||
      !['percent', 'fixed'].includes(commissionMode) ||
      !/^[A-Z]{3}$/.test(commissionCurrency)
    )
      throw new BadRequestException('پیش‌نویس قیمت معتبر نیست.');
    const grid = await this.pricing.tourCostGrid(input.tourDepartureId, actor);
    const batch = grid.purchaseBatches.find(
      (item) => item.id === input.batchId,
    );
    if (!batch || input.currencyCode !== batch.currencyCode)
      throw new BadRequestException('بازه خرید و ارز همان نوبت تور لازم است.');
    const adult = amount(
      input.adultFlightSale,
      adultCurrency === 'IRR' ? 0 : 2,
    );
    const child = amount(
      input.childFlightSale,
      childCurrency === 'IRR' ? 0 : 2,
    );
    const business = amount(
      input.businessUplift,
      businessCurrency === 'IRR' ? 0 : 2,
    );
    if (
      (input.familyAdults !== undefined &&
        (!Number.isSafeInteger(input.familyAdults) ||
          input.familyAdults < 1 ||
          input.familyAdults > 20)) ||
      (input.familyChildren !== undefined &&
        (!Number.isSafeInteger(input.familyChildren) ||
          input.familyChildren < 0 ||
          input.familyChildren > 20))
    )
      throw new BadRequestException('ترکیب مسافر اتاق خانوادگی معتبر نیست.');
    const commissionPercent = amount(input.commissionPercent, 2);
    if (commissionMode === 'percent' && commissionPercent.gt(100))
      throw new BadRequestException('کمیسیون نمی‌تواند بیش از ۱۰۰ درصد باشد.');
    const commissionAmount = amount(
      input.commissionAmount ?? '0',
      commissionCurrency === 'IRR' ? 0 : 2,
    );
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
      const rowCurrency =
        batch.rows.find((row) => row.id === item.hotelRateId)?.currencyCode ??
        batch.currencyCode;
      const value = amount(
        item.value,
        item.mode === 'fixed' && rowCurrency === 'IRR' ? 0 : 2,
      );
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
              commissionPercent,
              commissionMode,
              commissionAmount,
              commissionCurrencyCode: commissionCurrency,
              familyAdults: input.familyAdults ?? null,
              familyChildren: input.familyChildren ?? null,
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
              commissionPercent,
              commissionMode,
              commissionAmount,
              commissionCurrencyCode: commissionCurrency,
              familyAdults: input.familyAdults ?? null,
              familyChildren: input.familyChildren ?? null,
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
      batch.checkIn < grid.tour.startsOn ||
      batch.checkOut > grid.tour.endsOn ||
      dateSpan(grid.tour.startsOn, grid.tour.endsOn) !== grid.nights
    )
      throw new UnprocessableEntityException(
        'بازه خرید هتل یا ارز آن دیگر معتبر نیست.',
      );

    const rateIds = new Set(batch.rows.map((row) => row.id));
    if (!rateIds.size)
      throw new UnprocessableEntityException(
        'حداقل یک هتل منتخب با قیمت خرید لازم است.',
      );
    if (draft.adjustments.some((item) => !rateIds.has(item.hotelRateId)))
      throw new UnprocessableEntityException(
        'ردیف قیمت خرید هتلِ پیش‌نویس دیگر در این بازه نیست.',
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
    if (!outbound || (grid.tour.returnOfferId && !returning))
      throw new UnprocessableEntityException(
        'قیمت خرید پرواز یا پرداخت آن کامل نشده است.',
      );
    const nights = dateSpan(batch.checkIn, batch.checkOut);
    const businessCabin =
      grid.tour.outbound.cabinClassCode === 'BUSINESS' ||
      grid.tour.returning?.cabinClassCode === 'BUSINESS';
    const byRow = new Map(
      draft.adjustments.map((item) => [item.hotelRateId, item]),
    );
    const prices = batch.rows.flatMap((row) => {
      const sellableRooms = row.roomRates.length
        ? row.roomRates.map((room) => ({
            roomCode: room.roomTypeId,
            factor: room.factor,
            passengers: { adults: room.maxAdults, children: room.maxChildren },
          }))
        : roomCodes
            .filter((roomCode) => Boolean(row.factors[roomCode]))
            .map((roomCode) => ({
              roomCode,
              factor: row.factors[roomCode]!,
              passengers: tourRoomOccupancy(
                roomCode,
                draft.familyAdults ?? undefined,
                draft.familyChildren ?? undefined,
              ),
            }));
      return sellableRooms.map(({ roomCode, factor, passengers }) => {
        if (!passengers)
          throw new UnprocessableEntityException(
            'تعداد بزرگسال و کودک اتاق خانوادگی را مشخص کنید.',
          );
        const adjustment = byRow.get(row.id);
        try {
          const calculated = calculateTourRoom({
            basePerNight: row.basePerNight,
            factor,
            nights,
            hotelCurrency: row.currencyCode ?? batch.currencyCode,
            adjustment: {
              direction:
                (adjustment?.direction as 'increase' | 'decrease') ??
                'increase',
              mode: (adjustment?.mode as 'percent' | 'fixed') ?? 'percent',
              value: adjustment?.value.toString() ?? '0',
            },
            ...passengers,
            adultFlight: {
              amount: draft.adultFlightSale.toString(),
              currencyCode: draft.adultFlightSaleCurrencyCode,
            },
            childFlight: {
              amount: draft.childFlightSale.toString(),
              currencyCode: draft.childFlightSaleCurrencyCode,
            },
            businessUplift: {
              amount: draft.businessUplift.toString(),
              currencyCode: draft.businessUpliftCurrencyCode,
            },
            businessCabin,
            commissionPercent: draft.commissionPercent.toString(),
            commissionMode: (draft.commissionMode ?? 'percent') as
              'percent' | 'fixed',
            commissionAmount: {
              amount: draft.commissionAmount?.toString() ?? '0',
              currencyCode: draft.commissionCurrencyCode ?? draft.currencyCode,
            },
            flightCosts: [outbound, ...(returning ? [returning] : [])],
          });
          const single =
            calculated.currencyAmounts.length === 1
              ? calculated.currencyAmounts[0]
              : undefined;
          return {
            hotelRateId: row.id,
            roomCode,
            hotelPurchase: new Prisma.Decimal(calculated.hotelPurchase),
            hotelSale: new Prisma.Decimal(calculated.hotelSale),
            packagePurchase: single?.purchase ?? null,
            packageSale: single?.sale ?? null,
            commissionAmount: single?.commission ?? null,
            netProfit: single?.profit ?? null,
            currencyCode: row.currencyCode ?? batch.currencyCode,
            currencyAmounts:
              calculated.currencyAmounts as unknown as Prisma.InputJsonValue,
          };
        } catch (error) {
          throw new BadRequestException(
            error instanceof Error ? error.message : 'محاسبه قیمت معتبر نیست.',
          );
        }
      });
    });
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
          commissionMode: draft.commissionMode ?? 'percent',
          commissionAmount: draft.commissionAmount ?? new Prisma.Decimal(0),
          commissionCurrencyCode:
            draft.commissionCurrencyCode ?? draft.currencyCode,
          familyAdults: draft.familyAdults,
          familyChildren: draft.familyChildren,
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
      commissionMode: (row.commissionMode ?? 'percent') as 'percent' | 'fixed',
      commissionAmount: row.commissionAmount?.toString() ?? '0',
      commissionCurrencyCode: row.commissionCurrencyCode ?? row.currencyCode,
      ...(row.familyAdults != null ? { familyAdults: row.familyAdults } : {}),
      ...(row.familyChildren != null
        ? { familyChildren: row.familyChildren }
        : {}),
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
      commissionMode: (row.commissionMode ?? 'percent') as 'percent' | 'fixed',
      commissionAmount: row.commissionAmount?.toString() ?? '0',
      commissionCurrencyCode: row.commissionCurrencyCode ?? row.currencyCode,
      ...(row.familyAdults != null ? { familyAdults: row.familyAdults } : {}),
      ...(row.familyChildren != null
        ? { familyChildren: row.familyChildren }
        : {}),
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
        ...(Array.isArray(item.currencyAmounts)
          ? {
              currencyAmounts:
                item.currencyAmounts as unknown as TourRoomCurrencyAmount[],
            }
          : {}),
      })),
      publishedAt: row.publishedAt.toISOString(),
    };
  }
}
