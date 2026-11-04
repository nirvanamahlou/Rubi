import { expect, it } from 'vitest';
import { reservationRoomCategoryCounts } from './room-category-counts';

it('classifies registered categories, independently of child counts or adult extra-bed quantities', () => {
  expect(
    reservationRoomCategoryCounts([
      { adults: 1, childAges: [4], roomCategory: 'SINGLE' },
      { adults: 2, childAges: [5, 8], roomCategory: 'DOUBLE' },
      { adults: 5, childAges: [6], roomCategory: 'DOUBLE_EXTRA' },
      { adults: 3, childAges: [], roomCategory: 'TRIPLE' },
      { adults: 4, childAges: [7], roomCategory: 'FAMILY' },
    ]),
  ).toEqual({
    roomCount: 5,
    singleRoomCount: 1,
    doubleRoomCount: 2,
    extraBedCount: 1,
    familyTripleRoomCount: 2,
  });
});

it('defaults uncategorized legacy products by adults, never assigning extra beds from children', () => {
  expect(
    reservationRoomCategoryCounts([
      { adults: 1, childAges: [4, 8] },
      { adults: 2, childAges: [5, 8] },
      { adults: 3, childAges: [7] },
      { adults: 4, childAges: [] },
    ]),
  ).toEqual({
    roomCount: 4,
    singleRoomCount: 1,
    doubleRoomCount: 1,
    extraBedCount: 0,
    familyTripleRoomCount: 2,
  });
});
