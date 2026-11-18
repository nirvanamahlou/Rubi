import { expect, it } from 'vitest';
import { validateTourPackage } from './tour-policy';

const a = '10000000-0000-4000-8000-000000000001';
const b = '10000000-0000-4000-8000-000000000002';
const c = '10000000-0000-4000-8000-000000000003';
const input = {
  name: 'Synthetic floating tour',
  originId: a,
  destinationId: b,
  hotelIds: [],
  transferOutbound: false,
  transferReturn: false,
  visa: false,
  details: {
    version: 1,
    isFloating: true,
    isCombined: true,
    destinations: [
      { cityId: b, nights: 3 },
      { cityId: c, nights: 4 },
    ],
  },
};
it('retains floating definitions and ordered combined nights without inventory', () => {
  expect(validateTourPackage(input)).toEqual(input);
});
it.each([
  [
    { cityId: c, nights: 3 },
    { cityId: b, nights: 4 },
  ],
  [
    { cityId: b, nights: 3 },
    { cityId: b, nights: 4 },
  ],
  [
    { cityId: b, nights: 365 },
    { cityId: c, nights: 1 },
  ],
])(
  'rejects conflicting combined destinations or night totals',
  (destinations) => {
    expect(() =>
      validateTourPackage({
        ...input,
        details: { ...input.details, destinations },
      }),
    ).toThrow();
  },
);
