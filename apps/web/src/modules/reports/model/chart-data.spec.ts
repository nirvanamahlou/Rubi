import { describe, expect, it } from 'vitest';
import type { SalesByOrganizationReportResult } from './client';
import { reportChartGroups, reportChartMetric } from './chart-data';

const result = {
  chartMeasure: 'salesAmount',
  columns: [
    { key: 'primaryDimension', kind: 'TEXT', label: 'شعبه' },
    { key: 'secondaryDimension', kind: 'TEXT', label: 'کارشناس' },
    { key: 'orderCount', kind: 'NUMBER', label: 'تعداد قرارداد' },
    { key: 'passengerCount', kind: 'NUMBER', label: 'تعداد مسافر' },
    { key: 'salesAmount', kind: 'TEXT', label: 'مبالغ قرارداد به تفکیک ارز' },
    { key: 'refundAmount', kind: 'TEXT', label: 'استرداد' },
  ],
  rows: [
    {
      grainId: 'one',
      branchId: 'مرکزی',
      ownerUserId: 'کارشناس نمونه',
      amount: '9007199254740993.12',
      currencyCode: 'MULTI',
      contractCount: 26,
      passengerCount: 150,
      amountsByCurrency: [
        { currencyCode: 'IRR', amount: '9007199254740993.12' },
        { currencyCode: 'USD', amount: '94000' },
      ],
      sourceValues: {
        salesAmount: '9007199254740993.12 ریال + 94000 $',
        orderCount: 26,
        passengerCount: 150,
        refundAmount: '-500 ریال + 12 €',
      },
    },
  ],
} as unknown as SalesByOrganizationReportResult;

describe('report chart measures and currency groups', () => {
  it('keeps one original row with exact independent amounts rather than repeating people per currency', () => {
    const metric = reportChartMetric(result, 'amount', 'فروش');
    const groups = reportChartGroups(result, metric);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.values).toEqual(result.rows[0]!.amountsByCurrency);
    expect(groups[0]!.row.contractCount).toBe(26);
    expect(result.rows[0]!.sourceValues!.salesAmount).toBe(
      '9007199254740993.12 ریال + 94000 $',
    );
  });
  it.each([
    ['contractCount', 'orderCount', '26'],
    ['orderCount', 'orderCount', '26'],
    ['passengerCount', 'passengerCount', '150'],
  ])(
    'uses %s as the actual graph measure without currency duplication',
    (selected, key, amount) => {
      const metric = reportChartMetric(result, selected, 'فروش');
      expect(metric).toMatchObject({ key, money: false });
      expect(reportChartGroups(result, metric)[0]!.values).toEqual([
        { amount, currencyCode: '' },
      ]);
    },
  );
  it('does not mistake a name column for a numeric measure', () => {
    expect(reportChartMetric(result, 'ownerUserId', 'فروش').key).toBe(
      'salesAmount',
    );
  });
  it('uses the selected monetary column rather than reusing sales currency amounts', () => {
    const metric = reportChartMetric(result, 'refundAmount', 'فروش');
    expect(reportChartGroups(result, metric)[0]!.values).toEqual([
      { amount: '-500', currencyCode: 'IRR' },
      { amount: '12', currencyCode: 'EUR' },
    ]);
  });
  it('keeps operational chartMeasure metadata for nonfinancial source columns', () => {
    const operational = {
      ...result,
      chartMeasure: 'remaining',
      columns: [
        { key: 'remaining', label: 'ظرفیت باقی‌مانده', kind: 'NUMBER' },
      ],
      rows: [{ ...result.rows[0]!, sourceValues: { remaining: 0 } }],
    };
    const metric = reportChartMetric(operational, 'amount', 'فروش');
    expect(metric).toMatchObject({ key: 'remaining', money: false });
    expect(reportChartGroups(operational, metric)[0]!.values).toEqual([
      { amount: '0', currencyCode: '' },
    ]);
  });
});
