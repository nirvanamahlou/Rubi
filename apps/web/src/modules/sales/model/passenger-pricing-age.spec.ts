import { expect, it } from 'vitest';
import { emptySalesForm } from './sales-form';
import { passengerPricingAgeLabel } from './passenger-pricing-age';

const state = { ...emptySalesForm, departureDate: '2026-10-19' };
it.each([
  ['2024-10-20', 'نوزاد'],
  ['2024-10-19', 'کودک (2-6)'],
  ['2020-10-20', 'کودک (2-6)'],
  ['2020-10-19', 'کودک (6-12)'],
  ['2014-10-19', 'بزرگسال'],
])('shows the pricing age band for birth date %s', (birthDate, expected) => {
  expect(
    passengerPricingAgeLabel(state, {
      customerId: 'p',
      displayName: 'Guest',
      birthDate,
    }),
  ).toBe(expected);
});
it('uses hotel check-in for children whose birthday follows the flight', () => {
  expect(
    passengerPricingAgeLabel(
      {
        ...state,
        serviceKinds: ['HOTEL', 'FLIGHT'],
        hotel: { ...state.hotel, checkIn: '2026-10-26' },
      },
      { customerId: 'p', displayName: 'Guest', birthDate: '2020-10-25' },
    ),
  ).toBe('کودک (6-12)');
});
it('shows saved child bands without inventing a birth date or guessing an unknown band', () => {
  const child = {
    customerId: 'p',
    displayName: 'Guest',
    birthDate: '',
    ageCategory: 'CHD' as const,
  };
  expect(
    passengerPricingAgeLabel(state, { ...child, childAgeBand: 'AGE_2_6' }),
  ).toBe('کودک (2-6)');
  expect(
    passengerPricingAgeLabel(state, { ...child, childAgeBand: 'AGE_6_12' }),
  ).toBe('کودک (6-12)');
  expect(passengerPricingAgeLabel(state, child)).toBe('کودک');
});
