import { randomUUID } from 'node:crypto';
import type { DatabaseClient } from '@nora/database';
import { reportingCityCountries } from '../../master-data/reporting-cities.public';
import { readReservationReportingCancellations } from '../../reservations/reservation-reporting-cancellations.public';
import type { AgentScope } from './query.service';

export async function readHotelRanking(
  database: DatabaseClient,
  scope: AgentScope,
  start: Date,
  end: Date,
) {
  const observedAt = new Date();
  return database.$transaction(
    async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      await tx.$executeRaw`SET LOCAL statement_timeout = '5000ms'`;
      const stay = {
        hotelId: true,
        cityId: true,
        hotelNameSnapshot: true,
      } as const;
      const selections = await tx.salesContractHotelSelection.findMany({
        where: {
          contract: {
            hiddenAt: null,
            status: {
              in: [
                'CONFIRMED',
                'SENT_TO_RESERVATIONS',
                'IN_PROGRESS',
                'COMPLETED',
              ],
            },
            createdAt: { gte: start, lt: end },
            confirmedAt: { lte: observedAt },
            ...(scope.companyId ? { legalEntityId: scope.companyId } : {}),
            ...(scope.mode !== 'all'
              ? { branchId: { in: [...scope.branchIds] } }
              : {}),
            ...(scope.mode === 'own' ? { ownerUserId: scope.userId } : {}),
          },
        },
        select: {
          ...stay,
          contractId: true,
          additionalStays: { select: stay },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: 10001,
      });
      if (selections.length > 10000) throw new Error('HOTEL_SOURCE_LIMIT');
      const cancelled = await readReservationReportingCancellations(
        tx,
        selections.map(({ contractId }) => contractId),
      );
      const eligible = selections.filter(
        ({ contractId }) => !cancelled.has(contractId),
      );
      const countries = await reportingCityCountries(
        tx,
        eligible.flatMap((row) => [
          row.cityId,
          ...row.additionalStays.map((stay) => stay.cityId),
        ]),
      );
      const totals = new Map<
        string,
        {
          country: string;
          countryId: string;
          hotel: string;
          contracts: Set<string>;
        }
      >();
      let missing = 0;
      for (const selection of eligible) {
        for (const row of [selection, ...selection.additionalStays]) {
          const country = countries.get(row.cityId);
          const hotel = row.hotelNameSnapshot.trim();
          if (!country || !hotel) {
            missing++;
            continue;
          }
          const key = country.id + ':' + row.hotelId;
          const total = totals.get(key) ?? {
            country: country.name,
            countryId: country.id,
            hotel,
            contracts: new Set<string>(),
          };
          total.contracts.add(selection.contractId);
          totals.set(key, total);
        }
      }
      const perCountry = new Map<string, number>();
      const ranked = [...totals.values()].sort(
        (a, b) =>
          a.country.localeCompare(b.country, 'fa') ||
          b.contracts.size - a.contracts.size ||
          a.hotel.localeCompare(b.hotel, 'fa'),
      );
      const rows = ranked
        .filter((row) => {
          const count = (perCountry.get(row.countryId) ?? 0) + 1;
          perCountry.set(row.countryId, count);
          return count <= 5;
        })
        .map((row) => ({
          country: row.country,
          hotel: row.hotel,
          count: row.contracts.size,
        }));
      return {
        version: 1,
        resultId: randomUUID(),
        observedAt: observedAt.toISOString(),
        rows: rows.slice(0, 60),
        truncated: rows.length > 60,
        missing,
      };
    },
    { isolationLevel: 'RepeatableRead', timeout: 7000 },
  );
}
