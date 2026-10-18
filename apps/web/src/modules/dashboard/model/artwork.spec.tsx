import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DashboardArtworkIcon } from '../components/dashboard-artwork-icon';
import {
  dashboardArtworkNames,
  dashboardArtworkViewBox,
  dashboardChartArtwork,
  dashboardChartArtworkById,
  dashboardKpiArtwork,
  dashboardKpiArtworkById,
} from './artwork';
import { dashboardKpis, dashboardPages } from './registry';

describe('approved matte dashboard artwork', () => {
  it('covers every registered KPI and chart without a generic fallback', () => {
    expect(
      dashboardKpis
        .filter((kpi) => !dashboardKpiArtworkById.has(kpi.id))
        .map((kpi) => kpi.id),
    ).toEqual([]);
    expect(
      dashboardPages
        .flatMap((page) => page.visualizations)
        .filter((chart) => !dashboardChartArtworkById.has(chart.id))
        .map((chart) => chart.id),
    ).toEqual([]);
  });

  it('keeps distinct financial and customer meanings rather than chart type alone', () => {
    expect(dashboardKpiArtwork('gross-sales')).toBe('sales');
    expect(dashboardKpiArtwork('net-sales')).toBe('receipt');
    expect(dashboardKpiArtwork('collected')).toBe('collection');
    expect(dashboardKpiArtwork('refunded')).toBe('refund');
    expect(dashboardKpiArtwork('receivables')).toBe('receivables');
    expect(dashboardChartArtwork('sales-channel', 'bar')).toBe('channels');
    expect(dashboardChartArtwork('service-type', 'bar')).toBe('services');
    expect(dashboardChartArtwork('employee-conversion-by-agent', 'bar')).toBe(
      'conversion',
    );
    expect(
      dashboardChartArtwork('employee-cancellations-by-agent', 'bar'),
    ).toBe('cancellation');
  });

  it('renders decorative, noninteractive local artwork within the transparent atlas', () => {
    const png = readFileSync(
      resolve(
        process.cwd(),
        'public/images/dashboard-icons/matte-enterprise-v1.png',
      ),
    );
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png.readUInt32BE(16)).toBe(1536);
    expect(png.readUInt32BE(20)).toBe(1024);
    expect(png[25]).toBe(6); // RGBA
    expect(png.byteLength).toBeLessThan(2_000_000);
    for (const name of dashboardArtworkNames) {
      const [x, y, width, height] = dashboardArtworkViewBox(name)
        .split(' ')
        .map(Number);
      expect(x! + width!).toBeLessThanOrEqual(1536);
      expect(y! + height!).toBeLessThanOrEqual(1024);
      const markup = renderToStaticMarkup(<DashboardArtworkIcon name={name} />);
      expect(markup).toContain('aria-hidden="true"');
      expect(markup).toContain('focusable="false"');
      expect(markup).toContain(
        '/images/dashboard-icons/matte-enterprise-v1.png',
      );
      expect(markup).not.toContain('<button');
    }
  });
});
