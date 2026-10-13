import { describe, expect, it } from 'vitest';

import { masterDataComplementKpi } from './kpi-complement';

describe('masterDataComplementKpi', () => {
  it.each([
    [10, 4, 6],
    [0, 0, 0],
    [5, 5, 0],
  ])(
    'returns the truthful complement for %s and %s',
    (total, subset, value) => {
      expect(masterDataComplementKpi(total, subset, 'ready')).toBe(value);
    },
  );

  it.each([
    [undefined, 0],
    [1, undefined],
    [-1, 0],
    [1, -1],
    [1.5, 1],
    [2, 0.5],
    ['2', 1],
    [Number.MAX_SAFE_INTEGER + 1, 1],
    [1, 2],
    [Number.NaN, 0],
  ])('rejects invalid totals/subsets (%s, %s)', (total, subset) => {
    expect(masterDataComplementKpi(total, subset, 'ready')).toBe('—');
  });

  it.each(['loading', 'error'] as const)(
    'does not turn %s state into zero',
    (state) => {
      expect(masterDataComplementKpi(0, 0, state)).toBe('—');
    },
  );
});
