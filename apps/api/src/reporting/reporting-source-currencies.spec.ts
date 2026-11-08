import { describe, expect, it } from 'vitest';
import { assembleOperationalResult } from './reporting-native-operational';
import type { ReportSource } from '../common/report-source';
import { ReportingExportService } from './reporting-export.service';
import type { LocalDocumentStorage } from '../documents/documents.storage';
import { strFromU8, unzipSync } from 'fflate';

const at = new Date('2026-11-08T00:00:00Z');
const source: ReportSource = {
  projection: 'sales.reporting.cancellations.v1',
  chartMeasure: 'cancelledAmount',
  warnings: [],
  columns: [
    { key: 'primaryDimension', label: 'شعبه', kind: 'TEXT' },
    { key: 'currencyCode', label: 'ارز', kind: 'TEXT' },
    { key: 'recordCount', label: 'قرارداد', kind: 'NUMBER' },
    { key: 'cancelledAmount', label: 'مبلغ ابطال', kind: 'MONEY' },
  ],
  rows: [
    ['IRR', '9007199254740993.1234'],
    ['USD', '25'],
  ].map(([currency, amount]) => ({
    id: currency!,
    currencyGroupId: 'branch-owner',
    distinctCounts: { recordCount: ['contract-1'] },
    at,
    updatedAt: at,
    values: {
      primaryDimension: 'مرکزی',
      currencyCode: currency!,
      recordCount: 1,
      cancelledAmount: amount!,
    },
  })),
};
const query = {
  filters: {},
  page: 1,
  pageSize: 5,
  timezone: 'Asia/Tehran' as const,
};
const actor = { userId: 'user', permissions: [], branchIds: ['branch'] };
describe('source currency consolidation', () => {
  it('deduplicates identity before paging and shares exact values with charts and XLSX', () => {
    const r = assembleOperationalResult(
      'cancellations_refunds',
      query,
      actor,
      source,
    );
    const all = assembleOperationalResult(
      'cancellations_refunds',
      query,
      actor,
      source,
      true,
    );
    expect(r.rows).toEqual(all.rows);
    expect(r.total).toBe(1);
    expect(r.rows[0]?.sourceValues?.recordCount).toBe(1);
    expect(r.rows[0]?.sourceValues?.cancelledAmount).toBe(
      '9007199254740993.1234 ریال + 25 $',
    );
    expect(r.rows[0]?.amountsByCurrency).toEqual([
      { currencyCode: 'IRR', amount: '9007199254740993.1234' },
      { currencyCode: 'USD', amount: '25' },
    ]);
    expect(r.columns.map((c) => c.key)).not.toContain('currencyCode');
    const file = new ReportingExportService({} as LocalDocumentStorage).build(
      'XLSX',
      all,
      'ابطال',
    );
    const sheet = strFromU8(
      unzipSync(new Uint8Array(file.buffer))['xl/worksheets/sheet1.xml']!,
    );
    expect(sheet).toContain('9,007,199,254,740,993.1234 ریال + 25 $');
    expect(source.rows[0]?.values.currencyCode).toBe('IRR');
  });
  it('does not merge different producer IDs with identical labels and counts distinct purchases additively', () => {
    const other = {
      ...source,
      rows: source.rows.map((r, i) => ({
        ...r,
        currencyGroupId: 'purchase-group',
        distinctCounts: { recordCount: [`purchase-${i}`] },
      })),
    };
    expect(
      assembleOperationalResult('cancellations_refunds', query, actor, other)
        .rows[0]?.sourceValues?.recordCount,
    ).toBe(2);
    const separate = {
      ...source,
      rows: source.rows.map((r, i) => ({
        ...r,
        currencyGroupId: `group-${i}`,
      })),
    };
    expect(
      assembleOperationalResult('cancellations_refunds', query, actor, separate)
        .total,
    ).toBe(2);
  });
});
