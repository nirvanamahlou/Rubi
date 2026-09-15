import { Inject, Injectable } from '@nestjs/common';
import type { PackageTourHotelPurchaseBatchV1 } from '@nora/contracts';
import { DatabaseService } from '../database/database.service';

const dateOnly = (value: Date) => value.toISOString().slice(0, 10);

/** Public Reservations projection. Sales never reads the rate tables directly. */
@Injectable()
export class HotelPurchaseRatesPublicService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async forTour(
    branchId: string,
    hotelIds: readonly string[],
    startsOn: string,
    endsOn: string,
  ): Promise<readonly PackageTourHotelPurchaseBatchV1[]> {
    if (!hotelIds.length) return [];
    const start = new Date(`${startsOn}T00:00:00.000Z`);
    const end = new Date(`${endsOn}T00:00:00.000Z`);
    const batches =
      await this.database.client.reservationHotelRateBatch.findMany({
        where: {
          branchId,
          rows: { some: { hotelId: { in: [...hotelIds] } } },
          OR: [
            {
              method: 'CHECK_IN',
              checkIn: { lte: start },
              checkOut: { gt: start },
            },
            {
              method: 'STAY',
              checkIn: { lte: start },
              checkOut: { gte: end },
            },
          ],
        },
        include: {
          pack: { select: { currentVersion: true } },
          rows: {
            where: { hotelId: { in: [...hotelIds] } },
            orderBy: [{ hotelName: 'asc' }, { brokerName: 'asc' }],
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: 200,
      });
    return batches
      .filter(
        (batch) => !batch.pack || batch.version === batch.pack.currentVersion,
      )
      .slice(0, 100)
      .map((batch) => ({
        id: batch.id,
        version: 1,
        branchId: batch.branchId,
        checkIn: dateOnly(batch.checkIn),
        checkOut: dateOnly(batch.checkOut),
        method: batch.method as 'CHECK_IN' | 'STAY',
        currencyCode: batch.currency,
        observedAt: batch.createdAt.toISOString(),
        rows: batch.rows.map((row) => ({
          id: row.id,
          version: 1,
          batchId: row.batchId,
          hotelId: row.hotelId,
          hotelName: row.hotelName,
          brokerId: row.brokerId,
          brokerName: row.brokerName,
          basePerNight: row.base.toString(),
          factors: row.factors as Record<string, string>,
        })),
      }));
  }
}
