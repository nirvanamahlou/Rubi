import { validSalesHotelRooms } from '../src/sales/hotel-rooms';
import { flightRoomTotals } from '../src/sales/passenger-flight-prices';
import { expect, it } from 'vitest';
import { salesHotelRoomSummary } from '../src/sales/hotel-rooms';
it('counts room occupancy independently, including children, without allocating named travelers', () => {
  expect(
    salesHotelRoomSummary([
      { adults: 1, childAges: [] },
      { adults: 1, childAges: [7] },
      { adults: 3, childAges: [4] },
    ]),
  ).toEqual({
    roomCount: 3,
    singleRoomCount: 1,
    doubleRoomCount: 2,
    extraBedCount: 2,
    occupancy: 7,
  });
  expect(salesHotelRoomSummary([{ adults: 2, childAges: [2] }])).toMatchObject({
    singleRoomCount: 0,
    doubleRoomCount: 1,
    extraBedCount: 1,
  });
  expect(salesHotelRoomSummary([])).toEqual({
    roomCount: 0,
    singleRoomCount: 0,
    doubleRoomCount: 0,
    extraBedCount: 0,
    occupancy: 0,
  });
});

it('accepts a rial room price without currency conversion', () => {
  const room = {
    ordinal: 1,
    roomTypeId: '10000000-0000-4000-8000-000000000001',
    roomTypeNameSnapshot: 'Standard',
    adults: 2,
    childAges: [],
    agreedPrice: { amount: '1250000', currencyCode: 'IRR' },
  };
  expect(validSalesHotelRooms([room], 1)).toBe(true);
  expect(
    flightRoomTotals({ p: [{ amount: '250000', currencyCode: 'IRR' }] }, [
      room,
    ]),
  ).toEqual([{ amount: '1500000', currencyCode: 'IRR' }]);
});
