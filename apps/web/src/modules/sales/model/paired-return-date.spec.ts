import { it, expect } from 'vitest';
import { pairedReturnDate } from './exact-flight-dates';
import type { TicketOfferV1 } from '@nora/contracts';
const out: TicketOfferV1 = {
  id: 'out',
  version: 1,
  branchId: 'b',
  originId: 'one',
  destinationId: 'two',
  departureAt: '2026-10-19T08:00:00Z',
  arrivalAt: '2026-10-19T10:00:00Z',
  carrierName: 'Synthetic',
  serviceNumber: '1',
  cabinClassCode: 'ECONOMY',
  totalCapacity: 10,
  remainingCapacity: 10,
  status: 'ACTIVE',
  loadGroupId: 'group',
  returnMinDays: 2,
  returnMaxDays: 5,
};
const back: TicketOfferV1 = {
  ...out,
  id: 'back',
  originId: 'two',
  destinationId: 'one',
  departureAt: '2026-10-21T21:30:00Z',
  arrivalAt: '2026-10-22T04:00:00Z',
};
it('uses the actual paired load return day in Tehran, without a sale price requirement', () => {
  expect(pairedReturnDate([out], [back], 1)).toEqual({
    day: '2026-10-22',
    outboundIds: ['out'],
  });
});
it('accepts canonical saved pair IDs for older offers without load identity', () => {
  expect(
    pairedReturnDate(
      [
        {
          ...out,
          loadGroupId: '',
          roundTripSalePrices: [
            {
              returnOfferId: 'back',
              revision: 1,
              amount: '100',
              currencyCode: 'IRR',
            },
          ],
        },
      ],
      [back],
      1,
    )?.day,
  ).toBe('2026-10-22');
});
it('never guesses between different registered dates or unrelated loads', () => {
  expect(
    pairedReturnDate(
      [out],
      [back, { ...back, id: 'other', departureAt: '2026-10-23T08:00:00Z' }],
      1,
    ),
  ).toBeUndefined();
  expect(
    pairedReturnDate([out], [{ ...back, loadGroupId: 'unrelated' }], 1),
  ).toBeUndefined();
});
it('rejects sold out, paused, different branch/cabin and out-of-window returns', () => {
  for (const change of [
    { remainingCapacity: 0 },
    { status: 'PAUSED' as const },
    { branchId: 'other' },
    { cabinClassCode: 'BUSINESS' as const },
    { departureAt: '2026-10-28T08:00:00Z' },
  ])
    expect(
      pairedReturnDate([out], [{ ...back, ...change }], 1),
    ).toBeUndefined();
});
