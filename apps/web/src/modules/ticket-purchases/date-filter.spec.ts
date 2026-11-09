import { expect, it } from 'vitest';
import type { TicketPurchaseInboxItemV1 } from '@nora/contracts';
import { matchesFlightPurchaseDate } from './date-filter';
const row = (serviceDate?: string, departureDate?: string) =>
  ({
    request: { serviceDate },
    ...(departureDate ? { flightGroup: { departureDate } } : {}),
  }) as TicketPurchaseInboxItemV1;

it('includes both range boundaries and excludes adjacent days', () => {
  for (const [day, expected] of [
    ['2026-11-08', false],
    ['2026-11-09', true],
    ['2026-11-20', true],
    ['2026-11-21', false],
  ] as const)
    expect(
      matchesFlightPurchaseDate(row(day), '2026-11-09', '2026-11-20'),
    ).toBe(expected);
});
it('supports either open boundary and a single exact day', () => {
  expect(matchesFlightPurchaseDate(row('2026-11-09'), '2026-11-09', '')).toBe(
    true,
  );
  expect(matchesFlightPurchaseDate(row('2026-11-09'), '', '2026-11-09')).toBe(
    true,
  );
  expect(
    matchesFlightPurchaseDate(row('2026-11-09'), '2026-11-09', '2026-11-09'),
  ).toBe(true);
});
it('uses the displayed flight date instead of a different request date', () => {
  expect(
    matchesFlightPurchaseDate(
      row('2026-10-01', '2026-11-09'),
      '2026-11-09',
      '2026-11-09',
    ),
  ).toBe(true);
  expect(
    matchesFlightPurchaseDate(
      row('2026-11-09', '2026-10-01'),
      '2026-11-09',
      '',
    ),
  ).toBe(false);
});
it('does not timezone-shift the date shown in the list', () => {
  expect(
    matchesFlightPurchaseDate(
      row('2026-11-09T23:30:00Z'),
      '2026-11-09',
      '2026-11-09',
    ),
  ).toBe(true);
});
it('retains undated rows only when no date range is applied', () => {
  expect(matchesFlightPurchaseDate(row(), '', '')).toBe(true);
  expect(matchesFlightPurchaseDate(row(), '2026-11-09', '')).toBe(false);
  expect(matchesFlightPurchaseDate(row('unknown'), '', '2026-11-09')).toBe(
    false,
  );
});
it('returns no rows for an inverted range', () => {
  expect(
    matchesFlightPurchaseDate(row('2026-11-09'), '2026-11-20', '2026-11-01'),
  ).toBe(false);
});
