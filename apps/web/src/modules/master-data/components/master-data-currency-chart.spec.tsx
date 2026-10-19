import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FinanceChart, currencyChartData } from './master-data-currency-chart';

const rate = {
  id: 'direct-rate',
  fromCurrencyId: 'usd',
  toCurrencyId: 'irr',
  fromCurrencyCode: 'USD',
  toCurrencyCode: 'IRR',
  rate: '270000',
  rateType: 'BUY' as const,
  source: 'manual',
  observedAt: '2026-10-19T08:00:00Z',
  validFrom: '2026-10-19T08:00:00Z',
  validTo: null,
  status: 'APPROVED' as const,
  createdByUserId: 'registrant',
  approvedByUserId: 'registrant',
  approvedAt: '2026-10-19T08:00:00Z',
  version: 1,
  isAuthoritative: false as const,
};

describe('directly registered reference rate chart', () => {
  it('renders the first finalized quote as a visible point without a second approval', () => {
    const html = renderToStaticMarkup(<FinanceChart rates={[rate]} />);
    expect(html).toContain('<circle');
    expect(html).toContain('cx="370"');
    expect(html).toContain('تاریخ');
    expect(html).toContain('مبلغ');
    expect(html).toContain('270000');
    expect(html).not.toContain('NaN');
  });
  it('uses actual date intervals on X and amounts on Y, including equal dates and values', () => {
    const data = currencyChartData([
      { ...rate, id: 'a', observedAt: '2026-10-01T00:00:00Z', rate: '100' },
      { ...rate, id: 'b', observedAt: '2026-10-02T00:00:00Z', rate: '200' },
      { ...rate, id: 'c', observedAt: '2026-10-11T00:00:00Z', rate: '300' },
    ])!;
    expect(data.points.map((point) => point.x)).toEqual([90, 146, 650]);
    expect(data.points[0]!.y).toBeGreaterThan(data.points[1]!.y);
    expect(data.points[1]!.y).toBeGreaterThan(data.points[2]!.y);
    const equal = currencyChartData([rate, { ...rate, id: 'equal' }])!;
    expect(equal.points[0]!.x).toBe(equal.points[1]!.x);
    expect(equal.points[0]!.y).toBe(equal.points[1]!.y);
    expect(currencyChartData([])).toBeNull();
  });
  it('keeps tiny and very large amounts finite and does not plot malformed input', () => {
    const tiny = currencyChartData([{ ...rate, rate: '0.0000000001' }])!;
    expect(tiny.points[0]!.y).toBeLessThan(100);
    const large = currencyChartData([
      { ...rate, rate: '99999999999999.9999999999' },
    ])!;
    expect(Number.isFinite(large.points[0]!.y)).toBe(true);
    expect(currencyChartData([{ ...rate, observedAt: 'bad-date' }])).toBeNull();
    expect(currencyChartData([{ ...rate, rate: '0' }])).toBeNull();
  });
  it('shows the trend for subsequent quotes but does not silently finalize legacy drafts', () => {
    const html = renderToStaticMarkup(
      <FinanceChart
        rates={[
          rate,
          {
            ...rate,
            id: 'next',
            rate: '280000',
            observedAt: '2026-10-19T09:00:00Z',
          },
          { ...rate, id: 'legacy', rate: '999999', status: 'DRAFT' },
        ]}
      />,
    );
    expect(html.match(/<circle/g)).toHaveLength(2);
    expect(html).not.toContain('999999');
  });
});
