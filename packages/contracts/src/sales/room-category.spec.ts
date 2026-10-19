import { expect, it } from 'vitest';
import {
  salesRoomCategories,
  salesRoomDisplayName,
  validSalesHotelRooms,
} from './hotel-rooms';
it('offers occupancy categories and prints the selected category beside the unchanged type', () => {
  expect(salesRoomCategories(1)).toEqual(['SINGLE']);
  expect(salesRoomCategories(2)).toEqual(['DOUBLE']);
  expect(salesRoomCategories(3)).toEqual(['DOUBLE_EXTRA', 'TRIPLE']);
  expect(salesRoomCategories(5)).toEqual(['DOUBLE_EXTRA']);
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
