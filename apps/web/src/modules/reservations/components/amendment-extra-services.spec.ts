import { expect, it } from 'vitest';
import type { SalesContractAmendmentV1 } from '@nora/contracts';
import {
  addAmendmentHotel,
  assignAmendmentExtra,
} from './amendment-extra-services';
const source = {
  departureDate: '2026-11-10',
  returnNotBefore: '2026-11-17',
  destinationId: 'city',
  services: [],
  passengers: [
    { customerId: 'p', ageCategory: 'ADT', serviceClientKeys: [] },
    { customerId: 'q', ageCategory: 'INF', serviceClientKeys: [] },
  ],
  priceComponents: [{ amount: '100', currencyCode: 'IRR' }],
} as unknown as SalesContractAmendmentV1;
it.each(['insurance', 'city-tour', 'tour-guide'])(
  'creates %s once and assigns it only to the requested passenger',
  (key) => {
    const first = assignAmendmentExtra(source, 'p', key, true);
    const second = assignAmendmentExtra(first, 'q', key, true);
    expect(second.services).toHaveLength(1);
    expect(first.passengers[1]).toEqual(source.passengers[1]);
    expect(
      assignAmendmentExtra(second, 'p', key, false).passengers[0]!
        .serviceClientKeys,
    ).toEqual([]);
    expect(second.priceComponents).toEqual(source.priceComponents);
  },
);
it('adds hotel selection and allocations without changing prices or duplicating services', () => {
  const next = addAmendmentHotel(source);
  expect(next.hotelSelection).toMatchObject({
    cityId: 'city',
    checkInDate: '2026-11-10',
    checkOutDate: '2026-11-17',
    occupancy: 1,
  });
  expect(
    next.passengers.every((p) =>
      p.serviceClientKeys.includes(next.hotelSelection!.serviceClientKey),
    ),
  ).toBe(true);
  expect(next.priceComponents).toEqual(source.priceComponents);
  expect(addAmendmentHotel(next)).toBe(next);
});
