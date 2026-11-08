import { expect, it } from 'vitest';
import type { DashboardSourceMetric } from '../common/dashboard-source';
import { renderDashboardBreakdown } from './reporting-dashboard-breakdowns';

const money: DashboardSourceMetric = {
  kind: 'money',
  calculation: 'mean',
  aggregation: 'per contract and currency',
  observations: [
    {
      at: new Date('2026-10-01T21:00:00Z'),
      value: '10',
      currencyCode: 'USD',
      dimensions: { agent: 'A' },
    },
    {
      at: new Date('2026-10-01T22:00:00Z'),
      value: '30',
      currencyCode: 'USD',
      dimensions: { agent: 'A' },
    },
    {
      at: new Date('2026-10-01T22:00:00Z'),
      value: '1000',
      currencyCode: 'IRR',
      dimensions: { agent: 'A' },
    },
  ],
};
it('recomputes per-agent means from actual contract observations without mixing currencies', () => {
  const result = renderDashboardBreakdown('employee-average-sale-by-agent', {
    'employee-average-sale': money,
  });
  expect(
    result.visual?.currencySeries?.find((s) => s.currencyCode === 'USD')
      ?.values,
  ).toEqual([20]);
  expect(
    result.visual?.currencySeries?.find((s) => s.currencyCode === 'IRR')
      ?.values,
  ).toEqual([1000]);
});
it('groups temporal means by Tehran dates and does not fill unobserved averages with zero', () => {
  const result = renderDashboardBreakdown('average-sale-trend', {
    'average-sale-value': money,
  });
  expect(result.visual?.labels).toEqual(['2026-10-02']);
  expect(result.visual?.notice).toContain('میانگین صفر ندارد');
});
it('rejects a Decimal just beyond the safe range before binary conversion rounds it into range', () => {
  const result = renderDashboardBreakdown('agent-ranking', {
    'net-sales': {
      ...money,
      calculation: 'sum',
      observations: [
        { ...money.observations[0]!, value: '9007199254740991.1' },
      ],
    },
  });
  expect(result).toEqual({ reason: 'CHART_NUMERIC_RANGE' });
});
it('does not replace a missing required series with zero, while preserving authorized empty sources', () => {
  expect(
    renderDashboardBreakdown('inventory-capacity', {}).visual,
  ).toBeUndefined();
  expect(
    renderDashboardBreakdown('agent-ranking', {
      'net-sales': { ...money, observations: [] },
    }).visual,
  ).toMatchObject({ labels: [], values: [] });
});
it('separates acquisition channel series on a common real date axis', () => {
  const result = renderDashboardBreakdown(
    'customer-acquisition-channel-trend',
    {
      'customers-by-acquisition-channel': {
        kind: 'count',
        aggregation: 'source',
        observations: [
          {
            at: new Date('2026-10-01'),
            value: '1',
            dimensions: { channel: 'Website' },
          },
          {
            at: new Date('2026-10-01'),
            value: '1',
            dimensions: { channel: 'Referral' },
          },
        ],
      },
    },
  );
  expect(result.visual?.labels).toEqual(['2026-10-01']);
  expect(result.visual?.series).toEqual([
    { label: 'Referral', values: [1] },
    { label: 'Website', values: [1] },
  ]);
});
it('keeps same-name agents separate without exposing internal grouping keys', () => {
  const result = renderDashboardBreakdown('employee-average-sale-by-agent', {
    'employee-average-sale': {
      ...money,
      observations: money.observations
        .slice(0, 2)
        .map((r, i) => ({ ...r, dimensionKeys: { agent: 'private-' + i } })),
    },
  });
  expect(result.visual?.values).toEqual([10, 30]);
  expect(result.visual?.labels).toEqual(['A · 1', 'A · 2']);
  expect(JSON.stringify(result)).not.toContain('private-');
});
