export const frontendQualityTargets = {
  primaryExperience: 'desktop-corporate',
  responsiveSupport: ['tablet', 'mobile'],
  coreWebVitals: {
    lcpMilliseconds: 2_000,
    inpMilliseconds: 200,
    cls: 0.1,
  },
  routeJavaScriptBudgetGzipKb: 150,
  lighthouse: {
    performance: 90,
    accessibility: 95,
  },
  wcag: '2.2 AA',
  accessibilityOwner: 'PC-B',
} as const;
