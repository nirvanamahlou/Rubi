import { expect, it } from 'vitest';
import { completionRows } from './passenger-completion';
it('creates booked adult/child/infant slots and preserves per-leg service counts', () => {
  const rows = completionRows({
    version: 1,
    available: true,
    departureDate: '2027-01-01',
    hotel: {
      serviceKey: 'hotel',
      checkInDate: '2027-01-01',
      checkOutDate: '2027-01-07',
    },
    services: [
      {
        key: 'out',
        kind: 'FLIGHT',
        direction: 'OUTBOUND',
        title: 'Out',
        party: { adults: 2, children: 1, infants: 1 },
      },
      {
        key: 'back',
        kind: 'FLIGHT',
        direction: 'RETURN',
        title: 'Back',
        party: { adults: 1, children: 1, infants: 1 },
      },
      {
        key: 'hotel',
        kind: 'HOTEL',
        direction: null,
        title: 'Hotel',
        party: { adults: 2, children: 1, infants: 1 },
      },
    ],
  });
  expect(rows).toHaveLength(4);
  expect(rows.map((r) => r.category)).toEqual([
    'adults',
    'adults',
    'children',
    'infants',
  ]);
  expect(rows[1]!.services).toEqual(['out', 'hotel']);
  expect(
    rows.every(
      (r) => !r.person.person && r.person.values.nationalityCode === 'IRN',
    ),
  ).toBe(true);
  expect(rows[0]!.checkOutDate).toBe('2027-01-07');
});
