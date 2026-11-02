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

it('recognizes explicitly floating hotel-only contracts without classifying unrelated service metadata', () => {
  expect(
    isFloatingSalesContract([
      { kind: 'HOTEL', metadata: { purchaseSupplyType: 'FLOATING' } },
    ]),
  ).toBe(true);
  for (const kind of ['TRANSFER', 'VISA'])
    expect(
      isFloatingSalesContract([
        { kind, metadata: { purchaseSupplyType: 'FLOATING' } },
      ]),
    ).toBe(false);
  expect(
    isFloatingSalesContract([
      { kind: 'HOTEL', metadata: { purchaseSupplyType: 'COMPANY' } },
    ]),
  ).toBe(false);
});
