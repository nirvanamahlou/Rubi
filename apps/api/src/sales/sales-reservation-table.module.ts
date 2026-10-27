import { salesHotelRoomSummary } from '@nora/contracts';
import { hotelAgeOn, type SalesReservationRequestV1 } from '@nora/contracts';
import { Inject, Injectable, Module } from '@nestjs/common';
import type {
  AuthenticatedActor,
  ReservationTableSummaryV1,
} from '@nora/contracts';
import { Prisma } from '@nora/database';
import { DatabaseService } from '../database/database.service';
import { TicketRuntimeModule } from '../ticket-catalog/ticket-runtime.module';
import { TicketPublicService } from '../ticket-catalog/ticket-public.service';
import { calculateSalesBalances } from './sales.domain';

/** Sales-owned, branch-scoped read projection for the Reservations inbox. */
@Injectable()
export class SalesReservationTableService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(TicketPublicService) private readonly tickets: TicketPublicService,
  ) {}
  async hotelSavingsContracts(
    ids: readonly string[],
    actor: AuthenticatedActor,
  ) {
    if (!actor.permissions.includes('reservations.read') || !ids.length)
      return new Map<string, { createdAt: Date; status: string }>();
    const rows = await this.database.client.salesContract.findMany({
      where: { id: { in: [...ids] }, branchId: { in: [...actor.branchIds] } },
      select: { id: true, createdAt: true, status: true },
    });
    return new Map(
      rows.map((row) => [
        row.id,
        { createdAt: row.createdAt, status: row.status },
      ]),
    );
  }
  async hotelGuestAges(
    snapshot: SalesReservationRequestV1,
    actor: AuthenticatedActor,
  ): Promise<number[] | null> {
    if (
      !actor.permissions.includes('reservations.read') ||
      !snapshot.hotelSelection
    )
      return null;
    const hotel = snapshot.hotelSelection;
    const row = await this.database.client.salesContract.findFirst({
      where: {
        id: snapshot.contractId,
        branchId: { in: [...actor.branchIds] },
        status: { not: 'CANCELLED' },
      },
      include: {
        hotelSelection: { include: { rooms: { orderBy: { ordinal: 'asc' } } } },
        passengers: {
          include: { allocations: { include: { service: true } } },
        },
      },
    });
    const current = row?.hotelSelection;
    const currentCounts = current?.rooms?.length
      ? salesHotelRoomSummary(
          current.rooms.map((r) => ({
            adults: r.adults,
            childAges: r.childAges as number[],
          })),
        )
      : current;
    const snapshotCounts = hotel.rooms?.length
      ? salesHotelRoomSummary(hotel.rooms)
      : hotel;
    if (
      !row ||
      !current ||
      current.hotelId !== hotel.hotelId ||
      current.roomTypeId !== hotel.roomTypeId ||
      currentCounts?.roomCount !== snapshotCounts.roomCount ||
      JSON.stringify(
        (current.rooms ?? []).map((r) => ({
          ordinal: r.ordinal,
          roomTypeId: r.roomTypeId,
          adults: r.adults,
          childAges: r.childAges,
        })),
      ) !==
        JSON.stringify(
          (hotel.rooms ?? []).map((r) => ({
            ordinal: r.ordinal,
            roomTypeId: r.roomTypeId,
            adults: r.adults,
            childAges: r.childAges,
          })),
        ) ||
      current.mealServiceId !== (hotel.mealServiceId ?? null) ||
      (currentCounts?.singleRoomCount ?? 0) !==
        (snapshotCounts.singleRoomCount ?? 0) ||
      (currentCounts?.doubleRoomCount ?? snapshotCounts.roomCount) !==
        (snapshotCounts.doubleRoomCount ?? snapshotCounts.roomCount) ||
      (currentCounts?.extraBedCount ?? 0) !==
        (snapshotCounts.extraBedCount ?? 0) ||
      current.checkInDate.toISOString().slice(0, 10) !== hotel.checkInDate ||
      current.checkOutDate.toISOString().slice(0, 10) !== hotel.checkOutDate
    )
      return null;
    const ids = snapshot.passengerAssignments
      ?.filter((p) => p.serviceClientKeys.includes(hotel.serviceClientKey))
      .map((p) => p.customerId);
    if (!ids?.length) return null;
    const guests = row.passengers.filter((p) =>
      p.allocations.some((a) => a.service.clientKey === hotel.serviceClientKey),
    );
    if (
      guests.length !== ids.length ||
      guests.some((p) => !ids.includes(p.customerId))
    )
      return null;
    const ages = guests.map((p) =>
      hotelAgeOn(
        p.birthDate?.toISOString().slice(0, 10) ?? '',
        hotel.checkInDate,
      ),
    );
    return ages.some((age) => age === null) ? null : (ages as number[]);
  }
  async read(
    ids: readonly string[],
    actor: AuthenticatedActor,
  ): Promise<Map<string, ReservationTableSummaryV1>> {
    if (!actor.permissions.includes('reservations.read') || !ids.length)
      return new Map();
    const rows = await this.database.client.salesContract.findMany({
      where: { id: { in: [...ids] }, branchId: { in: [...actor.branchIds] } },
      include: {
        passengers: true,
        priceComponents: true,
        payments: true,
        ticketSelections: true,
        hotelSelection: true,
        auditEvents: {
          where: {
            outcome: 'SUCCESS',
            action: {
              in: ['SALES_PASSENGER_CORRECTION', 'SALES_PASSENGER_COMPLETION'],
            },
          },
          orderBy: { occurredAt: 'desc' },
          take: 1,
        },
      },
    });
    const financial = actor.permissions.some((p) =>
      [
        'sales.payments.read',
        'finance.financial_release.read',
        'finance.financial_release.approve',
      ].includes(p),
    );
    return new Map(
      await Promise.all(
        rows.map(async (row) => {
          const prices = row.priceComponents.map((p) => ({
            type: p.type,
            title: p.title,
            amount: p.amount.toString(),
            currencyCode: p.currencyCode,
          }));
          const balances = calculateSalesBalances(
            prices,
            row.payments.map((p) => ({
              amount: p.amount.toString(),
              currencyCode: p.currencyCode,
              status: p.status,
            })),
          );
          const foreign = (key: 'amount' | 'outstanding') =>
            balances
              .filter((p) => p.currencyCode !== 'IRR')
              .map((p) => p[key] + ' ' + p.currencyCode)
              .join(' / ') || null;
          const discounts = new Map<string, Prisma.Decimal>();
          for (const p of row.priceComponents.filter(
            (p) => p.type === 'DISCOUNT',
          ))
            discounts.set(
              p.currencyCode,
              (discounts.get(p.currencyCode) ?? new Prisma.Decimal(0)).add(
                p.amount,
              ),
            );
          const at = row.hotelSelection?.checkInDate ?? row.departureDate;
          const counts = {
            adults: 0,
            children2To6: 0,
            children6To12: 0,
            infants: 0,
          };
          for (const person of row.passengers) {
            const birth = person.birthDate;
            const age = birth
              ? at.getUTCFullYear() -
                birth.getUTCFullYear() -
                (at.getUTCMonth() < birth.getUTCMonth() ||
                (at.getUTCMonth() === birth.getUTCMonth() &&
                  at.getUTCDate() < birth.getUTCDate())
                  ? 1
                  : 0)
              : null;
            if (person.ageCategory === 'INF') counts.infants++;
            else if (person.ageCategory === 'ADT') counts.adults++;
            else if (person.ageCategory === 'CHD') {
              if (age !== null && age < 6) counts.children2To6++;
              else if (age !== null) counts.children6To12++;
            } else if (age !== null && age < 2) counts.infants++;
            else if (age !== null && age < 6) counts.children2To6++;
            else if (age !== null && age < 12) counts.children6To12++;
            else counts.adults++;
          }
          const outbound = row.ticketSelections.find(
            (t) => t.direction === 'OUTBOUND',
          );
          const returning = row.ticketSelections.find(
            (t) => t.direction === 'RETURN',
          );
          const commissions = await this.tickets.reservationCommissions(
            row.ticketSelections.map((t) => t.offerId),
            returning?.offerId ?? null,
            row.createdAt,
            actor.branchIds,
          );
          const pair = commissions.find(
            (c) =>
              c.returnOfferId === returning?.offerId &&
              c.offerId === outbound?.offerId,
          );
          const commission = pair
            ? pair.percent + '%'
            : [
                ...new Set(
                  commissions
                    .filter((c) => !c.returnOfferId)
                    .map((c) => c.percent + '%'),
                ),
              ].join(' / ') || null;
          return [
            row.id,
            {
              contractPartyName: row.customerNameSnapshot,
              passengerNames: row.passengers.flatMap((person) =>
                person.displayNameSnapshot?.trim()
                  ? [person.displayNameSnapshot]
                  : [],
              ),
              createdAt: row.createdAt.toISOString(),
              contractVersion: row.version,
              correctedAt: row.auditEvents[0]?.occurredAt.toISOString() ?? null,
              cancelledAt:
                row.status === 'CANCELLED'
                  ? (row.cancelledAt?.toISOString() ?? null)
                  : null,
              departureDate:
                outbound?.departureAt.toISOString() ??
                row.departureDate.toISOString().slice(0, 10),
              returnDate:
                returning?.departureAt.toISOString() ??
                row.hotelSelection?.checkOutDate.toISOString().slice(0, 10) ??
                null,
              passengerCount: row.passengers.length,
              ...counts,
              saleRial:
                balances.find((b) => b.currencyCode === 'IRR')?.amount ?? null,
              saleForeign: foreign('amount'),
              currencies: balances.map((b) => b.currencyCode).join(' / '),
              discount:
                [...discounts]
                  .map(([c, a]) => a.toString() + ' ' + c)
                  .join(' / ') || null,
              commission,
              debtRial: financial
                ? (balances.find((b) => b.currencyCode === 'IRR')
                    ?.outstanding ?? null)
                : null,
              debtForeign: financial ? foreign('outstanding') : null,
            } satisfies ReservationTableSummaryV1,
          ] as const;
        }),
      ),
    );
  }
}
@Module({
  imports: [TicketRuntimeModule],
  providers: [SalesReservationTableService],
  exports: [SalesReservationTableService],
})
export class SalesReservationTableModule {}
