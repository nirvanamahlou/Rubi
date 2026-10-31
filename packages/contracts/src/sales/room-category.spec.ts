import { expect, it } from 'vitest';
import {
  defaultSalesRoomCategory,
  salesHotelRoomSummary,
  salesRoomCategories,
  salesRoomDisplayName,
  validSalesHotelRooms,
} from './hotel-rooms';
it('offers occupancy categories and prints the selected category beside the unchanged type', () => {
  expect(salesRoomCategories(1)).toEqual(['SINGLE']);
  expect(salesRoomCategories(2)).toEqual(['DOUBLE']);
  expect(salesRoomCategories(3)).toEqual(['TRIPLE', 'FAMILY', 'DOUBLE_EXTRA']);
  expect(salesRoomCategories(5)).toEqual(['FAMILY', 'DOUBLE_EXTRA']);
  const room = {
    ordinal: 1,
    roomTypeId: '11111111-1111-4111-8111-111111111111',
    roomTypeNameSnapshot: 'Deluxe Room',
    adults: 3,
    childAges: [],
    roomCategory: 'TRIPLE' as const,
  };
  expect(validSalesHotelRooms([room], 1)).toBe(true);
  expect(salesRoomDisplayName(room)).toBe('Deluxe Room · Triple');
  expect(validSalesHotelRooms([{ ...room, adults: 2 }], 1)).toBe(false);
  expect(validSalesHotelRooms([{ ...room, roomCategory: 'INVALID' }], 1)).toBe(
    false,
  );
  expect(validSalesHotelRooms([{ ...room, roomCategory: undefined }], 1)).toBe(
    true,
  );
  expect(
    salesRoomDisplayName({ ...room, adults: 5, roomCategory: 'DOUBLE_EXTRA' }),
  ).toBe('Deluxe Room · Double + 3 Extra Bed');
});

it('defaults by adults without adding child beds and preserves valid manual overrides', () => {
  const room = { adults: 2, childAges: [5, 8] };
  expect(defaultSalesRoomCategory(room)).toBe('DOUBLE');
  expect(salesRoomCategories(2, 2)).toEqual([
    'DOUBLE',
    'DOUBLE_EXTRA',
    'FAMILY',
  ]);
  expect(
    defaultSalesRoomCategory({ ...room, roomCategory: 'DOUBLE_EXTRA' }),
  ).toBe('DOUBLE_EXTRA');
  expect(defaultSalesRoomCategory({ ...room, roomCategory: 'TRIPLE' })).toBe(
    'DOUBLE',
  );
  expect(defaultSalesRoomCategory({ ...room, adults: 3 })).toBe('TRIPLE');
  expect(defaultSalesRoomCategory({ ...room, adults: 4 })).toBe('FAMILY');
  expect(
    salesRoomDisplayName({
      ...room,
      ordinal: 1,
      roomTypeId: 'r',
      roomTypeNameSnapshot: 'Deluxe',
      roomCategory: 'DOUBLE_EXTRA',
    }),
  ).toBe('Deluxe · Double + 1 Extra Bed');
});

it('does not count child beds for a double room, while respecting explicit extra beds', () => {
  expect(
    salesHotelRoomSummary([
      { adults: 2, childAges: [5], roomCategory: 'DOUBLE' },
    ]).extraBedCount,
  ).toBe(0);
  expect(
    salesHotelRoomSummary([
      { adults: 2, childAges: [5], roomCategory: 'DOUBLE_EXTRA' },
    ]).extraBedCount,
  ).toBe(1);
});

it('offers and validates Family for two adults with children without changing defaults or solo rules', () => {
  for (const childAges of [[5], [5, 8], [0, 5, 14]]) {
    const room = {
      ordinal: 1,
      roomTypeId: '11111111-1111-4111-8111-111111111111',
      roomTypeNameSnapshot: 'Standard',
      adults: 2,
      childAges,
      roomCategory: 'FAMILY' as const,
    };
    expect(salesRoomCategories(2, childAges.length)).toContain('FAMILY');
    expect(validSalesHotelRooms([room], 1)).toBe(true);
    expect(defaultSalesRoomCategory(room)).toBe('FAMILY');
    expect(defaultSalesRoomCategory({ ...room, roomCategory: undefined })).toBe(
      'DOUBLE',
    );
    expect(salesRoomDisplayName(room)).toBe('Standard · Family');
    expect(validSalesHotelRooms([{ ...room, childAges: [] }], 1)).toBe(false);
    expect(validSalesHotelRooms([{ ...room, adults: 1 }], 1)).toBe(false);
    expect(validSalesHotelRooms([{ ...room, childAges: [15] }], 1)).toBe(false);
  }
});
