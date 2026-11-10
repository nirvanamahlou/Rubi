import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { packageRoomCode, type PackagePublishedSaleV1 } from '@nora/contracts';
import {
  applyCombinedPublishedSale,
  CombinedPublishedPicker,
  combinedSaleMatchesState,
} from './combined-published-picker';
import { emptySalesForm } from '../model/sales-form';

const price = {
  publicationId: 'pub',
  hotelId: 'hotel-0',
  hotelName: 'Hotels',
  roomTypeName: 'Rooms',
  roomCode: packageRoomCode({
    roomTypeId: 'room-0',
    adults: 2,
    childAges: [],
    board: 'BB',
  }),
  checkIn: '2026-11-01',
  checkOut: '2026-11-03',
  prices: [{ currencyCode: 'EUR', amount: '750' }],
  stays: [0, 1, 2].map((i) => ({
    hotelId: `hotel-${i}`,
    hotelName: `Hotel ${i}`,
    cityId: `city-${i}`,
    checkIn: `2026-11-0${1 + i * 2}`,
    checkOut: `2026-11-0${3 + i * 2}`,
    roomTypeId: `room-${i}`,
    roomTypeName: `Room ${i}`,
    roomCode: packageRoomCode({
      roomTypeId: `room-${i}`,
      adults: 2,
      childAges: [],
      board: 'BB',
    }),
  })),
} satisfies PackagePublishedSaleV1;
it('applies all three hotels and exact consecutive dates with each stay room type', () => {
  const before = JSON.stringify(emptySalesForm);
  const next = applyCombinedPublishedSale(emptySalesForm, price);
  expect(next.hotel.additionalStays?.map((s) => s.hotelId)).toEqual([
    'hotel-1',
    'hotel-2',
  ]);
  expect(
    next.hotel.additionalStays?.map((s) => s.rooms?.[0]?.roomTypeId),
  ).toEqual(['room-1', 'room-2']);
  expect(next.hotel.checkOut).toBe('2026-11-03');
  expect(next.hotel.additionalStays?.at(-1)?.checkOutDate).toBe('2026-11-07');
  expect(combinedSaleMatchesState(price, next)).toBe(true);
  expect(
    combinedSaleMatchesState(price, {
      ...next,
      hotel: { ...next.hotel, additionalStays: [] },
    }),
  ).toBe(false);
  expect(JSON.stringify(emptySalesForm)).toBe(before);
  const html = renderToStaticMarkup(
    <CombinedPublishedPicker
      catalog={[price]}
      state={next}
      onChange={() => undefined}
    />,
  );
  expect(html).toContain('Hotel 2');
  expect(html).toContain('750 EUR');
});
