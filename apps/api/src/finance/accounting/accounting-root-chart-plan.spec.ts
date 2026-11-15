import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  planRootChart,
  type RootChartReference,
} from './accounting-root-chart-plan';

const reference = JSON.parse(
  readFileSync(
    resolve(
      process.cwd(),
      '../../data/accounting/rahkaran-group-general-1115.json',
    ),
    'utf8',
  ),
).accounts as RootChartReference[];
const book = '00000000-0000-4000-8000-000000000001';
describe('Rahkaran group/general chart preflight', () => {
  it('plans only the 13 observed groups and 36 general accounts, with stable book-local IDs and exact titles', () => {
    const first = planRootChart(book, [], reference);
    expect(first.create.filter((row) => row.level === 'GROUP')).toHaveLength(
      13,
    );
    expect(first.create.filter((row) => row.level === 'GENERAL')).toHaveLength(
      36,
    );
    expect(
      first.create.every((row) => ['GROUP', 'GENERAL'].includes(row.level)),
    ).toBe(true);
    expect(first.create.find((row) => row.code === '1110')).toMatchObject({
      title: 'موجودی نقد وبانک',
      parentId: first.create.find((row) => row.code === '11')!.id,
    });
    expect(planRootChart(book, [], reference)).toEqual(first);
    const other = planRootChart(
      '00000000-0000-4000-8000-000000000002',
      [],
      reference,
    );
    expect(
      other.create.every((row) => !first.create.some((a) => a.id === row.id)),
    ).toBe(true);
  });
  it('is idempotent and preserves existing custom groups, general accounts and subsidiaries', () => {
    const initial = planRootChart(book, [], reference);
    const custom = {
      ...initial.create[0]!,
      id: 'custom',
      code: '01',
      title: 'Existing custom group',
      level: 'GROUP' as const,
      parentId: null,
      bookId: book,
    };
    const subsidiary = {
      ...custom,
      id: 'subsidiary',
      code: '011001',
      level: 'SUBSIDIARY' as const,
      parentId: 'existing-general',
    };
    const rows = [
      ...initial.create.map((row) => ({ ...row, bookId: book })),
      custom,
      subsidiary,
    ];
    const before = JSON.stringify(rows);
    expect(planRootChart(book, rows, reference)).toMatchObject({
      create: [],
      matched: 49,
      untouched: 51,
    });
    expect(JSON.stringify(rows)).toBe(before);
  });
  it('fails before writes for a conflicting code, foreign book, subsidiary input or a broken parent', () => {
    const existing = {
      ...planRootChart(book, [], reference).create[0]!,
      bookId: book,
      title: 'Conflicting saved title',
    };
    expect(() => planRootChart(book, [existing], reference)).toThrow(
      'Existing account differs',
    );
    expect(() =>
      planRootChart(book, [{ ...existing, bookId: 'other' }], reference),
    ).toThrow('Foreign-book');
    expect(() =>
      planRootChart(
        book,
        [],
        [
          {
            ...reference[0]!,
            level: 'SUBSIDIARY',
          } as unknown as RootChartReference,
        ],
      ),
    ).toThrow('Only GROUP');
    expect(() =>
      planRootChart(
        book,
        [],
        [
          {
            ...reference.find((row) => row.level === 'GENERAL')!,
            parentCode: '99',
          },
        ],
      ),
    ).toThrow('parent');
  });
});
