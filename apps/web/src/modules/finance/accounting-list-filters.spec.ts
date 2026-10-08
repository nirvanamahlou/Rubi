import { describe, expect, it } from 'vitest';
import {
  combineMatches,
  filterRecords,
  listFields,
  matchesFilter,
  normalizeFilterText,
  type FilterRule,
  type ListRecord,
  type FilterGroup,
} from './accounting-list-filters';
const fields = listFields('fiscal-years');
const record: ListRecord = {
  id: '1',
  values: {
    title: 'سال مالی ۱۴۰۵',
    titleEn: '',
    description: '',
    active: 'true',
  },
  allocations: [
    { title: 'دفتر اصلی', startDate: '2026-03-21' },
    { title: 'دفتر فرعی', startDate: '2027-03-21' },
  ],
};
const rule = (field: string, value: string): FilterRule => ({
  type: 'rule',
  id: 'rule',
  field,
  value,
  operator: 'contains',
  relationMode: 'any',
});
describe('accounting list filter semantics', () => {
  it('ignores unfinished empty subgroups even under negation', () => {
    expect(
      matchesFilter(
        record,
        {
          type: 'group',
          id: 'root',
          mode: 'none',
          children: [{ type: 'group', id: 'empty', mode: 'all', children: [] }],
        },
        fields,
      ),
    ).toBe(true);
    expect(
      matchesFilter(
        record,
        {
          type: 'group',
          id: 'root',
          mode: 'none',
          children: [
            rule('title', '۱۴۰۴'),
            { type: 'group', id: 'empty', mode: 'any', children: [] },
          ],
        },
        fields,
      ),
    ).toBe(true);
  });
  it('distinguishes all four group modes for mixed, all and empty results', () => {
    expect(
      ['all', 'any', 'not-all', 'none'].map((mode) =>
        combineMatches([true, false], mode as FilterGroup['mode']),
      ),
    ).toEqual([false, true, true, false]);
    expect(
      ['all', 'any', 'not-all', 'none'].map((mode) =>
        combineMatches([true, true], mode as FilterGroup['mode']),
      ),
    ).toEqual([true, true, false, false]);
    expect(
      ['all', 'any', 'not-all', 'none'].map((mode) =>
        combineMatches([], mode as FilterGroup['mode']),
      ),
    ).toEqual([true, false, false, true]);
  });
  it('combines nested conditions without flattening their logic', () => {
    const filter: FilterGroup = {
      type: 'group',
      id: 'root',
      mode: 'all',
      children: [
        rule('title', '۱۴۰۵'),
        {
          type: 'group',
          id: 'nested',
          mode: 'none',
          children: [rule('title', '۱۴۰۴'), rule('active', 'false')],
        },
      ],
    };
    expect(matchesFilter(record, filter, fields)).toBe(true);
    expect(
      matchesFilter(
        { ...record, values: { ...record.values, active: 'false' } },
        filter,
        fields,
      ),
    ).toBe(false);
  });
  it('evaluates allocation quantifiers against actual related rows including unassigned years', () => {
    const predicate = rule('allocation.title', 'اصلی');
    expect(matchesFilter(record, predicate, fields)).toBe(true);
    expect(
      matchesFilter(record, { ...predicate, relationMode: 'all' }, fields),
    ).toBe(false);
    expect(
      matchesFilter(record, { ...predicate, relationMode: 'not-all' }, fields),
    ).toBe(true);
    expect(
      matchesFilter(record, { ...predicate, relationMode: 'none' }, fields),
    ).toBe(false);
    expect(
      matchesFilter({ ...record, allocations: [] }, predicate, fields),
    ).toBe(false);
    expect(
      matchesFilter(
        { ...record, allocations: [] },
        { ...predicate, relationMode: 'none' },
        fields,
      ),
    ).toBe(true);
  });
  it('normalizes Persian/Arabic characters and digits without coercing record values', () => {
    expect(normalizeFilterText(' مالي ١٤٠٥ ')).toBe(
      normalizeFilterText('مالی ۱۴۰۵'),
    );
    const result = filterRecords(
      [record],
      { type: 'group', id: 'root', mode: 'all', children: [] },
      fields,
      'مالي 1405',
    );
    expect(result).toEqual([record]);
    expect(result[0]?.values.title).toBe('سال مالی ۱۴۰۵');
  });
  it('handles optional text, exact date comparisons and unknown fields', () => {
    expect(
      matchesFilter(
        record,
        { ...rule('titleEn', ''), operator: 'empty' },
        fields,
      ),
    ).toBe(true);
    expect(
      matchesFilter(
        record,
        { ...rule('allocation.startDate', '2027-01-01'), operator: 'before' },
        fields,
      ),
    ).toBe(true);
    expect(matchesFilter(record, rule('unknown', ''), fields)).toBe(false);
  });
  it('counts only the full filtered collection independently of display pagination', () => {
    const records = Array.from({ length: 71 }, (_, index) => ({
      ...record,
      id: String(index),
      values: { ...record.values, active: String(index % 2 === 0) },
    }));
    expect(
      filterRecords(
        records,
        {
          type: 'group',
          id: 'root',
          mode: 'all',
          children: [rule('active', 'true')],
        },
        fields,
        '',
      ),
    ).toHaveLength(36);
  });
});
