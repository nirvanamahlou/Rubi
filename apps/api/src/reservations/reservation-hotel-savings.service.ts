import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Inject,
  Injectable,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  hotelNights,
  quoteHotelOccupancy,
  hotelPurchaseSavingsEvidence,
  type AuthenticatedActor,
  type HotelPurchaseSavingsV1,
  type PackageTourHotelPurchaseBatchV1,
  type SalesReservationRequestV1,
} from '@nora/contracts';
import { Prisma } from '@nora/database';
import { DatabaseService } from '../database/database.service';
import { SalesReservationTableService } from '../sales/sales-reservation-table.module';
import { MasterDataService } from '../master-data/master-data.service';
import { HotelPurchaseRatesPublicService } from './hotel-purchase-rates.public';
import { AuthGuard } from '../iam/auth.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';

export function hotelReferencePurchase(
  batches: readonly PackageTourHotelPurchaseBatchV1[],
  snapshot: SalesReservationRequestV1,
  ages: readonly number[],
  currencyCode: string,
  board?: string,
): { amount: string; batchId: string; brokerName: string } | null {
  const hotel = snapshot.hotelSelection;
  if (!hotel || !ages.length) return null;
  if (hotel.rooms?.length) {
    const expected = hotel.rooms
      .flatMap((r) => [...Array(r.adults).fill(15), ...r.childAges])
      .sort((a, b) => a - b);
    const actual = ages.map((a) => (a >= 15 ? 15 : a)).sort((a, b) => a - b);
    if (
      expected.length !== actual.length ||
      expected.some((a, i) => a !== actual[i])
    )
      return null;
    const summary = { ...hotel };
    delete summary.rooms;
    delete summary.singleRoomCount;
    delete summary.doubleRoomCount;
    const candidates = batches.flatMap((batch) =>
      [...new Set(batch.rows.map((r) => r.brokerName))].flatMap(
        (brokerName) => {
          const quotes = hotel.rooms!.map((room) =>
            hotelReferencePurchase(
              [
                {
                  ...batch,
                  rows: batch.rows.filter((r) => r.brokerName === brokerName),
                },
              ],
              {
                ...snapshot,
                hotelSelection: {
                  ...summary,
                  roomTypeId: room.roomTypeId,
                  roomCount: 1,
                  extraBedCount: 0,
                },
              },
              [...Array(room.adults).fill(15), ...room.childAges],
              currencyCode,
              board,
            ),
          );
          return quotes.every((q) => q !== null)
            ? [
                {
                  amount: quotes
                    .reduce((n, q) => n.add(q!.amount), new Prisma.Decimal(0))
                    .toFixed(),
                  batchId: batch.id,
                  brokerName,
                },
              ]
            : [];
        },
      ),
    );
    return (
      candidates.sort(
        (a, b) =>
          new Prisma.Decimal(a.amount).cmp(b.amount) ||
          a.batchId.localeCompare(b.batchId),
      )[0] ?? null
    );
  }
  // Extra-bed placement is not captured per room; do not invent an allocation.
  if (hotel.extraBedCount) return null;
  const roomAdults =
    hotel.singleRoomCount !== undefined || hotel.doubleRoomCount !== undefined
      ? ([
          ...Array(hotel.singleRoomCount ?? 0).fill(1),
          ...Array(hotel.doubleRoomCount ?? hotel.roomCount).fill(2),
        ] as number[])
      : undefined;
  if (
    roomAdults &&
    (roomAdults.length !== hotel.roomCount ||
      roomAdults.reduce((a, b) => a + b, 0) !==
        ages.filter((age) => age >= 15).length)
  )
    return null;
  const candidates: { amount: string; batchId: string; brokerName: string }[] =
    [];
  for (const batch of batches)
    for (const row of batch.rows) {
      if (row.hotelId !== hotel.hotelId || row.currencyCode !== currencyCode)
        continue;
      for (const room of row.roomRates.filter(
        (room) => room.roomTypeId === hotel.roomTypeId,
      )) {
        if (room.occupancyRates) {
          const quote = quoteHotelOccupancy(room.occupancyRates, {
            adults: ages.filter((age) => age >= 15).length,
            childAges: ages.filter((age) => age < 15),
            rooms: hotel.roomCount,
            ...(roomAdults ? { roomAdults } : {}),
            checkIn: hotel.checkInDate,
            checkOut: hotel.checkOutDate,
            currencyCode,
            ...(board ? { board } : {}),
            priceBasis: 'PURCHASE',
          });
          if (quote)
            candidates.push({
              amount: quote.amount,
              batchId: batch.id,
              brokerName: row.brokerName,
            });
        } else if (
          !hotel.mealServiceId &&
          !hotel.extraBedCount &&
          ages.every((age) => age >= 15) &&
          (!roomAdults || roomAdults.every((a) => a === room.maxAdults)) &&
          room.maxAdults * hotel.roomCount === ages.length
        ) {
          const amount = new Prisma.Decimal(row.basePerNight)
            .mul(room.factor)
            .mul(hotel.roomCount)
            .mul(hotelNights(hotel.checkInDate, hotel.checkOutDate))
            .toDecimalPlaces(4)
            .toFixed();
          candidates.push({
            amount,
            batchId: batch.id,
            brokerName: row.brokerName,
          });
        }
      }
    }
  return (
    candidates.sort(
      (a, b) =>
        new Prisma.Decimal(a.amount).cmp(b.amount) ||
        a.batchId.localeCompare(b.batchId),
    )[0] ?? null
  );
}

export function supplierHotelPurchasePrices(
  batches: readonly PackageTourHotelPurchaseBatchV1[],
  snapshot: SalesReservationRequestV1,
  ages: readonly number[],
  brokerId: string,
  board?: string,
) {
  const selected = batches.map((batch) => ({
    ...batch,
    rows: batch.rows.filter((row) => row.brokerId === brokerId),
  }));
  const currencies = new Set(
    selected.flatMap((batch) =>
      batch.rows.flatMap((row) => [
        row.currencyCode,
        ...row.roomRates.flatMap(
          (room) => room.occupancyRates?.map((rate) => rate.currencyCode) ?? [],
        ),
      ]),
    ),
  );
  return [...currencies].flatMap((currencyCode) => {
    if (!currencyCode) return [];
    const quote = hotelReferencePurchase(
      selected,
      snapshot,
      ages,
      currencyCode,
      board,
    );
    return quote ? [{ amount: quote.amount, currencyCode }] : [];
  });
}

@Injectable()
export class ReservationHotelSavingsService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(HotelPurchaseRatesPublicService)
    private readonly rates: HotelPurchaseRatesPublicService,
    @Inject(SalesReservationTableService)
    private readonly sales: SalesReservationTableService,
    @Inject(MasterDataService) private readonly master: MasterDataService,
  ) {}
  async supplierFormPrices(
    id: string,
    brokerId: string,
    actor: AuthenticatedActor,
  ) {
    if (!actor.permissions.includes('reservations.read'))
      throw new ForbiddenException();
    const intake = await this.db.client.reservationIntake.findFirst({
      where: { id, branchId: { in: [...actor.branchIds] } },
    });
    if (!intake) throw new NotFoundException();
    const snapshot = intake.snapshot as unknown as SalesReservationRequestV1;
    const hotel = snapshot.hotelSelection;
    if (!hotel) return { data: [] };
    const ages = await this.sales.hotelGuestAges(snapshot, actor);
    if (!ages) return { data: [] };
    let board: string | undefined;
    if (hotel.mealServiceId) {
      const meal = await this.master.detail(
        'meal-services',
        hotel.mealServiceId,
      );
      board = meal.data.code;
      if (!board) return { data: [] };
    }
    const batches = await this.rates.forTour(
      intake.branchId,
      [hotel.hotelId],
      hotel.checkInDate,
      hotel.checkOutDate,
      undefined,
      undefined,
      true,
      true,
    );
    return {
      data: supplierHotelPurchasePrices(
        batches,
        snapshot,
        ages,
        brokerId,
        board,
      ),
    };
  }
  async quote(
    snapshot: SalesReservationRequestV1,
    branchId: string,
    currencyCode: string,
    actor: AuthenticatedActor,
    actualAmount: string | null = null,
  ): Promise<HotelPurchaseSavingsV1> {
    if (
      !actor.permissions.includes('reservations.read') ||
      !actor.branchIds.includes(branchId)
    )
      throw new ForbiddenException();
    const hotel = snapshot.hotelSelection;
    const result: HotelPurchaseSavingsV1 = {
      version: 1,
      status: 'UNAVAILABLE',
      reason: 'NO_MATCHING_RATE',
      referenceAmount: null,
      actualAmount,
      savingsAmount: null,
      currencyCode,
      capturedAt: new Date().toISOString(),
      sourceBatchId: null,
      sourceBrokerName: null,
      checkIn: hotel?.checkInDate ?? '',
      checkOut: hotel?.checkOutDate ?? '',
    };
    if (!hotel) return result;
    const ages = await this.sales.hotelGuestAges(snapshot, actor);
    if (!ages) return { ...result, reason: 'GUEST_COMPOSITION_UNAVAILABLE' };
    let board: string | undefined;
    if (hotel.mealServiceId) {
      try {
        const meal = await this.master.detail(
          'meal-services',
          hotel.mealServiceId,
        );
        board = typeof meal.data.code === 'string' ? meal.data.code : undefined;
      } catch (error) {
        if (!(error instanceof NotFoundException)) throw error;
      }
      if (!board) return { ...result, reason: 'MEAL_PLAN_UNAVAILABLE' };
    }
    const batches = await this.rates.forTour(
      branchId,
      [hotel.hotelId],
      hotel.checkInDate,
      hotel.checkOutDate,
      undefined,
      undefined,
      true,
      true,
    );
    const reference = hotelReferencePurchase(
      batches,
      snapshot,
      ages,
      currencyCode,
      board,
    );
    if (!reference) return result;
    return {
      ...result,
      status: 'AVAILABLE',
      reason: null,
      referenceAmount: reference.amount,
      sourceBatchId: reference.batchId,
      sourceBrokerName: reference.brokerName,
      savingsAmount:
        actualAmount === null
          ? null
          : new Prisma.Decimal(reference.amount).sub(actualAmount).toFixed(),
    };
  }
  async preview(id: string, currency: string, actor: AuthenticatedActor) {
    if (!actor.permissions.includes('reservations.read'))
      throw new ForbiddenException();
    if (!/^[A-Z]{3}$/.test(currency ?? '')) throw new BadRequestException();
    const intake = await this.db.client.reservationIntake.findFirst({
      where: { id, branchId: { in: [...actor.branchIds] } },
    });
    if (!intake) throw new NotFoundException();
    return {
      data: await this.quote(
        intake.snapshot as unknown as SalesReservationRequestV1,
        intake.branchId,
        currency,
        actor,
      ),
    };
  }
  async recorded(id: string, actor: AuthenticatedActor) {
    if (!actor.permissions.includes('reservations.read'))
      throw new ForbiddenException();
    const intake = await this.db.client.reservationIntake.findFirst({
      where: { id, branchId: { in: [...actor.branchIds] } },
      include: {
        servicePurchases: {
          where: { serviceKind: 'HOTEL' },
          orderBy: { version: 'desc' },
          include: {
            financeRevisions: { orderBy: { version: 'desc' }, take: 1 },
          },
        },
        hotelPurchases: { orderBy: { version: 'desc' }, take: 1 },
      },
    });
    if (!intake) throw new NotFoundException();
    const snapshot = intake.snapshot as unknown as SalesReservationRequestV1;
    const data: HotelPurchaseSavingsV1[] = [];
    const seen = new Set<string>();
    for (const purchase of intake.servicePurchases) {
      if (
        purchase.serviceKind !== 'HOTEL' ||
        seen.has(purchase.serviceClientKey)
      )
        continue;
      seen.add(purchase.serviceClientKey);
      if (purchase.financeRevisions[0]?.status === 'REJECTED') continue;
      const saved = hotelPurchaseSavingsEvidence(purchase.passengerPrices);
      // Only the persisted hotel projection leaves this endpoint, never a full intake or profit total.
      if (saved)
        data.push({
          version: 1,
          status: saved.status,
          reason: saved.reason,
          referenceAmount: saved.referenceAmount,
          actualAmount: purchase.amount.toFixed(),
          savingsAmount:
            saved.referenceAmount === null
              ? null
              : new Prisma.Decimal(saved.referenceAmount)
                  .sub(purchase.amount.toFixed())
                  .toFixed(),
          currencyCode: purchase.currencyCode,
          capturedAt: saved.capturedAt,
          sourceBatchId: saved.sourceBatchId,
          sourceBrokerName: saved.sourceBrokerName,
          checkIn: saved.checkIn,
          checkOut: saved.checkOut,
        });
      else {
        const current = await this.quote(
          snapshot,
          intake.branchId,
          purchase.currencyCode,
          actor,
          purchase.amount.toFixed(),
        );
        data.push({
          ...current,
          reason:
            current.status === 'AVAILABLE'
              ? 'CURRENT_REFERENCE'
              : current.reason,
        });
      }
    }
    if (!seen.size && intake.hotelPurchases[0] && snapshot.hotelSelection) {
      const purchase = intake.hotelPurchases[0];
      const current = await this.quote(
        snapshot,
        intake.branchId,
        purchase.currencyCode,
        actor,
        purchase.amount.toFixed(),
      );
      data.push({
        ...current,
        reason:
          current.status === 'AVAILABLE' ? 'CURRENT_REFERENCE' : current.reason,
      });
    }
    return { data };
  }
  async summary(
    query: { from?: string; to?: string; dateBasis?: string },
    actor: AuthenticatedActor,
  ) {
    if (!actor.permissions.includes('reservations.read'))
      throw new ForbiddenException();
    const day = (value?: string) =>
      !value ||
      (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
        Number.isFinite(Date.parse(value)) &&
        new Date(value).toISOString().slice(0, 10) === value);
    if (
      !day(query.from) ||
      !day(query.to) ||
      (query.from && query.to && query.from > query.to) ||
      (query.dateBasis &&
        !['createdAt', 'receivedAt', 'travelDate'].includes(query.dateBasis))
    )
      throw new BadRequestException();
    const rows = await this.db.client.reservationIntake.findMany({
      where: { branchId: { in: [...actor.branchIds] } },
      orderBy: { contractVersion: 'desc' },
      include: {
        servicePurchases: {
          where: { serviceKind: 'HOTEL' },
          orderBy: { version: 'desc' },
          include: {
            financeRevisions: { orderBy: { version: 'desc' }, take: 1 },
          },
        },
        workflowRevisions: { orderBy: { version: 'desc' }, take: 1 },
      },
    });
    const contracts = await this.sales.hotelSavingsContracts(
      [...new Set(rows.map((row) => row.contractId))],
      actor,
    );
    const totals = new Map<string, Prisma.Decimal>();
    const seen = new Set<string>();
    let comparedCount = 0;
    let unavailableCount = 0;
    for (const row of rows) {
      if (seen.has(row.contractId)) continue;
      seen.add(row.contractId);
      const contract = contracts.get(row.contractId);
      if (!contract || contract.status === 'CANCELLED') continue;
      const workflow = row.workflowRevisions[0]?.state as
        { supplierStatus?: string } | undefined;
      if (
        row.status === 'CANCELLED' ||
        workflow?.supplierStatus === 'CANCELLED'
      )
        continue;
      const snapshot = row.snapshot as unknown as SalesReservationRequestV1;
      const date = (
        query.dateBasis === 'travelDate'
          ? snapshot.hotelSelection?.checkInDate
          : query.dateBasis === 'createdAt'
            ? contract.createdAt.toISOString()
            : row.receivedAt.toISOString()
      )?.slice(0, 10);
      if (
        !date ||
        (query.from && date < query.from) ||
        (query.to && date > query.to)
      )
        continue;
      const keys = new Set<string>();
      for (const purchase of row.servicePurchases) {
        if (keys.has(purchase.serviceClientKey)) continue;
        keys.add(purchase.serviceClientKey);
        if (purchase.financeRevisions[0]?.status === 'REJECTED') continue;
        const saved = hotelPurchaseSavingsEvidence(purchase.passengerPrices);
        if (saved?.status !== 'AVAILABLE' || saved.savingsAmount === null) {
          unavailableCount++;
          continue;
        }
        comparedCount++;
        totals.set(
          saved.currencyCode,
          (totals.get(saved.currencyCode) ?? new Prisma.Decimal(0)).add(
            saved.savingsAmount,
          ),
        );
      }
    }
    return {
      data: {
        comparedCount,
        unavailableCount,
        totals: [...totals].map(([currencyCode, amount]) => ({
          currencyCode,
          amount: amount.toFixed(),
        })),
      },
    };
  }
}
@Controller('reservations/hotel-savings')
@UseGuards(AuthGuard)
export class ReservationHotelSavingsController {
  constructor(
    @Inject(ReservationHotelSavingsService)
    private readonly service: ReservationHotelSavingsService,
  ) {}
  @Get('supplier-form/:id')
  @Header('Cache-Control', 'private, no-store')
  supplierFormPrices(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('brokerId', ParseUUIDPipe) brokerId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.supplierFormPrices(id, brokerId, req.actor);
  }
  @Get('summary')
  @Header('Cache-Control', 'private, no-store')
  summary(
    @Query() query: { from?: string; to?: string; dateBasis?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.summary(query, req.actor);
  }
  @Get('recorded/:id')
  @Header('Cache-Control', 'private, no-store')
  recorded(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.recorded(id, req.actor);
  }
  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  preview(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('currency') currency: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.preview(id, currency, req.actor);
  }
}
