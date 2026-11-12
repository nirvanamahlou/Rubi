import { describe, expect, it } from 'vitest';
import type { CompletionLineReport } from './accounting-completion-routes';
import { electronicBookRows } from './accounting-electronic-book';

const report: CompletionLineReport = {
  basis: 'POSTED',
  currency: 'IRR',
  periodId: 'synthetic',
  from: '2026-01-01',
  to: '2026-12-31',
  page: 1,
  pageSize: 20000,
  total: 1,
  debit: '9007199254740993.000000000000000001',
  credit: '0',
  rows: [
    {
      id: 'line',
      journalId: 'journal',
      number: 5,
      date: '2026-03-21',
      position: 0,
      account: '0001 — Synthetic',
      accountCode: '0001',
      accountTitle: 'Synthetic',
      generalCode: '001',
      generalTitle: 'General',
      journalDescription: 'Header',
      detail4: null,
      detail5: null,
      detail6: null,
      description: 'Line',
      debit: '9007199254740993.000000000000000001',
      credit: '0',
      currency: null,
      foreignAmount: null,
      rate: null,
    },
  ],
};
describe('internal electronic book export', () => {
  it('keeps account codes as strings and large exact amounts with optional columns aligned', () => {
    const rows = electronicBookRows(report, {
      code: true,
      title: true,
      description: true,
    });
    expect(rows[3]).toEqual([
      '5',
      '2026-03-21',
      '001',
      'General',
      '0001',
      'Synthetic',
      'Header',
      'Line',
      '9007199254740993.000000000000000001',
      '0',
    ]);
    expect(rows[3]!.length).toBe(rows[2]!.length);
    expect(rows[0]).toEqual(['دفاتر تجاری الکترونیکی — گزارش داخلی']);
  });
  it('removes unchecked optional columns without losing journal/date/amount lineage', () => {
    const rows = electronicBookRows(report, {
      code: false,
      title: false,
      description: false,
    });
    expect(rows[3]).toEqual([
      '5',
      '2026-03-21',
      '001',
      'General',
      'Line',
      '9007199254740993.000000000000000001',
      '0',
    ]);
    expect(rows[3]!.length).toBe(rows[2]!.length);
  });
});
