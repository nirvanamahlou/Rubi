import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HrDashboardChart, HrDashboardCharts } from './hr-dashboard-charts';
import type { HrDashboardChartDto } from '@nora/contracts';
const chart: HrDashboardChartDto = {
  id: 'leaveBalance',
  title: 'مانده مرخصی',
  description: 'سال شمسی جاری',
  from: '2026-03-21',
  to: '2026-10-25',
  points: [
    { key: 'a', label: 'مالی', value: -1.5, unit: 'ساعت' },
    { key: 'b', label: 'عملیات', value: 2, unit: 'روز' },
  ],
};
describe('HR operational charts', () => {
  it('renders accessible named bars with signed values, explicit units and Jalali dates', () => {
    const html = renderToStaticMarkup(<HrDashboardChart chart={chart} />);
    expect(html).toContain('مانده مرخصی');
    expect(html).toContain('aria-label="مالی: -1.5 ساعت"');
    expect(html).toContain('aria-label="عملیات: 2 روز"');
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('2026-03-21');
  });
  it('shows an honest empty state and paginates all points without silently dropping them', () => {
    expect(
      renderToStaticMarkup(
        <HrDashboardChart chart={{ ...chart, points: [] }} />,
      ),
    ).toContain('داده‌ای در این بازه ثبت نشده است.');
    const html = renderToStaticMarkup(
      <HrDashboardChart
        chart={{
          ...chart,
          points: Array.from({ length: 30 }, (_, i) => ({
            key: String(i),
            label: `روز ${i}`,
            value: 0,
            unit: 'نفر',
          })),
        }}
      />,
    );
    expect(html.match(/role="img"/g)).toHaveLength(12);
    expect(html).toContain('بعدی');
    expect(html).toContain('۳');
  });
  it('does not flash stale or fabricated numbers before the scoped request completes', () => {
    const html = renderToStaticMarkup(
      <HrDashboardCharts branch="" unit="" revision={0} />,
    );
    expect(html).toContain('در حال دریافت نمودارها');
    expect(html).not.toContain('role="img"');
  });
});
