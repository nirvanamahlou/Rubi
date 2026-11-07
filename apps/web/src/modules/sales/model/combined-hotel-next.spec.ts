import { expect, it } from 'vitest';
import {
  salesHotelValid,
  salesHotelValidationError,
  withSalesHotelDates,
  salesPayload,
} from './sales-form';
import { combinedHotelDraft } from './combined-hotel-next.fixtures';

it('splits an automatic primary stay at the second hotel check-in and retains the split in the payload', () => {
  const next = combinedHotelDraft();
  const previous = structuredClone(next);
  previous.hotel.additionalStays![0]!.checkInDate = '';
  expect(salesHotelValid(next)).toBe(false);
  const ready = withSalesHotelDates(previous, next);
  expect(ready.hotel.checkOut).toBe('2099-01-04');
  expect(salesHotelValid(ready)).toBe(true);
  expect(salesPayload(ready).hotelSelection).toMatchObject({
    checkOutDate: '2099-01-04',
    additionalStays: [
      { checkInDate: '2099-01-04', checkOutDate: '2099-01-09' },
    ],
  });
});
it('follows a changed next-stay boundary without overwriting an explicitly manual primary checkout', () => {
  const previous = combinedHotelDraft();
  previous.hotel.checkOut = '2099-01-04';
  const next = structuredClone(previous);
  next.hotel.additionalStays![0]!.checkInDate = '2099-01-05';
  expect(withSalesHotelDates(previous, next).hotel.checkOut).toBe('2099-01-05');
  previous.hotel.checkOutManual = true;
  next.hotel.checkOutManual = true;
  expect(withSalesHotelDates(previous, next).hotel.checkOut).toBe('2099-01-04');
});
it('explains a manual overlap and accepts its explicit correction without weakening validation', () => {
  const next = combinedHotelDraft();
  next.hotel.checkOutManual = true;
  expect(withSalesHotelDates(next, next).hotel.checkOut).toBe('2099-01-09');
  expect(salesHotelValidationError(next)).toContain('خروج هتل قبلی');
  next.hotel.checkOut = '2099-01-04';
  expect(salesHotelValidationError(next)).toBeNull();
  next.hotel.additionalStays![0]!.rooms![0]!.roomTypeId = '';
  expect(salesHotelValidationError(next)).toContain('نوع اتاق');
});
it('still rejects incomplete, duplicate and reversed additional stays', () => {
  const state = combinedHotelDraft();
  state.hotel.checkOut = '2099-01-04';
  for (const patch of [
    { checkOutDate: '2099-01-03' },
    { hotelId: 'one' },
    { cityId: '' },
    { checkInDate: '' },
  ]) {
    const next = structuredClone(state);
    Object.assign(next.hotel.additionalStays![0]!, patch);
    expect(salesHotelValid(next)).toBe(false);
    expect(salesHotelValidationError(next)).toBeTruthy();
  }
});
