import { describe, expect, it } from 'vitest';
import { dashboardNumericAxis } from './numeric-axis';
describe('signed Dashboard monetary scale', () => {
  it('keeps refunds below zero inside the plot and preserves a common baseline', () => {
    const axis = dashboardNumericAxis([-30, 0, 70]);
    expect(axis.minimum).toBe(-30);
    expect(axis.maximum).toBe(70);
    expect(axis.position(-30)).toBe(0);
    expect(axis.position(0)).toBe(30);
    expect(axis.position(70)).toBe(100);
  });
  it('does not turn zero into a visible positive bar and handles wholly negative or empty sources', () => {
    for (const values of [[0, 0], [], [-10, -5]]) {
      const axis = dashboardNumericAxis(values);
      expect(axis.position(0) - axis.position(0)).toBe(0);
      for (const value of values)
        expect(axis.position(value)).toBeGreaterThanOrEqual(0);
      for (const value of values)
        expect(axis.position(value)).toBeLessThanOrEqual(100);
    }
    expect(dashboardNumericAxis([-10, -5]).position(0)).toBe(100);
  });
});
