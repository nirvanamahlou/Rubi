import { expect, it } from 'vitest';
import { hotelMealLabel, queueMealName } from './queue-meal';
import { reservationExportRows } from './reservation-table';
import type { RequestView } from './model';

it('reads hotel meal codes, keeping multiple actual services and deduplicating them', () => {
  expect(hotelMealLabel({ mealServiceCodes: 'UALL' })).toBe('UALL');
  expect(hotelMealLabel({ mealServiceCodes: ' BB, HB,BB ' })).toBe('BB / HB');
  expect(hotelMealLabel({ mealServiceNames: 'صبحانه' })).toBe('صبحانه');
  expect(hotelMealLabel({})).toBe('');
});
it('uses the selected hotel for old contracts without a meal selection and exports the same value', () => {
  const row = {
    hotelId: 'hotel',
    services: [],
    status: 'NEW',
  } as unknown as RequestView;
  const mealServiceName = queueMealName(row, { 'hotel-meals:hotel': 'UALL' });
  expect(mealServiceName).toBe('UALL');
  expect(reservationExportRows([{ ...row, mealServiceName }])[1]?.[17]).toBe(
    'UALL',
  );
});
it('preserves an explicit contract service and does not silently substitute another on failed lookup', () => {
  const row = { hotelId: 'hotel', mealServiceId: 'meal' } as RequestView;
  expect(
    queueMealName(row, {
      'hotel-meals:hotel': 'UALL',
      'meal-services:meal': 'BB',
    }),
  ).toBe('BB');
  expect(queueMealName(row, { 'hotel-meals:hotel': 'UALL' })).toBeUndefined();
});
