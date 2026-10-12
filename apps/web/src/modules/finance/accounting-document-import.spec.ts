import { describe, expect, it } from 'vitest';
import type { AccountingSnapshotV1 } from '@nora/contracts';
import {
  accountingImportDate,
  prepareAccountingDocumentImport,
} from './accounting-document-import';

const book = {
  book: { baseCurrency: 'IRR' },
  periods: [
    {
      id: 'period',
      status: 'OPEN',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    },
  ],
  accounts: [
    { id: 'account', code: '001101', active: true, level: 'SUBSIDIARY' },
  ],
  details: [],
  fxRates: [],
} as unknown as AccountingSnapshotV1;
const row = (position = '1', key = 'A') => {
  const cells = Array.from({ length: 50 }, () => '');
  cells[0] = key;
  cells[2] = '11/10/2026';
  cells[6] = position;
  cells[7] = '001101';
  cells[10] = 'Synthetic line';
  cells[15] = '9007199254740993.123456789012345678';
  cells[16] = '0';
  return cells;
};
describe('accounting source workbook preparation', () => {
  it('preserves leading account zeros, exact amounts and source line order', () => {
    const second = row('2'),
      first = row('1');
    first[10] = 'First';
    const result = prepareAccountingDocumentImport(
      [second, first],
      book,
      false,
    );
    expect(result.errors).toEqual([]);
    expect(result.documents[0]?.lines.map((line) => line.description)).toEqual([
      'First',
      'Synthetic line',
    ]);
    expect(result.documents[0]?.lines[0]?.accountId).toBe('account');
    expect(result.documents[0]?.lines[0]?.debit).toBe(
      '9007199254740993.123456789012345678',
    );
  });
  it('rejects a whole document if any line contains an unsupported populated column', () => {
    const bad = row('2');
    bad[40] = 'مشمول';
    const result = prepareAccountingDocumentImport(
      [row(), bad, row('1', 'B')],
      book,
      false,
    );
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.row).toBe(3);
    expect(result.documents.map((doc) => doc.key)).toEqual(['B']);
  });
  it('stops at first error and rejects duplicate positions without silently overwriting', () => {
    const result = prepareAccountingDocumentImport(
      [row(), row(), row('1', 'B')],
      book,
      true,
    );
    expect(result.errors).toHaveLength(1);
    expect(result.documents).toEqual([]);
  });
  it('rejects unresolvable accounts, closed periods and scientific notation', () => {
    const missing = row();
    missing[7] = 'MISSING';
    expect(
      prepareAccountingDocumentImport([missing], book, false).errors,
    ).toHaveLength(1);
    const outside = row();
    outside[2] = '2027-01-01';
    expect(
      prepareAccountingDocumentImport([outside], book, false).errors,
    ).toHaveLength(1);
    const scientific = row();
    scientific[15] = '1e20';
    expect(
      prepareAccountingDocumentImport([scientific], book, false).errors,
    ).toHaveLength(1);
  });
  it('validates dates and handles Excel serials without accepting calendar overflow', () => {
    expect(accountingImportDate('11/10/2026')).toBe('2026-10-11');
    expect(accountingImportDate('۴۶۲۰۰')).toBe('2026-06-27');
    expect(() => accountingImportDate('2026-02-30')).toThrow();
    expect(() => accountingImportDate('31/04/2026')).toThrow();
  });
  it('allows an incomplete memorandum but rejects a supplied unknown account', () => {
    const incomplete = row();
    incomplete[7] = '';
    const memorandum = prepareAccountingDocumentImport(
      [incomplete],
      book,
      false,
      true,
    );
    expect(memorandum.errors).toEqual([]);
    expect(memorandum.documents[0]?.lines[0]?.accountId).toBeNull();
    expect(
      prepareAccountingDocumentImport([incomplete], book, false).errors,
    ).toHaveLength(1);
    incomplete[7] = 'UNKNOWN';
    expect(
      prepareAccountingDocumentImport([incomplete], book, false, true).errors,
    ).toHaveLength(1);
  });
  it('resolves the observed branch column without accepting another branch or partial documents', () => {
    const withBranch = (cells: string[], code: string) => [
      ...cells.slice(0, 3),
      code,
      ...cells.slice(3),
    ];
    const valid = prepareAccountingDocumentImport(
      [withBranch(row(), '۰۰۱')],
      book,
      false,
      false,
      '001',
    );
    expect(valid.errors).toEqual([]);
    expect(valid.documents[0]?.lines[0]?.accountId).toBe('account');
    const mixed = prepareAccountingDocumentImport(
      [withBranch(row(), '001'), withBranch(row('2'), '002')],
      book,
      false,
      false,
      '001',
    );
    expect(mixed.errors).toHaveLength(1);
    expect(mixed.documents).toEqual([]);
  });
});
