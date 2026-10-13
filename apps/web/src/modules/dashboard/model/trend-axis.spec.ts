import { describe, expect, it } from 'vitest';

import { trendAxisLabelIndexes } from './trend-axis';

describe('trendAxisLabelIndexes', () => {
  it('replaces a near-final periodic label with the mandatory final label', () => {
    expect(trendAxisLabelIndexes(30)).toEqual([0, 4, 8, 12, 16, 20, 24, 29]);
    expect(trendAxisLabelIndexes(30)).not.toContain(28);
  });

  it('keeps the final label alongside sufficiently separated periodic labels', () => {
    expect(trendAxisLabelIndexes(28)).toEqual([0, 4, 8, 12, 16, 20, 24, 27]);
  });

  it('shows every label for short trends and handles no labels', () => {
    expect(trendAxisLabelIndexes(4)).toEqual([0, 1, 2, 3]);
    expect(trendAxisLabelIndexes(0)).toEqual([]);
  });
});
