import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  salesRoomCategories,
  type SalesHotelSelectionInput,
  type MasterDataRecord,
} from '@nora/contracts';
import {
  AmendmentHotelRooms,
  updateAmendmentRooms,
} from './amendment-hotel-rooms';
const hotel: SalesHotelSelectionInput = {
  hotelId: 'h',
  hotelNameSnapshot: 'Synthetic Hotel',
  cityId: 'city',
  serviceClientKey: 'hotel',
  checkInDate: '2027-01-01',
  checkOutDate: '2027-01-03',
  roomTypeId: 'saved',
  roomCount: 2,
  occupancy: 4,
  inventoryStatus: 'NEEDS_RESERVATION_CONFIRMATION',
  rooms: [
    {
      ordinal: 1,
      roomTypeId: 'saved',
      roomTypeNameSnapshot: 'Saved Deluxe',
      adults: 3,
      childAges: [],
      roomCategory: 'TRIPLE',
      agreedPrice: { amount: '300', currencyCode: 'USD' },
    },
    {
      ordinal: 2,
      roomTypeId: 'single',
      roomTypeNameSnapshot: 'Standard',
      adults: 1,
      childAges: [],
      roomCategory: 'SINGLE',
    },
  ],
};
it('uses the saved rooms and the same category choices as contract creation, including archived types', () => {
  const html = renderToStaticMarkup(
    <AmendmentHotelRooms
      hotel={hotel}
      roomTypes={[]}
      currencies={[]}
      onChange={() => undefined}
    />,
  );
  expect(html).toContain('Saved Deluxe');
  expect(html).toContain('Triple');
  expect(html).toContain('Single');
  expect(salesRoomCategories(3)).toContain(hotel.rooms![0]!.roomCategory);
  expect(html).toContain('دسته‌بندی اتاق');
});
it('updates the first room FK, snapshot and aggregate counts together while preserving dates and explicit prices', () => {
  const next = updateAmendmentRooms(hotel, [
    {
      ...hotel.rooms![0]!,
      roomTypeId: 'new',
      roomTypeNameSnapshot: 'New Suite',
      adults: 2,
      roomCategory: 'DOUBLE_EXTRA',
      childAges: [5],
    },
  ]);
  expect(next).toMatchObject({
    roomTypeId: 'new',
    roomCount: 1,
    occupancy: 3,
    doubleRoomCount: 1,
    extraBedCount: 1,
    checkInDate: hotel.checkInDate,
  });
  expect(next.rooms![0]).toMatchObject({
    ordinal: 1,
    roomTypeNameSnapshot: 'New Suite',
    roomCategory: 'DOUBLE_EXTRA',
    agreedPrice: { amount: '300', currencyCode: 'USD' },
  });
  expect(hotel.rooms).toHaveLength(2);
});
it('falls back to the public type selector for contracts predating per-room composition', () => {
  const legacy = { ...hotel };
  delete legacy.rooms;
  const html = renderToStaticMarkup(
    <AmendmentHotelRooms
      hotel={legacy}
      roomTypes={[{ id: 'saved', name: 'Saved Deluxe' } as MasterDataRecord]}
      currencies={[]}
      onChange={() => undefined}
    />,
  );
  expect(html).toContain('Saved Deluxe');
  expect(html).not.toContain('حذف اتاق');
});
