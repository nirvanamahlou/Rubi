import { expect, it } from 'vitest';
import {
  salesBookedAgeCategory,
  salesHotelGuestAges,
} from '../src/sales/passenger-age';

it('keeps booked categories for unknown DOB and gives a real DOB precedence', () => {
  for (const ageCategory of ['ADT', 'CHD', 'INF'] as const)
    expect(
      salesBookedAgeCategory({ birthDate: '', ageCategory }, '2027-01-01'),
    ).toBe(ageCategory);
  expect(salesBookedAgeCategory({ birthDate: '' }, '2027-01-01')).toBeNull();
  expect(
    salesBookedAgeCategory(
      { birthDate: '2026-01-01', ageCategory: 'ADT' },
      '2027-01-01',
    ),
  ).toBe('INF');
  expect(
    salesBookedAgeCategory(
      { birthDate: 'invalid', ageCategory: 'ADT' },
      '2027-01-01',
    ),
  ).toBeNull();
  expect(
    salesBookedAgeCategory(
      { birthDate: '2026-02-30', ageCategory: 'ADT' },
      '2027-01-01',
    ),
  ).toBeNull();
});

it('matches unknown guests to booked room slots without manufacturing birth dates or exceeding occupancy', () => {
  const people = [
    { birthDate: '', ageCategory: 'ADT' as const },
    { birthDate: '2022-01-01', ageCategory: 'CHD' as const },
    { birthDate: '', ageCategory: 'INF' as const },
  ];
  const before = people.map((person) => ({ ...person }));
  expect(salesHotelGuestAges(people, '2027-01-01', [15, 5, 1])).toEqual([
    15, 5, 1,
  ]);
  expect(salesHotelGuestAges(people, '2027-01-01', [15, 6, 1])).toBeNull();
  expect(salesHotelGuestAges(people, '2027-01-01', [15, 5])).toBeNull();
  expect(
    salesHotelGuestAges(
      [{ birthDate: '', ageCategory: 'CHD' }],
      '2027-01-01',
      [15],
    ),
  ).toBeNull();
  expect(people).toEqual(before);
});
