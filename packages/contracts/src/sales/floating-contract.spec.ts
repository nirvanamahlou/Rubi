import { expect, it } from 'vitest';
import { isFloatingSalesContract } from './floating-contract';
it('tags only saved floating flight facts, including contract-only flights', () => {
  expect(
    isFloatingSalesContract([
      { kind: 'FLIGHT', metadata: { contractFlightVersion: 1 } },
    ]),
  ).toBe(true);
  expect(
    isFloatingSalesContract([
      { kind: 'FLIGHT', metadata: { purchaseSupplyType: 'FLOATING' } },
    ]),
  ).toBe(true);
  expect(
    isFloatingSalesContract([
      { kind: 'FLIGHT', metadata: { purchaseSupplyType: 'COMPANY' } },
      { kind: 'HOTEL', metadata: { contractFlightVersion: 1 } },
    ]),
  ).toBe(false);
  expect(isFloatingSalesContract([])).toBe(false);
});
