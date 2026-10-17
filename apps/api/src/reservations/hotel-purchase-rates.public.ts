import { hotelRoomCapacityCombinations } from '@nora/contracts';
import { hotelRateBrokerId } from './hotel-rate-broker-reference';
import {
  BadRequestException,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import type {
  HotelRegisteredPeriodsQueryV1,
  HotelRegisteredPeriodsPageV1,
  HotelRoomRateV1,
  HotelOccupancyRateV1,
  PackageTourHotelPurchaseBatchV1,
} from '@nora/contracts';
import { MasterTravelDirectory } from '../master-data/master-travel-directory';
import { Prisma } from '@nora/database';
import { DatabaseService } from '../database/database.service';

const dateOnly = (value: Date) => value.toISOString().slice(0, 10);

/** Public Reservations projection. Sales never reads the rate tables directly. */
@Injectable()
export class HotelPurchaseRatesPublicService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Optional()
    @Inject(MasterTravelDirectory)
    private readonly directory?: MasterTravelDirectory,
  ) {}

  async registeredPeriods(
    branchIds: readonly string[],
    query: HotelRegisteredPeriodsQueryV1,
  ): Promise<HotelRegisteredPeriodsPageV1> {
    const page = query.page ?? 1;
    if (!branchIds.length)
      return { version: 1, data: [], total: 0, page, pageSize: 50 };
    const cityIds =
      await this.database.client.reservationHotelRatePack.findMany({
        where: {
          branchId: { in: [...branchIds] },
          archivedAt: null,
          ...(query.from ? { checkOut: { gt: new Date(query.from) } } : {}),
          ...(query.to ? { checkIn: { lte: new Date(query.to) } } : {}),
        },
        select: { cityId: true },
        distinct: ['cityId'],
        take: 501,
      });
    if (cityIds.length > 500)
      throw new BadRequestException(
        'برای نمایش بازه‌ها، شعبه یا تاریخ را محدودتر کنید.',
      );
    if (cityIds.length && !this.directory)
      throw new BadRequestException('سرویس اطلاعات شهر در دسترس نیست.');
    const cities = cityIds.length
      ? await this.directory!.hotelRatePeriodCityNames(
          cityIds.map((row) => row.cityId),
        )
      : [];
    const cityNames = new Map(cities.map((city) => [city.id, city.name]));
    const search = (query.search ?? '').trim();
    const predicates = [
      Prisma.sql`p."branchId" IN (${Prisma.join(branchIds.map((id) => Prisma.sql`${id}::uuid`))})`,
      Prisma.sql`p."archivedAt" IS NULL`,
    ];
    if (query.from)
      predicates.push(Prisma.sql`b."checkOut" > ${query.from}::date`);
    if (query.to) predicates.push(Prisma.sql`b."checkIn" <= ${query.to}::date`);
    const cityMatches = cities
      .filter((city) =>
        [city.name, city.englishName].some((name) =>
          name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
        ),
      )
      .map((city) => city.id);
    if (search)
      predicates.push(
        Prisma.sql`(strpos(lower(r."hotelName"),lower(${search}))>0 OR strpos(lower(r."brokerName"),lower(${search}))>0 OR ${cityMatches.length ? Prisma.sql`p."cityId" IN (${Prisma.join(cityMatches.map((id) => Prisma.sql`${id}::uuid`))})` : Prisma.sql`FALSE`})`,
      );
    const result = await this.database.client.$queryRaw<
      { total: number; data: HotelRegisteredPeriodsPageV1['data'] }[]
    >(Prisma.sql`
      WITH filtered AS (
        SELECT r.id AS "hotelRateId", p.id AS "packId", b.id AS "batchId", p."branchId",p."cityId",
          r."hotelId",r."hotelName",r."brokerName",r.currency AS "currencyCode",
          to_char(b."checkIn",'YYYY-MM-DD') AS "checkIn",to_char(b."checkOut",'YYYY-MM-DD') AS "checkOut",b.version,
          b."tourDepartureId", EXISTS(SELECT 1 FROM reservation_hotel_rate_pack_sources s WHERE s."packId"=p.id) AS "sharedPeriod"
        FROM reservation_hotel_rate_packs p
        JOIN reservation_hotel_rate_batches b ON b."packId"=p.id AND b.version=p."currentVersion" AND b."branchId"=p."branchId" AND b."cityId"=p."cityId"
        JOIN reservation_hotel_group_rates r ON r."batchId"=b.id
        WHERE ${Prisma.join(predicates, ' AND ')}
      )
      SELECT count(*)::int AS total,coalesce((SELECT json_agg(rows) FROM (
        SELECT * FROM filtered ORDER BY "checkIn" DESC,"checkOut" DESC,"hotelName","hotelRateId" LIMIT 50 OFFSET ${(page - 1) * 50}
      ) rows),'[]'::json) AS data FROM filtered
    `);
    return {
      version: 1,
      data: (result[0]?.data ?? []).map((row) => ({
        ...row,
        cityName: cityNames.get(row.cityId) ?? row.cityId,
      })),
      total: result[0]?.total ?? 0,
      page,
      pageSize: 50,
    };
  }

  async forTour(
    branchId: string,
    hotelIds: readonly string[],
    startsOn: string,
    endsOn: string,
    tourDepartureId?: string,
    cityId?: string,
    includeOccupancy = false,
    allMatches = false,
  ): Promise<readonly PackageTourHotelPurchaseBatchV1[]> {
    if (!hotelIds.length && !tourDepartureId && !cityId) return [];
    const start = new Date(`${startsOn}T00:00:00.000Z`);
    const end = new Date(`${endsOn}T00:00:00.000Z`);
    const batches =
      await this.database.client.reservationHotelRateBatch.findMany({
        where: {
          branchId,

          // Shared snapshots belong to package selection, not the source-rate
          // directory used by Sales to choose room tariffs.
          AND: [
            { OR: [{ packId: null }, { pack: { archivedAt: null } }] },
            ...(!cityId && !tourDepartureId
              ? [
                  {
                    OR: [
                      { packId: null },
                      { pack: { sourcePeriods: { none: {} } } },
                    ],
                  },
                ]
              : []),
          ],
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
          pack: {
            select: {
              currentVersion: true,
              sourcePeriods: { select: { sourceBatchId: true } },
            },
          },
          rows: {
            include: { roomRates: { orderBy: { roomTypeName: 'asc' } } },
            ...(cityId || tourDepartureId
              ? {}
              : { where: { hotelId: { in: [...hotelIds] } } }),
            orderBy: [{ hotelName: 'asc' }, { brokerName: 'asc' }],
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        ...(allMatches ? {} : { take: 200 }),
      });
    return batches
      .filter(
        (batch) => !batch.pack || batch.version === batch.pack.currentVersion,
      )
      .slice(0, allMatches ? undefined : 100)
      .map((batch) => ({
        id: batch.id,
        sharedPeriod: !!batch.pack?.sourcePeriods?.length,
        version: 1,
        branchId: batch.branchId,
        tourDepartureId: batch.tourDepartureId,
        checkIn: dateOnly(batch.checkIn),
        checkOut: dateOnly(batch.checkOut),
        method: batch.method as 'CHECK_IN' | 'STAY',
        currencyCode: batch.currency,
        observedAt: batch.createdAt.toISOString(),
        // Prisma loads this relation as an array, but a public projection must
        // also tolerate a minimal fixture or consumer response that omits it.
        rows: (batch.rows ?? [])
          .filter(
            (row) =>
              includeOccupancy ||
              !(row.roomRates ?? []).some((room) =>
                Array.isArray(room.occupancyRates),
              ),
          )
          .map((row) => ({
            id: row.id,
            version: 1,
            batchId: row.batchId,
            hotelId: row.hotelId,
            hotelName: row.hotelName,
            brokerId: hotelRateBrokerId(row),
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
              maxChildren2To6: room.maxChildren2To6,
              maxChildren6To12: room.maxChildren6To12,
              maxInfants: room.maxInfants,
              ...(Array.isArray(room.occupancyRates)
                ? {
                    occupancyRates:
                      room.occupancyRates as unknown as HotelOccupancyRateV1[],
                  }
                : {}),
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
      undefined,
      undefined,
      true,
      true,
    );
    const result = new Map<string, HotelRoomRateV1>();
    for (const batch of batches)
      for (const row of batch.rows)
        if (row.hotelId === input.hotelId)
          for (const room of row.roomRates) {
            const existing = result.get(room.roomTypeId);
            const combinations = hotelRoomCapacityCombinations(
              room.occupancyRates
                ? {
                    ...room,
                    occupancyRates: room.occupancyRates.filter(
                      (rate) =>
                        rate.startsOn < input.checkOut &&
                        rate.endsOnExclusive > input.checkIn,
                    ),
                  }
                : room,
            );
            const distinct = new Map(
              [...(existing?.capacityCombinations ?? []), ...combinations].map(
                (row) => {
                  const value = {
                    adults: row.adults,
                    childAges: [...row.childAges].sort(
                      (a, b) =>
                        a.min - b.min || a.maxExclusive - b.maxExclusive,
                    ),
                  };
                  return [JSON.stringify(value), value] as const;
                },
              ),
            );
            result.set(room.roomTypeId, {
              ...(existing ?? room),
              capacityCombinations: [...distinct.values()],
            });
          }
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
