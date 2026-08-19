import { describe, expect, it } from 'vitest';

import { frontendQualityTargets } from './performance';

describe('frontend quality targets', () => {
  it('keeps measurable Web Vitals and accessibility gates', () => {
    expect(frontendQualityTargets.coreWebVitals).toEqual({
      lcpMilliseconds: 2_000,
      inpMilliseconds: 200,
      cls: 0.1,
    });
    expect(
      frontendQualityTargets.routeJavaScriptBudgetGzipKb,
    ).toBeLessThanOrEqual(150);
    expect(
      frontendQualityTargets.lighthouse.accessibility,
    ).toBeGreaterThanOrEqual(95);
    expect(frontendQualityTargets.wcag).toBe('2.2 AA');
  });
});
