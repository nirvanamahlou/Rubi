import { describe, expect, it } from 'vitest';
import type {
  AccountingAccountV1,
  AccountingSnapshotV1,
} from '@nora/contracts';
import { createChartReport, orderedChart } from './accounting-chart-report';

const account = (
  id: string,
  code: string,
  parentId: string | null = null,
  level: AccountingAccountV1['level'] = 'GROUP',
): AccountingAccountV1 => ({
  id,
  code,
  parentId,
  level,
  bookId: 'book',
  title: `title-${id}`,
  nature: 'DEBIT',
  permanent: true,
  active: true,
  version: 1,
  attributes: {},
});
const snapshot = (accounts: AccountingAccountV1[]): AccountingSnapshotV1 => ({
  book: {
    id: 'book',
    branchId: 'branch',
    code: '1',
    title: 'book',
    baseCurrency: 'IRR',
    isMain: true,
    allowsPosting: true,
    active: true,
    version: 1,
  },
  accounts,
  configurations: [],
  details: [],
  periods: [],
  fxRates: [],
  accountGroups: [],
  detailGroups: [],
  templates: [],
});

describe('chart reports over persisted records', () => {
  it('preserves every real account once, parents before children and numeric code ordering', () => {
    const rows = orderedChart([
      account('b', '10'),
      account('child', '21', 'a', 'GENERAL'),
      account('a', '2'),
      account('orphan', '99', 'missing'),
    ]);
    expect(rows.map(({ account: a, depth }) => [a.id, depth])).toEqual([
      ['a', 0],
      ['child', 1],
      ['b', 0],
      ['orphan', 0],
    ]);
  });
  it('terminates malformed cycles without dropping records', () => {
    expect(
      orderedChart([account('a', '1', 'b'), account('b', '2', 'a')]).map(
        ({ account: a }) => a.id,
      ),
    ).toEqual(['a', 'b']);
  });
  it('limits rows and assigned detail types to the selected book', () => {
    const subsidiary = account('sub', '1001', null, 'SUBSIDIARY');
    subsidiary.attributes = {
      detail4TypeIds: ['allowed', 'foreign', 'missing'],
      counterpartId: 'foreign-account',
    };
    const book = snapshot([
      subsidiary,
      { ...account('foreign-account', '20'), bookId: 'other' },
    ]);
    book.configurations = [
      { ...account('allowed', '1'), kind: 'detail-types', title: 'صندوق' },
      {
        ...account('foreign', '2'),
        kind: 'detail-types',
        bookId: 'other',
        title: 'private',
      },
    ];
    const result = createChartReport(book, {
      format: 'STRUCTURAL',
      structure: 'detail-types',
      selected: [],
    });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.values.detail4).toBe('صندوق');
    expect(result.rows[0]?.values.counterpart).toBe('');
    expect(JSON.stringify(result)).not.toContain('private');
  });
  it('uses selected columns, persisted properties and actual enabled levels', () => {
    const sub = {
      ...account('sub', '1001', null, 'SUBSIDIARY'),
      permanent: false,
      nature: 'CREDIT' as const,
      active: false,
      attributes: {
        detailLevels: ['4', '5', '5'],
        detail6TypeIds: ['old'],
        taxAccountKind: 'TAX',
        taxType: 'مالیات',
        traceable: true,
      },
    };
    const result = createChartReport(snapshot([account('group', '1'), sub]), {
      format: 'SUBSIDIARY',
      structure: 'accounts',
      selected: ['nature', 'levels', 'taxType', 'unknown'],
    });
    expect(result.columns.map((c) => c.key)).toEqual([
      'code',
      'title',
      'nature',
      'levels',
      'taxType',
    ]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.values).toMatchObject({
      nature: 'بستانکار',
      levels: '2',
      taxType: 'مالیات',
      type: 'موقت',
      active: 'غیرفعال',
      currency: '',
    });
  });
  it('resolves authorized mapping destinations, omitting unavailable names instead of fabricating values', () => {
    const book = snapshot([account('source', '1', null, 'SUBSIDIARY')]);
    book.subsidiaryMappings = [
      {
        id: 'mapping',
        bookId: 'book',
        sourceAccountId: 'source',
        targetAccountId: 'target',
        detail4Id: null,
        detail5Id: null,
        detail6Id: null,
        version: 1,
      },
    ];
    const selection = {
      format: 'SUBSIDIARY' as const,
      structure: 'accounts' as const,
      selected: ['mapping'],
    };
    expect(createChartReport(book, selection).rows[0]?.values.mapping).toBe('');
    expect(
      createChartReport(book, selection, [
        {
          ...account('target', '9001'),
          bookId: 'accessible-book',
          title: 'مقصد',
        },
      ]).rows[0]?.values.mapping,
    ).toBe('9001 — مقصد');
  });
  it('expands the source feature checkbox into three independent observed output columns', () => {
    const sub = account('sub', '1001', null, 'SUBSIDIARY');
    sub.attributes = {
      multiCurrency: true,
      traceable: false,
      revaluable: true,
    };
    const result = createChartReport(snapshot([sub]), {
      format: 'SUBSIDIARY',
      structure: 'accounts',
      selected: ['features'],
    });
    expect(result.columns.map((column) => column.key)).toEqual([
      'code',
      'title',
      'multiCurrency',
      'traceable',
      'revaluable',
    ]);
    expect(result.rows[0]?.values).toMatchObject({
      multiCurrency: 'دارد',
      traceable: 'ندارد',
      revaluable: 'دارد',
    });
  });
  it('omits unassigned accounts from structural detail and counterpart reports', () => {
    const book = snapshot([
      account('group', '1'),
      account('unassigned', '1001', null, 'SUBSIDIARY'),
    ]);
    for (const structure of ['detail-types', 'counterparts'] as const)
      expect(
        createChartReport(book, {
          format: 'STRUCTURAL',
          structure,
          selected: [],
        }).rows,
      ).toEqual([]);
  });
});
