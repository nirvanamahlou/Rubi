import type { HotelOccupancyRateV1, HotelRoomRateV1 } from './index';
import { quoteHotelOccupancy } from './hotel-occupancy';

export interface HotelRatePeriodV1 {
  id: string;
  batchId: string;
  version: number;
  checkIn: string;
  checkOut: string;
  method: string;
  rows: {
    hotelId: string;
    hotelName: string;
    brokerId: string;
    brokerName: string;
    currency: string;
    roomRates: readonly HotelRoomRateV1[];
  }[];
}

export interface SharedHotelCandidateV1 {
  key: string;
  hotelId: string;
  hotelName: string;
  brokerId: string;
  brokerName: string;
  currency: string;
  sourceBatchIds: string[];
  roomRates: HotelRoomRateV1[];
  available: boolean;
}

export const validHotelStay = (from: string, to: string) => {
  const valid = (day: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(Date.parse(day)) &&
    new Date(day).toISOString().slice(0, 10) === day;
  return (
    valid(from) &&
    valid(to) &&
    to > from &&
    (Date.parse(to) - Date.parse(from)) / 86400000 <= 365
  );
};

/** Combine compatible nightly tariffs, never their unweighted averages.
 * Conflicting overlaps stay ambiguous and cannot yield a selectable hotel.
 */
export function sharedHotelCandidates(
  periods: readonly HotelRatePeriodV1[],
  checkIn: string,
  checkOut: string,
): SharedHotelCandidateV1[] {
  if (!validHotelStay(checkIn, checkOut)) return [];
  const candidates = new Map<string, SharedHotelCandidateV1>();
  for (const period of periods) {
    if (
      period.method !== 'STAY' ||
      period.checkIn >= checkOut ||
      period.checkOut <= checkIn
    )
      continue;
    for (const row of period.rows) {
      const key = [row.hotelId, row.brokerId, row.currency].join(':');
      let candidate = candidates.get(key);
      if (!candidate) {
        candidate = {
          ...row,
          key,
          sourceBatchIds: [],
          roomRates: [],
          available: false,
        };
        candidates.set(key, candidate);
      }
      candidate.sourceBatchIds.push(period.batchId);
      for (const room of row.roomRates) {
        const rates = (room.occupancyRates ?? []).flatMap((rate) => {
          const startsOn = [checkIn, period.checkIn, rate.startsOn]
            .sort()
            .at(-1)!;
          const endsOnExclusive = [
            checkOut,
            period.checkOut,
            rate.endsOnExclusive,
          ].sort()[0]!;
          if (startsOn >= endsOnExclusive || rate.currencyCode !== row.currency)
            return [];
          // A derived snapshot preserves amounts; original coefficients remain on
          // the source revision, whose exact FK is saved with the shared period.
          const value = { ...rate };
          delete value.manualPricing;
          return [{ ...value, startsOn, endsOnExclusive }];
        });
        if (!rates.length) continue;
        const existing = candidate.roomRates.find(
          (item) => item.roomTypeId === room.roomTypeId,
        );
        if (existing) {
          existing.occupancyRates = [
            ...(existing.occupancyRates ?? []),
            ...rates,
          ];
          existing.maxAdults = Math.min(existing.maxAdults, room.maxAdults);
          existing.maxChildren = Math.min(
            existing.maxChildren,
            room.maxChildren,
          );
          existing.maxChildren2To6 = Math.min(
            existing.maxChildren2To6 ?? 0,
            room.maxChildren2To6 ?? 0,
          );
          existing.maxChildren6To12 = Math.min(
            existing.maxChildren6To12 ?? 0,
            room.maxChildren6To12 ?? 0,
          );
          existing.maxInfants = Math.min(
            existing.maxInfants ?? 0,
            room.maxInfants ?? 0,
          );
        } else
          candidate.roomRates.push({
            ...room,
            factor: '1',
            occupancyRates: rates,
          });
      }
    }
  }
  for (const candidate of candidates.values()) {
    candidate.sourceBatchIds = [...new Set(candidate.sourceBatchIds)].sort();
    candidate.roomRates = candidate.roomRates.flatMap((room) => {
      const rates = room.occupancyRates ?? [];
      const shape = (rate: HotelOccupancyRateV1) =>
        JSON.stringify([
          rate.adults,
          [...rate.childAges].sort(
            (a, b) => a.min - b.min || a.maxExclusive - b.maxExclusive,
          ),
          rate.board,
        ]);
      const covered = new Set(
        rates
          .filter((rate) => {
            const matching = rates.filter(
              (other) => shape(other) === shape(rate),
            );
            // The advertised composition/age band itself must cover every night;
            // a narrower child band in another period is not a substitute.
            let end = checkIn;
            for (const part of [...matching].sort((a, b) =>
              a.startsOn.localeCompare(b.startsOn),
            )) {
              if (part.startsOn > end) break;
              if (part.endsOnExclusive > end) end = part.endsOnExclusive;
            }
            return (
              end >= checkOut &&
              ['PURCHASE', 'SALE'].every(
                (priceBasis) =>
                  quoteHotelOccupancy(rates, {
                    checkIn,
                    checkOut,
                    adults: rate.adults,
                    childAges: rate.childAges.map((age) => age.min),
                    rooms: 1,
                    currencyCode: candidate.currency,
                    board: rate.board,
                    priceBasis: priceBasis as 'PURCHASE' | 'SALE',
                  }) !== null,
              )
            );
          })
          .map(shape),
      );
      const complete = rates.filter((rate) => covered.has(shape(rate)));
      return complete.length ? [{ ...room, occupancyRates: complete }] : [];
    });
    candidate.available =
      candidate.roomRates.length > 0 &&
      new Set(
        candidate.roomRates.flatMap((room) =>
          (room.occupancyRates ?? []).map((rate) => rate.board),
        ),
      ).size === 1;
  }
  return [...candidates.values()].sort(
    (a, b) =>
      a.hotelName.localeCompare(b.hotelName) || a.key.localeCompare(b.key),
  );
}
