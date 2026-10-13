import { describe, expect, it } from 'vitest';
import type { AccountingSnapshotV1 } from '@nora/contracts';
import { accountingSnapshotKpis } from './accounting-page-kpis';
import { accountingParityDefinitions } from './components/accounting-parity-definitions';

const snapshot = {
  book: { id: 'book-a' },
  periods: [],
  accounts: [],
  details: [],
  configurations: [],
  fxRates: [],
  accountGroups: [],
  detailGroups: [],
  templates: [],
} as unknown as AccountingSnapshotV1;
const values = (route: string, book = snapshot) =>
  accountingSnapshotKpis(route, book, []).map((k) => k.value);

describe('authorized accounting page metrics', () => {
  it('keeps missing data distinct from a confirmed empty snapshot on every page', () => {
    for (const page of accountingParityDefinitions) {
      const absent = accountingSnapshotKpis(page.route, undefined, undefined);
      expect(absent).toHaveLength(4);
      expect(absent.every((k) => k.value === null)).toBe(true);
    }
    expect(values('general-ledger/accounts/details')).toEqual([0, 0, 0, 0]);
    expect(values('receipts-payments/base-information/banks')).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });
  it('counts account levels and status using the supplied book only', () => {
    const book = {
      ...snapshot,
      accounts: [
        { level: 'GROUP', active: true },
        { level: 'GENERAL', active: false },
        { level: 'SUBSIDIARY', active: true },
      ],
    } as AccountingSnapshotV1;
    expect(values('general-ledger/accounts/chart', book)).toEqual([1, 1, 1, 2]);
    expect(snapshot.accounts).toHaveLength(0);
  });
  it('shares converter metrics between editor and list and tolerates an older snapshot', () => {
    const book = {
      ...snapshot,
      detailConversions: [
        { state: 'REGISTERED', userTypeId: 'a' },
        { state: 'CONVERTED', userTypeId: 'a' },
      ],
    } as AccountingSnapshotV1;
    expect(
      values('general-ledger/accounts/detail-type-converter', book),
    ).toEqual([2, 1, 1, 1]);
    expect(
      values('general-ledger/accounts/lists/detail-type-converters', book),
    ).toEqual([2, 1, 1, 1]);
    expect(values('general-ledger/accounts/mappings')).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });
  it('does not mix automatic, revaluation and closing templates', () => {
    const book = {
      ...snapshot,
      templates: [
        {
          kind: 'CLOSING',
          active: true,
          lines: [{ include: true }, { include: false }],
        },
        { kind: 'AUTOMATIC', active: true, lines: [{ include: true }] },
      ],
    } as AccountingSnapshotV1;
    expect(
      values('general-ledger/year-end/lists/closing-templates', book),
    ).toEqual([1, 1, 2, 1]);
    expect(
      values('general-ledger/documents/automatic-templates', book),
    ).toEqual([1, 1, 1, 1]);
  });
});
