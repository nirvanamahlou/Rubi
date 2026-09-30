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
              in: ['sales.contract.updated', 'OPERATIONAL_FORM_AMENDMENT'],
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
            const age =
              at.getUTCFullYear() -
              birth.getUTCFullYear() -
              (at.getUTCMonth() < birth.getUTCMonth() ||
              (at.getUTCMonth() === birth.getUTCMonth() &&
                at.getUTCDate() < birth.getUTCDate())
                ? 1
                : 0);
            if (age < 2) counts.infants++;
            else if (age < 6) counts.children2To6++;
            else if (age < 12) counts.children6To12++;
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
