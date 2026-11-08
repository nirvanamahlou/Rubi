import { expect, it } from 'vitest';
import { dashboardKpis, dashboardPages } from './registry';
import {
  dashboardMeasurementRequirements,
  dashboardSourceRequirements,
} from './measurement-requirements';

it('covers every KPI and chart with explicit business data requirements, including all source families', () => {
  const widgets = [
    ...dashboardKpis,
    ...dashboardPages.flatMap((p) => p.visualizations),
  ];
  expect(dashboardKpis).toHaveLength(84);
  expect(new Set(widgets.map((w) => w.id)).size).toBeGreaterThan(150);
  for (const widget of widgets) {
    expect(dashboardMeasurementRequirements(widget), widget.id).toBeTruthy();
    for (const source of widget.source)
      expect(
        dashboardSourceRequirements[source],
        `${widget.id}: ${source}`,
      ).toBeTruthy();
  }
});
it('does not pretend that registered purchases, sales, or attendance alone prove profit or appraisal scores', () => {
  for (const id of [
    'gross-profit',
    'net-profit',
    'employee-performance',
    'low-capacity-offers',
  ]) {
    const definition = dashboardKpis.find((k) => k.id === id)!;
    expect(dashboardMeasurementRequirements(definition)).toMatch(
      /تأییدشده|قطعی|ارزیابی|مصوب/,
    );
  }
});
