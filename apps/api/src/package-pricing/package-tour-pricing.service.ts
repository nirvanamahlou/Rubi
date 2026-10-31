import { isOptionalOperationReason } from '@nora/contracts';
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
  PackagePublishedSaleV1,
  SalesContractCreateRequest,
  PackageTourDraftSaveV1,
  PackageTourDraftV1,
  PackageTourPublicationV1,
  PackageTourPublishV1,
} from '@nora/contracts';
import { Prisma } from '@nora/database';
import {
  applyPackageRoomSales,
  validatePackageRoomSales,
  calculateTourRoom,
  buildHotelPackageTable,
  buildHotelPackageCompositions,
  packageRoomIdentity,
  packageTourSelectionBatch,
  matchingPublishedRooms,
  publishedSaleTotals,
  validateTourPriceFields,
  tourPriceFields,
  tourPriceFieldValues,
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

  async assertContractSale(
    input: SalesContractCreateRequest,
    actor: AuthenticatedActor,
    branchId: string,
  ) {
    if (input.services.some((s) => s.metadata?.packagePublishedSale))
      return this.validateContractSale(input, actor, branchId);
    const tourId = input.services.find(
      (s) => typeof s.metadata?.tourDepartureId === 'string',
    )?.metadata?.tourDepartureId;
    if (
      typeof tourId === 'string' &&
      (await this.saleCatalog(tourId, actor, branchId)).data.length
    )
      throw new BadRequestException('قیمت فروش معتبر نیست.');
    return undefined;
  }

  async validateContractSale(
    input: SalesContractCreateRequest,
    actor: AuthenticatedActor,
    branchId?: string,
  ) {
    const values = input.services
      .map((s) => s.metadata?.packagePublishedSale)
      .filter(Boolean);
    const hotel = input.hotelSelection;
    if (
      values.length !== 1 ||
      typeof values[0] !== 'string' ||
      values[0].length > 100000 ||
      !hotel?.rooms?.length
    )
      throw new BadRequestException('قیمت فروش معتبر نیست.');
    let quote: {
      tourDepartureId: string;
      items: { publicationId: string; roomCode: string }[];
      prices: { currencyCode: string; amount: string }[];
    };
    try {
      quote = JSON.parse(values[0]);
    } catch {
      throw new BadRequestException('قیمت فروش معتبر نیست.');
    }
    const tourId = input.services.find((s) => s.metadata?.tourDepartureId)
      ?.metadata?.tourDepartureId;
    if (
      !quote ||
      typeof tourId !== 'string' ||
      quote.tourDepartureId !== tourId ||
      !Array.isArray(quote.items) ||
      quote.items.length !== hotel.rooms.length
    )
      throw new BadRequestException('قیمت فروش معتبر نیست.');
    const catalog = await this.saleCatalog(tourId, actor, branchId);
    const selected = hotel.rooms.map((room, index) =>
      matchingPublishedRooms(catalog.data, {
        ...room,
        hotelId: hotel.hotelId,
        checkIn: hotel.checkInDate,
        checkOut: hotel.checkOutDate,
      }).find(
        (p) =>
          p.publicationId === quote.items[index]?.publicationId &&
          p.roomCode === quote.items[index]?.roomCode,
      ),
    );
    if (selected.some((p) => !p))
      throw new BadRequestException('قیمت فروش معتبر نیست.');
    if (
      JSON.stringify(
        publishedSaleTotals(selected as PackagePublishedSaleV1[]),
      ) !== JSON.stringify(quote.prices)
    )
      throw new BadRequestException('قیمت فروش معتبر نیست.');
    this.validateContractAmounts(input, quote.prices);
    return hotel.hotelId;
  }

  validateContractAmounts(
    input: SalesContractCreateRequest,
    prices: readonly { currencyCode: string; amount: string }[],
  ) {
    if (Array.isArray(input.priceComponents)) {
      const baseline = new Map(
        prices.map((p) => [p.currencyCode, new Prisma.Decimal(p.amount)]),
      );
      for (const service of input.services.filter(
        (s) => s.metadata?.insuranceAgeSurcharge === true,
      )) {
        const extra = String(service.metadata!.extraToman ?? '0');
        if (!/^\d{1,15}$/.test(extra))
          throw new BadRequestException('قیمت فروش معتبر نیست.');
        baseline.set(
          'IRR',
          (baseline.get('IRR') ?? new Prisma.Decimal(0)).add(
            new Prisma.Decimal(extra).mul(10),
          ),
        );
      }
      const currencies = new Set([
        ...baseline.keys(),
        ...input.priceComponents.map((p) => p.currencyCode),
      ]);
      for (const code of currencies) {
        const parts = input.priceComponents.filter(
          (p) => p.currencyCode === code,
        );
        const base = parts
          .filter((p) => p.type === 'BASE')
          .reduce((n, p) => n.add(p.amount), new Prisma.Decimal(0));
        const discount = parts
          .filter((p) => p.type === 'DISCOUNT')
          .reduce((n, p) => n.add(p.amount), new Prisma.Decimal(0));
        const reference = baseline.get(code) ?? new Prisma.Decimal(0);
        if (base.lt(reference) || (discount.gt(0) && !base.eq(reference)))
          throw new BadRequestException('قیمت فروش معتبر نیست.');
      }
    }
  }

  async saleCatalog(
    tourId: string,
    actor: AuthenticatedActor,
    branchId?: string,
  ): Promise<{ data: PackagePublishedSaleV1[] }> {
    if (!actor.permissions.includes('sales.contracts.create'))
      throw new ForbiddenException('مجوز ایجاد قرارداد وجود ندارد.');
    const grid = await this.pricing.tourCostGrid(tourId, actor);
    if (branchId && grid.tour.branchId !== branchId)
      throw new ForbiddenException('مجوز ایجاد قرارداد وجود ندارد.');
    const drafts = await this.database.client.packagePricingTourDraft.findMany({
      where: { tourDepartureId: tourId, branchId: grid.tour.branchId },
      include: {
        publications: {
          where: { tourVersion: grid.tour.version },
          orderBy: { version: 'desc' },
          take: 1,
          include: { roomPrices: true },
        },
      },
    });
    const data: PackagePublishedSaleV1[] = [];
    for (const draft of drafts) {
      const batch = packageTourSelectionBatch(grid, draft.batchId);
      const publication = draft.publications[0];
      if (!batch || !publication) continue;
      for (const price of publication.roomPrices) {
        const row = batch.rows.find((r) => r.id === price.hotelRateId);
        if (!row || !packageRoomIdentity(price.roomCode)) continue;
        const amounts =
          price.currencyAmounts as unknown as TourRoomCurrencyAmount[];
        if (!Array.isArray(amounts)) continue;
        data.push({
          publicationId: publication.id,
          hotelId: row.hotelId,
          hotelName: row.hotelName,
          roomTypeName: price.roomTypeName ?? '',
          roomCode: price.roomCode,
          checkIn: grid.tour.startsOn,
          checkOut: grid.tour.endsOn,
          prices: amounts.map((p) => ({
            currencyCode: p.currencyCode,
            amount: p.sale,
          })),
        });
      }
    }
    return { data };
  }

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
    let priceFields: PackageTourDraftSaveV1['priceFields'];
    if (input.priceFields !== undefined) {
      try {
        priceFields = validateTourPriceFields(input.priceFields);
      } catch (error) {
        throw new BadRequestException(
          error instanceof Error ? error.message : 'ردیف قیمت معتبر نیست.',
        );
      }
      input = { ...input, ...tourPriceFieldValues(priceFields), priceFields };
    }
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
    const batch = packageTourSelectionBatch(
      grid,
      input.batchId,
      Array.isArray(input.selectedRoomKeys),
    );
    if (!batch || input.currencyCode !== batch.currencyCode)
      throw new BadRequestException('بازه خرید و ارز همان نوبت تور لازم است.');
    if (
      input.selectedHotelRateIds !== undefined &&
      (!Array.isArray(input.selectedHotelRateIds) ||
        input.selectedHotelRateIds.length > 500 ||
        new Set(input.selectedHotelRateIds).size !==
          input.selectedHotelRateIds.length ||
        input.selectedHotelRateIds.some(
          (id) =>
            typeof id !== 'string' || !batch.rows.some((row) => row.id === id),
        ))
    )
      throw new BadRequestException(
        'هتل‌های منتخب باید متعلق به همین بازه باشند.',
      );
    if (
      input.selectedRoomKeys !== undefined &&
      (!Array.isArray(input.selectedRoomKeys) ||
        input.selectedRoomKeys.length > 1500 ||
        new Set(input.selectedRoomKeys).size !==
          input.selectedRoomKeys.length ||
        input.selectedRoomKeys.some(
          (k) => typeof k !== 'string' || k.length > 2000,
        ))
    )
      throw new BadRequestException('قیمت فروش معتبر نیست.');
    let roomSaleOverrides;
    try {
      roomSaleOverrides =
        input.roomSaleOverrides === undefined
          ? undefined
          : validatePackageRoomSales(input.roomSaleOverrides);
      for (const item of roomSaleOverrides ?? []) {
        const row = batch.rows.find((row) => row.id === item.hotelRateId);
        if (!row) throw Error('قیمت فروش باید متعلق به همین بازه باشد.');
        const allowed = new Set([
          row.currencyCode ?? batch.currencyCode,
          adultCurrency,
          childCurrency,
          businessCurrency,
          commissionCurrency,
          ...(priceFields ?? []).map((field) => field.currencyCode),
        ]);
        if (!allowed.has(item.currencyCode))
          throw Error('ارز قیمت فروش متعلق به این پکیج نیست.');
      }
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'قیمت فروش معتبر نیست.',
      );
    }
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
      const storedFields =
        priceFields ??
        (Array.isArray(existing?.priceFields)
          ? validateTourPriceFields(existing.priceFields).map((field) => {
              if (field.kind === 'custom') return field;
              const legacy = tourPriceFields({
                ...input,
                priceFields: undefined,
              }).find((item) => item.kind === field.kind)!;
              return {
                ...field,
                amount: legacy.amount,
                currencyCode: legacy.currencyCode,
                mode: legacy.mode,
              };
            })
          : undefined);
      const fieldsData =
        storedFields === undefined
          ? {}
          : {
              ...tourPriceFieldValues(storedFields),
              priceFields: storedFields as unknown as Prisma.InputJsonValue,
            };
      const selectedData =
        input.selectedHotelRateIds === undefined
          ? {}
          : {
              ...(input.selectedRoomKeys === undefined
                ? {}
                : {
                    selectedRoomKeys: [
                      ...input.selectedRoomKeys,
                    ] as Prisma.InputJsonValue,
                  }),
              selectedHotelRateIds: [
                ...input.selectedHotelRateIds,
              ] as Prisma.InputJsonValue,
            };
      const roomSalesData =
        roomSaleOverrides === undefined
          ? {}
          : {
              roomSaleOverrides:
                roomSaleOverrides as unknown as Prisma.InputJsonValue,
            };
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
              ...fieldsData,
              ...roomSalesData,
              ...selectedData,
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
              ...fieldsData,
              ...roomSalesData,
              ...selectedData,
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
      !isOptionalOperationReason(input.reason) ||
      (input.reason ?? '').trim().length > 500
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
    const batch = packageTourSelectionBatch(
      grid,
      draft.batchId,
      Array.isArray(draft.selectedRoomKeys),
    );
    if (
      !batch ||
      batch.currencyCode !== draft.currencyCode ||
      batch.checkIn > grid.tour.startsOn ||
      (batch.method === 'STAY'
        ? batch.checkOut < grid.tour.endsOn
        : batch.checkOut <= grid.tour.startsOn) ||
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

    if (grid.tour.remainingCapacity < 1)
      throw new UnprocessableEntityException(
        'ظرفیت تور برای انتشار قیمت کافی نیست.',
      );
    const outbound = grid.flightPurchaseCosts.find(
      (cost) => cost.offerId === grid.tour.outboundOfferId,
    );
    const returning = grid.tour.returnOfferId
      ? grid.flightPurchaseCosts.find(
          (cost) => cost.offerId === grid.tour.returnOfferId,
        )
      : undefined;
    const flightCosts =
      !grid.missingFlightOfferIds.length &&
      outbound &&
      (!grid.tour.returnOfferId || returning)
        ? [outbound, ...(returning ? [returning] : [])]
        : undefined;
    const nights = grid.nights;
    const businessCabin =
      grid.tour.outbound.cabinClassCode === 'BUSINESS' ||
      grid.tour.returning?.cabinClassCode === 'BUSINESS';
    const byRow = new Map(
      draft.adjustments.map((item) => [item.hotelRateId, item]),
    );
    const legacyPrices = () =>
      batch.rows.flatMap((row) => {
        const sellableRooms =
          !Object.values(row.factors).some(Boolean) && row.roomRates.length
            ? row.roomRates.map((room) => ({
                roomCode: room.roomTypeId,
                factor: room.factor,
                passengers: {
                  adults: room.maxAdults,
                  children: room.maxChildren,
                },
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
              extraSaleFields: Array.isArray(draft.priceFields)
                ? validateTourPriceFields(draft.priceFields).filter(
                    (field) => field.kind === 'custom',
                  )
                : [],
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
                currencyCode:
                  draft.commissionCurrencyCode ?? draft.currencyCode,
              },
              flightCosts,
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
              error instanceof Error
                ? error.message
                : 'محاسبه قیمت معتبر نیست.',
            );
          }
        });
      });
    const prices = Array.isArray(draft.selectedHotelRateIds)
      ? (() => {
          const ids = draft.selectedHotelRateIds;
          if (
            !ids.length ||
            ids.some((id) => typeof id !== 'string' || !rateIds.has(id)) ||
            new Set(ids).size !== ids.length
          )
            throw new UnprocessableEntityException(
              'هتل‌های منتخب این بازه معتبر نیستند.',
            );
          return batch.rows
            .filter((row) => ids.includes(row.id))
            .flatMap((row) => {
              const adjustment = byRow.get(row.id);
              const calculated = (() => {
                try {
                  return (
                    Array.isArray(draft.selectedRoomKeys)
                      ? buildHotelPackageCompositions
                      : buildHotelPackageTable
                  )({
                    row,
                    checkIn: grid.tour.startsOn,
                    checkOut: grid.tour.endsOn,
                    currencyCode: batch.currencyCode,
                    calculation: {
                      adjustment: {
                        direction:
                          (adjustment?.direction as 'increase' | 'decrease') ??
                          'increase',
                        mode:
                          (adjustment?.mode as 'fixed' | 'percent') ??
                          'percent',
                        value: adjustment?.value.toString() ?? '0',
                      },
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
                        currencyCode:
                          draft.commissionCurrencyCode ?? draft.currencyCode,
                      },
                      extraSaleFields: Array.isArray(draft.priceFields)
                        ? validateTourPriceFields(draft.priceFields).filter(
                            (field) => field.kind === 'custom',
                          )
                        : [],
                      flightCosts,
                    },
                  });
                } catch (error) {
                  throw new BadRequestException(
                    error instanceof Error
                      ? error.message
                      : 'محاسبه قیمت معتبر نیست.',
                  );
                }
              })();
              if (
                !calculated.length ||
                (!Array.isArray(draft.selectedRoomKeys) &&
                  calculated.length !== 3)
              )
                throw new UnprocessableEntityException(
                  'تعرفه سینگل، دبل و کودک با تخت برای تمام شب‌ها لازم است.',
                );
              const overrides = Array.isArray(draft.roomSaleOverrides)
                ? validatePackageRoomSales(draft.roomSaleOverrides)
                : [];
              return calculated
                .filter(
                  (raw) =>
                    !Array.isArray(draft.selectedRoomKeys) ||
                    draft.selectedRoomKeys.includes(
                      JSON.stringify([row.id, raw.roomCode]),
                    ),
                )
                .map((raw) => {
                  const item = applyPackageRoomSales(
                    raw,
                    overrides,
                    (draft.commissionMode ?? 'percent') as 'percent' | 'fixed',
                    draft.commissionPercent.toString(),
                  );
                  const single =
                    item.currencyAmounts.length === 1
                      ? item.currencyAmounts[0]
                      : undefined;
                  return {
                    ...item,
                    hotelPurchase: new Prisma.Decimal(item.hotelPurchase),
                    hotelSale: new Prisma.Decimal(item.hotelSale),
                    packagePurchase: single?.purchase ?? null,
                    packageSale: single?.sale ?? null,
                    commissionAmount: single?.commission ?? null,
                    netProfit: single?.profit ?? null,
                    currencyAmounts:
                      item.currencyAmounts as unknown as Prisma.InputJsonValue,
                  };
                });
            });
        })()
      : legacyPrices();
    if (
      Array.isArray(draft.selectedRoomKeys) &&
      (prices.length !== draft.selectedRoomKeys.length || !prices.length)
    )
      throw new UnprocessableEntityException('قیمت فروش معتبر نیست.');
    if (!prices.length)
      throw new UnprocessableEntityException('قیمت فروش معتبر نیست.');
    const frozenSales = Array.isArray(draft.roomSaleOverrides)
      ? validatePackageRoomSales(draft.roomSaleOverrides)
      : [];
    for (const sale of frozenSales) {
      const price = prices.find(
        (item) =>
          item.hotelRateId === sale.hotelRateId &&
          item.roomCode === sale.roomCode,
      );
      if (
        !price ||
        !Array.isArray(price.currencyAmounts) ||
        !price.currencyAmounts.some(
          (part) =>
            part &&
            typeof part === 'object' &&
            'currencyCode' in part &&
            part.currencyCode === sale.currencyCode,
        )
      )
        throw new UnprocessableEntityException(
          'قیمت دستی با ترکیب‌های فعلی پکیج سازگار نیست؛ پیش‌نویس را دوباره ذخیره کنید.',
        );
    }
    const fingerprint = sourceHash({
      tour: grid.tour,
      batch,
      costs: grid.flightPurchaseCosts,
      draftVersion: draft.version,
      adjustments: draft.adjustments,
      roomSaleOverrides: draft.roomSaleOverrides,
      selectedRoomKeys: draft.selectedRoomKeys,
      priceFields: draft.priceFields,
      selectedHotelRateIds: draft.selectedHotelRateIds,
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
          ...(Array.isArray(draft.selectedHotelRateIds)
            ? {
                selectedHotelRateIds:
                  draft.selectedHotelRateIds as Prisma.InputJsonValue,
              }
            : {}),
          ...(draft.priceFields != null
            ? { priceFields: draft.priceFields as Prisma.InputJsonValue }
            : {}),
          version: (latest?.version ?? 0) + 1,
          draftVersion: draft.version,
          tourVersion: grid.tour.version,
          sourceFingerprint: fingerprint,
          reason: (input.reason ?? '').trim(),
          outboundCostRevisionId: outbound?.costRevisionId ?? null,
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
      ...(Array.isArray(row.roomSaleOverrides)
        ? { roomSaleOverrides: validatePackageRoomSales(row.roomSaleOverrides) }
        : {}),
      batchId: row.batchId,
      ...(Array.isArray(row.priceFields)
        ? { priceFields: validateTourPriceFields(row.priceFields) }
        : {}),
      ...(Array.isArray(row.selectedRoomKeys)
        ? { selectedRoomKeys: row.selectedRoomKeys as string[] }
        : {}),
      ...(Array.isArray(row.selectedHotelRateIds)
        ? { selectedHotelRateIds: row.selectedHotelRateIds as string[] }
        : {}),
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
      ...(Array.isArray(row.priceFields)
        ? { priceFields: validateTourPriceFields(row.priceFields) }
        : {}),
      ...(Array.isArray(row.selectedHotelRateIds)
        ? { selectedHotelRateIds: row.selectedHotelRateIds as string[] }
        : {}),
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
        ...(item.roomTypeName
          ? { roomTypeName: item.roomTypeName, board: item.board ?? '' }
          : {}),
        ...(item.childAgeMin == null || item.childAgeMaxExclusive == null
          ? {}
          : {
              childAgeMin: item.childAgeMin,
              childAgeMaxExclusive: item.childAgeMaxExclusive,
            }),
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
