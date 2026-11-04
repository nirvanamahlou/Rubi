import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DashboardStackedSeriesChart } from './dashboard-stacked-series-chart';

describe('rendered multi-series customer chart', () => {
  it('renders both series and all ten buckets when only returning customers have values', () => {
    const html = renderToStaticMarkup(
      createElement(DashboardStackedSeriesChart, {
        title: 'Retention',
        labels: Array.from({ length: 10 }, (_, i) => `day-${i}`),
        series: [
          { label: 'First buyers', values: Array(10).fill(0) },
          { label: 'Returning buyers', values: Array(10).fill(3) },
        ],
      }),
    );
    expect(html).toContain('First buyers');
    expect(html).toContain('Returning buyers');
    expect(html).toContain('day-9');
    expect(html.match(/<rect /g)).toHaveLength(20);
    expect(html.match(/height="0"/g)).toHaveLength(10);
    expect(html).not.toContain('NaN');
  });
});
