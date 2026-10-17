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
