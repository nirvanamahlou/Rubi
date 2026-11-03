import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  dashboardSeriesSummary,
  DashboardSeriesDataTable,
} from './dashboard-series-data-table';

describe('complete dashboard series summaries', () => {
  const labels = ['day one', 'day two'];
  const series = [
    { label: 'Leads', values: [0, 0] },
    { label: 'Orders', values: [124, 21] },
  ];
  it('renders later nonzero series with independent columns, including zero and negative values', () => {
    const html = renderToStaticMarkup(
      createElement(DashboardSeriesDataTable, {
        title: 'Growth',
        firstColumnLabel: 'Day',
        labels,
        values: [0, 0],
        series: [...series, { label: 'Adjustments', values: [-5, 0] }],
        formatValue: String,
      }),
    );
    expect(html).toContain('Orders');
    expect(html).toContain('124');
    expect(html).toContain('21');
    expect(html).toContain('-5');
    expect(html.match(/scope="col"/g)).toHaveLength(4);
    expect(html.match(/<td /g)).toHaveLength(6);
    expect(dashboardSeriesSummary(labels, [0, 0], series, String)).toBe(
      'Leads: day one: 0، day two: 0؛ Orders: day one: 124، day two: 21',
    );
  });
  it('does not replace a missing series cell with a fabricated zero or drop a trailing bucket', () => {
    const html = renderToStaticMarkup(
      createElement(DashboardSeriesDataTable, {
        title: 'Mixed',
        firstColumnLabel: 'Day',
        labels,
        values: [1],
        series: [
          { label: 'Short', values: [1] },
          { label: 'Long', values: [2, 3, 4] },
        ],
        formatValue: String,
      }),
    );
    expect(html).toContain('—');
    expect(html).toContain('4');
    expect(html.match(/scope="row"/g)).toHaveLength(3);
  });
  it('preserves the single-series fallback and only displays the selected caller-provided currency', () => {
    expect(dashboardSeriesSummary(labels, [5, 0], undefined, String)).toBe(
      'day one: 5، day two: 0',
    );
    const html = renderToStaticMarkup(
      createElement(DashboardSeriesDataTable, {
        title: 'USD',
        firstColumnLabel: 'Day',
        labels,
        values: [5, 0],
        formatValue: (value) => '$' + value,
      }),
    );
    expect(html).toContain('$5');
    expect(html).not.toContain('EUR');
    expect(html.match(/scope="col"/g)).toHaveLength(2);
  });
});
