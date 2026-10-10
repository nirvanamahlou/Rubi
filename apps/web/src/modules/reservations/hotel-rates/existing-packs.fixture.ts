import type { HotelOccupancyRateV1 } from '@nora/contracts';
import type { PackDetail } from './packs-workspace';

export const savedRate: HotelOccupancyRateV1 = {
  composition: '2 AD + 1 CHD',
  adults: 2,
  childAges: [{ min: 3, maxExclusive: 7 }],
  startsOn: '2026-10-01',
  endsOnExclusive: '2026-10-04',
  currencyCode: 'EUR',
  amount: '123.456789012',
  board: 'BB',
};
export function savedPack(): PackDetail {
  return {
    id: 'pack-1',
    branchId: 'branch-1',
    cityId: 'city-1',
    cityName: 'آنتالیا',
    checkIn: '2026-10-01',
    checkOut: '2026-10-04',
    currency: 'EUR',
    method: 'STAY',
    version: 3,
    batchId: 'batch-3',
    tourDepartureId: 'tour-1',
    rows: ['هتل رویال', 'هتل دوم'].map((name, i) => ({
      hotelId: `hotel-${i}`,
      hotelName: name,
      brokerId: `broker-${i}`,
      brokerName: 'کارگزار',
      base: '20.1234',
      currency: 'EUR',
      factors: { double: '1' } as PackDetail['rows'][number]['factors'],
      roomRates: [
        {
          roomTypeId: `room-${i}`,
          roomTypeName: 'استاندارد',
          factor: '1',
          maxAdults: 2,
          maxChildren: 1,
          maxChildren2To6: 1,
          maxChildren6To12: 0,
          maxInfants: 0,
          ...(i === 0 ? { occupancyRates: [savedRate] } : {}),
        },
      ],
    })),
  };
}
