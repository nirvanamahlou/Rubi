import { describe, expect, it } from 'vitest';

import {
  aggregateOnceByGrain,
  assertSingleCurrency,
  createFilterSnapshot,
  escapeSpreadsheetCell,
  validateExportRequest,
  validateReportQuery,
} from './reporting.policy';

describe('reporting safety policy', () => {
  it.each([
    ['passengers', ['p-1', 'p-2']],
    ['segments', ['s-1', 's-2', 's-3']],
    ['payments', ['pay-1', 'pay-2']],
  ])(
    'does not duplicate a contract amount after joining %s',
    (_label, dimensions) => {
      const joined = dimensions.map(() => ({
        grainId: 'contract-1',
        amount: 12500n,
      }));
      expect(aggregateOnceByGrain(joined, (row) => row.amount)).toBe(12500n);
    },
  );

  it('rejects mixed-currency totals without an approved FX snapshot', () => {
    expect(() =>
      assertSingleCurrency([
        { amount: '10.00', currencyCode: 'USD' },
        { amount: '20.00', currencyCode: 'IRR' },
      ]),
    ).toThrow(/FX Snapshot/);
  });

  it('validates pagination and UTC boundaries', () => {
    expect(() =>
      validateReportQuery({
        filters: { fromUtc: '2026-09-09' },
        page: 1,
        pageSize: 20,
        timezone: 'Asia/Tehran',
      }),
    ).toThrow(/UTC/);
  });

  it.each(['=1+1', '+SUM(A1:A2)', '-2+3', '@cmd', '\tpayload'])(
    'neutralizes spreadsheet formula input %s',
    (value) => expect(escapeSpreadsheetCell(value)).toBe(`'${value}`),
  );

  it('captures an immutable filter snapshot with grain and scope', () => {
    const filters = { status: ['POSTED'] };
    const snapshot = createFilterSnapshot({
      reportCode: 'account_balances',
      reportVersion: 1,
      grain: 'JOURNAL',
      capturedAtUtc: '2026-09-09T09:00:00.000Z',
      query: {
        filters,
        branchIds: ['branch-1'],
        legalEntityId: 'company-1',
        page: 1,
        pageSize: 50,
        timezone: 'Asia/Tehran',
      },
    });
    filters.status.push('DRAFT');
    expect(snapshot.filters.status).toEqual(['POSTED']);
    expect(snapshot.grain).toBe('JOURNAL');
  });

  it('requires a single issuer for official PDF exports', () => {
    expect(() =>
      validateExportRequest(
        {
          reportCode: 'sales_by_organization',
          format: 'PDF',
          includeSensitive: false,
          issuerLegalEntityId: 'ALL',
          query: {
            filters: {},
            page: 1,
            pageSize: 20,
            timezone: 'Asia/Tehran',
          },
        },
        ['reporting.export'],
      ),
    ).toThrow(/شرکت صادرکننده/);
  });

  it('requires sensitive-export permission separately', () => {
    expect(() =>
      validateExportRequest(
        {
          reportCode: 'hr_performance',
          format: 'XLSX',
          includeSensitive: true,
          query: {
            filters: {},
            page: 1,
            pageSize: 20,
            timezone: 'Asia/Tehran',
          },
        },
        ['reporting.export'],
      ),
    ).toThrow(/حساس/);
  });
});
