import { describe, it, expect } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import {
  filterReportOutput,
  reportSourceQuery,
} from './reporting-output-filters';
import { assembleOperationalResult } from './reporting-native-operational';
import { ReportingExportService } from './reporting-export.service';
import type { LocalDocumentStorage } from '../documents/documents.storage';
import type { ReportSource } from '../common/report-source';
const actor = { userId: 'user', permissions: [], branchIds: ['branch'] };
const query = {
  filters: {},
  page: 1,
  pageSize: 1,
  timezone: 'Asia/Tehran' as const,
};
function fixture() {
  const source: ReportSource = {
    projection: 'reservations.reporting.registered-purchases.v1',
    chartMeasure: 'registeredAmount',
    warnings: [],
    columns: [
      { key: 'primaryDimension', label: 'تأمین‌کننده', kind: 'TEXT' },
      { key: 'secondaryDimension', label: 'نوع خدمت', kind: 'TEXT' },
      { key: 'currencyCode', label: 'ارز', kind: 'TEXT' },
      { key: 'recordCount', label: 'تعداد', kind: 'NUMBER' },
      { key: 'registeredAmount', label: 'خرید', kind: 'MONEY' },
    ],
    rows: [
      ['a', 'شرکت اول', 'FLIGHT', 'IRR', '9007199254740993.1234'],
      ['a', 'شرکت اول', 'FLIGHT', 'USD', '20'],
      ['b', 'شرکت دوم', 'HOTEL', 'IRR', '2000'],
      ['c', 'شرکت سوم', 'HOTEL', 'EUR', '40'],
    ].map(([id, name, kind, currency, money]) => ({
      id: id! + currency!,
      currencyGroupId: id!,
      distinctCounts: { recordCount: [id!] },
      at: new Date('2026-11-09Z'),
      updatedAt: new Date('2026-11-09Z'),
      values: {
        primaryDimension: name!,
        secondaryDimension: kind!,
        currencyCode: currency!,
        recordCount: 1,
        registeredAmount: money!,
      },
    })),
  };
  return assembleOperationalResult(
    'purchase_by_supplier',
    query,
    actor,
    source,
    true,
  );
}
describe('authorized output-grain report filters', () => {
  it('filters the whole source before pagination and keeps preview/chart/export identical', () => {
    const input = { ...query, filters: { columnSecondaryDimension: 'HOTEL' } };
    const table = filterReportOutput(fixture(), input);
    const chart = filterReportOutput(fixture(), { ...input, pageSize: 100 });
    const exported = filterReportOutput(fixture(), input, true);
    expect(table.total).toBe(2);
    expect(table.rows).toHaveLength(1);
    expect(chart.rows).toEqual(exported.rows);
    expect(exported.columnFilters).toEqual(
      table.columnFilters?.map(({ key, label }) => ({
        key,
        label,
        options: [],
      })),
    );
    expect(
      table.columnFilters?.find((c) => c.key === 'columnPrimaryDimension')
        ?.options,
    ).toHaveLength(3);
    expect(exported.rows.map((r) => r.primaryDimension)).toEqual(
      expect.arrayContaining(['شرکت دوم', 'شرکت سوم']),
    );
    const next = filterReportOutput(fixture(), { ...input, page: 2 });
    expect(next.rows[0]?.grainId).not.toBe(table.rows[0]?.grainId);
  });
  it('keeps distinct counts and exact currency legs together and exports readable filter labels', () => {
    const result = filterReportOutput(
      fixture(),
      { ...query, filters: { columnPrimaryDimension: 'شرکت اول' } },
      true,
    );
    expect(result.rows[0]?.sourceValues?.recordCount).toBe(1);
    expect(result.rows[0]?.amountsByCurrency).toEqual([
      { currencyCode: 'IRR', amount: '9007199254740993.1234' },
      { currencyCode: 'USD', amount: '20' },
    ]);
    const file = new ReportingExportService({} as LocalDocumentStorage).build(
      'XLSX',
      result,
      'خرید',
    );
    const sheet = strFromU8(
      unzipSync(new Uint8Array(file.buffer))['xl/worksheets/sheet1.xml']!,
    );
    expect(sheet).toContain('شرکت اول');
    expect(sheet).not.toContain('شرکت دوم');
    expect(sheet).not.toContain('columnPrimaryDimension');
  });
  it('normalizes Persian search, preserves source guards and rejects hidden or monetary predicates', () => {
    const result = filterReportOutput(
      fixture(),
      { ...query, filters: { search: 'شركت دوم' } },
      true,
    );
    expect(result.rows).toHaveLength(1);
    expect(
      filterReportOutput(
        fixture(),
        { ...query, filters: { search: '۹,۰۰۷,۱۹۹' } },
        true,
      ).rows,
    ).toHaveLength(1);
    const sourceQuery = reportSourceQuery({
      ...query,
      filters: {
        branch: 'branch',
        fromUtc: '2026-11-01T00:00:00.000Z',
        columnPrimaryDimension: 'شرکت اول',
        search: 'اول',
        unknownOwnerFilter: 'keep',
      },
    });
    expect(sourceQuery.filters).toEqual({
      branch: 'branch',
      fromUtc: '2026-11-01T00:00:00.000Z',
      unknownOwnerFilter: 'keep',
    });
    expect(() =>
      filterReportOutput(fixture(), {
        ...query,
        filters: { columnRegisteredAmount: '0' },
      }),
    ).toThrow();
    expect(() =>
      filterReportOutput(fixture(), {
        ...query,
        filters: { columnHiddenId: 'x' },
      }),
    ).toThrow();
    expect(() =>
      filterReportOutput(fixture(), { ...query, filters: { search: ['x'] } }),
    ).toThrow();
    expect(
      filterReportOutput(fixture(), { ...query, filters: { search: 'مفقود' } })
        .total,
    ).toBe(0);
  });
  it('recalculates native sales totals per currency and never adds cancelled pipeline money', () => {
    const base = fixture();
    const rows = base.rows.map((r, i) => ({
      ...r,
      primaryDimension: i === 0 ? 'CANCELLED' : 'CONFIRMED',
      amountsByCurrency: [
        { currencyCode: 'IRR', amount: String((i + 1) * 100) },
      ],
    }));
    const pipeline = {
      ...base,
      reportCode: 'sales_contract_pipeline',
      rows,
      totalsByCurrency: [
        {
          currencyCode: 'IRR',
          salesAmount: '500',
          purchaseAmount: '0',
          grossProfit: '0',
          refundAmount: '0',
          settlementBalance: '0',
        },
      ],
    };
    const cancelled = filterReportOutput(
      pipeline,
      { ...query, filters: { search: 'CANCELLED' } },
      true,
    );
    // sourceValues are authoritative; use a visible status dimension for this pipeline fixture.
    const corrected = {
      ...pipeline,
      rows: rows.map((r) => ({
        ...r,
        sourceValues: {
          ...r.sourceValues,
          primaryDimension: r.primaryDimension,
        },
      })),
    };
    expect(cancelled.total).toBe(0);
    expect(
      filterReportOutput(
        corrected,
        { ...query, filters: { columnPrimaryDimension: 'CANCELLED' } },
        true,
      ).totalsByCurrency,
    ).toEqual([]);
    const active = filterReportOutput(
      corrected,
      { ...query, filters: { columnPrimaryDimension: 'CONFIRMED' } },
      true,
    );
    expect(active.totalsByCurrency[0]?.salesAmount).toBe('500');
  });
});
