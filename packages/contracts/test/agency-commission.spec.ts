import { expect, it } from 'vitest';
import { AGENCY_COMMISSION, readAgencyCommission } from '../src';
const services = (value: unknown) => [
  { metadata: { [AGENCY_COMMISSION]: JSON.stringify(value) } },
];
it('retains exact fixed adult/child rial commissions and legacy absence', () => {
  expect(readAgencyCommission([])).toBeUndefined();
  expect(
    readAgencyCommission(services({ adult: '125000.2500', child: '0' })),
  ).toEqual({ adult: '125000.2500', child: '0' });
});
it('rejects malformed, negative, excessive precision and duplicate snapshots', () => {
  for (const value of [
    { adult: '-1', child: '0' },
    { adult: '1.00001', child: '0' },
    { adult: 1, child: '0' },
    { adult: '1' },
    { adult: '1', child: '0', percent: 5 },
    { adult: '9999999999999999999', child: '0' },
  ])
    expect(() => readAgencyCommission(services(value))).toThrow();
  expect(() =>
    readAgencyCommission([
      ...services({ adult: '1', child: '2' }),
      ...services({ adult: '1', child: '2' }),
    ]),
  ).toThrow();
});
