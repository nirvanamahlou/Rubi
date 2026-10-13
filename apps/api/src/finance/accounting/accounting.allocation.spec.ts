import { describe, it, expect } from 'vitest';
import { allocateAmount, allocationTargets } from './accounting.allocation';
const targets = [
  { accountId: '11111111-1111-4111-8111-111111111111', percentage: '33.33' },
  { accountId: '22222222-2222-4222-8222-222222222222', percentage: '66.67' },
];
describe('allocation conservation', () => {
  it('repairs over-rounding without producing a negative final allocation', () => {
    const thirds = [
      { ...targets[0]!, percentage: '33.34' },
      { ...targets[1]!, percentage: '33.33' },
      {
        accountId: '33333333-3333-4333-8333-333333333333',
        percentage: '33.33',
      },
    ];
    expect(allocateAmount('2', thirds, 'IRR').map((r) => r.amount)).toEqual([
      '1',
      '1',
      '0',
    ]);
    const quarters = thirds.map((t) => ({ ...t, percentage: '25' }));
    quarters.push({
      accountId: '44444444-4444-4444-8444-444444444444',
      percentage: '25',
    });
    expect(allocateAmount('2', quarters, 'IRR').map((r) => r.amount)).toEqual([
      '1',
      '1',
      '0',
      '0',
    ]);
  });
  it('puts the rounding residual in the final target', () =>
    expect(allocateAmount('1', targets, 'IRR').map((r) => r.amount)).toEqual([
      '0',
      '1',
    ]));
  it('conserves huge decimal amounts without floating point', () =>
    expect(
      allocateAmount('9007199254740993', targets, 'IRR').map((r) => r.amount),
    ).toEqual(['3002099511605173', '6005099743135820']));
  it('rejects incomplete and duplicate percentages', () => {
    expect(() =>
      allocationTargets([...targets, { ...targets[0], percentage: '1' }]),
    ).toThrow();
    expect(() =>
      allocationTargets([{ ...targets[0], percentage: '99' }]),
    ).toThrow();
  });
});
