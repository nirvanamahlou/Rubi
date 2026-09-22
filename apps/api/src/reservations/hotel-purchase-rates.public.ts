import { Inject, Injectable } from '@nestjs/common';
import type {
  HotelRoomRateV1,
  PackageTourHotelPurchaseBatchV1,
} from '@nora/contracts';
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
    tourDepartureId?: string,
    cityId?: string,
  ): Promise<readonly PackageTourHotelPurchaseBatchV1[]> {
    if (!hotelIds.length && !tourDepartureId && !cityId) return [];
    const start = new Date(`${startsOn}T00:00:00.000Z`);
    const end = new Date(`${endsOn}T00:00:00.000Z`);
    const batches =
      await this.database.client.reservationHotelRateBatch.findMany({
        where: {
          branchId,
          ...(cityId
            ? { cityId }
            : tourDepartureId
              ? { tourDepartureId }
              : { rows: { some: { hotelId: { in: [...hotelIds] } } } }),
          ...(!cityId && tourDepartureId
            ? {}
            : {
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
              }),
        },
        include: {
          pack: { select: { currentVersion: true } },
          rows: {
            include: { roomRates: { orderBy: { roomTypeName: 'asc' } } },
            ...(cityId || tourDepartureId
              ? {}
              : { where: { hotelId: { in: [...hotelIds] } } }),
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
        tourDepartureId: batch.tourDepartureId,
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
          currencyCode: row.currency,
          factors: row.factors as Record<string, string>,
          roomRates: (row.roomRates ?? []).map((room) => ({
            roomTypeId: room.roomTypeId,
            roomTypeName: room.roomTypeName,
            factor: room.factor.toString(),
            maxAdults: room.maxAdults,
            maxChildren: room.maxChildren,
          })),
        })),
      }));
  }

  async availableRoomRates(input: {
    branchId: string;
    hotelId: string;
    checkIn: string;
    checkOut: string;
  }): Promise<readonly HotelRoomRateV1[]> {
    const batches = await this.forTour(
      input.branchId,
      [input.hotelId],
      input.checkIn,
      input.checkOut,
    );
    const result = new Map<string, HotelRoomRateV1>();
    for (const batch of batches)
      for (const row of batch.rows)
        if (row.hotelId === input.hotelId)
          for (const room of row.roomRates)
            if (!result.has(room.roomTypeId)) result.set(room.roomTypeId, room);
    return [...result.values()];
  }
  async roomAvailability(input: {
    branchId: string;
    hotelId: string;
    roomTypeId: string;
    checkIn: string;
    checkOut: string;
  }): Promise<HotelRoomRateV1 | null> {
    const rooms = await this.availableRoomRates(input);
    return (
      rooms.find((candidate) => candidate.roomTypeId === input.roomTypeId) ??
      null
    );
  }
}
