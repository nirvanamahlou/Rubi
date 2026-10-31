import { it, expect } from 'vitest';
import { pairedReturnDate, pairedReturnOffer } from './exact-flight-dates';
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

it('selects the registered return object and does not guess between flights on the same day', () => {
  expect(pairedReturnOffer(out, [back], 2)).toBe(back);
  expect(
    pairedReturnOffer(out, [back, { ...back, id: 'duplicate-flight' }], 2),
  ).toBeUndefined();
});
it('prefers the unique original load partner over a separately priced alternative', () => {
  const alternative = {
    ...back,
    id: 'alternative',
    loadGroupId: 'different',
    departureAt: '2026-10-23T10:00:00Z',
  };
  const priced = {
    ...out,
    roundTripSalePrices: [back, alternative].map((b) => ({
      returnOfferId: b.id,
      revision: 1,
      amount: '100',
      currencyCode: 'IRR',
    })),
  };
  expect(pairedReturnOffer(priced, [alternative, back], 2, true)).toBe(back);
});
it('does not auto-select an unavailable, incompatible or unpublished standalone return', () => {
  expect(pairedReturnOffer(out, [back], 2, true)).toBeUndefined();
  for (const change of [
    { remainingCapacity: 1 },
    { status: 'PAUSED' as const },
    { branchId: 'other' },
    { cabinClassCode: 'BUSINESS' as const },
    { departureAt: '2026-10-28T08:00:00Z' },
  ])
    expect(pairedReturnOffer(out, [{ ...back, ...change }], 2)).toBeUndefined();
  const priced = {
    ...out,
    loadGroupId: '',
    roundTripSalePrices: [
      {
        returnOfferId: back.id,
        revision: 1,
        amount: '100',
        currencyCode: 'IRR',
      },
    ],
  };
  expect(pairedReturnOffer(priced, [back], 2, true)).toBe(back);
});

it('uses the explicit scheduled day within a shared load instead of another eligible day', () => {
  const planned = { ...out, scheduledReturnDate: '2026-10-22' };
  const other = {
    ...back,
    id: 'another-day',
    departureAt: '2026-10-23T08:00:00Z',
  };
  expect(pairedReturnOffer(planned, [other, back], 1)).toBe(back);
  expect(pairedReturnDate([planned], [other, back], 1)?.day).toBe('2026-10-22');
  expect(pairedReturnOffer(planned, [other], 1)).toBeUndefined();
  expect(
    pairedReturnOffer(
      planned,
      [back, { ...back, id: 'same-day-other-flight' }],
      1,
    ),
  ).toBeUndefined();
});
