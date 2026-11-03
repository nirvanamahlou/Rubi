import { describe, expect, it } from 'vitest';
import { matchesColumn, columnOperators } from './accounting-column-filter';
import type { ListRecord } from './accounting-list-filters';
const row = (value: string, isNull = false): ListRecord => ({
  id: 'row',
  values: { title: value },
  allocations: [],
  nullFields: isNull ? ['title'] : [],
});
describe('source list column filters', () => {
  it('keeps null distinct from an empty string and nonempty text', () => {
    expect(matchesColumn(row('', true), 'title', 'null', '')).toBe(true);
    expect(matchesColumn(row(''), 'title', 'null', '')).toBe(false);
    expect(matchesColumn(row('', true), 'title', 'empty', '')).toBe(false);
    expect(matchesColumn(row(''), 'title', 'empty', '')).toBe(true);
    expect(matchesColumn(row('2026'), 'title', 'not-empty', '')).toBe(true);
    expect(matchesColumn(row(''), 'title', 'not-null', '')).toBe(true);
  });
  it('evaluates the source text comparisons without conflating contains and equals', () => {
    const record = row('سال ۲۰۲۶');
    expect(matchesColumn(record, 'title', 'contains', '2026')).toBe(true);
    expect(matchesColumn(record, 'title', 'equals', '2026')).toBe(false);
    expect(matchesColumn(record, 'title', 'ends', '2026')).toBe(true);
    expect(matchesColumn(record, 'title', 'starts', 'سال')).toBe(true);
    expect(matchesColumn(record, 'title', 'not-contains', '2027')).toBe(true);
    expect(matchesColumn(record, 'title', 'not-equals', '2026')).toBe(true);
    for (const operator of ['gt', 'gte'] as const)
      expect(matchesColumn(row('2026'), 'title', operator, '2025')).toBe(true);
    for (const operator of ['lt', 'lte'] as const)
      expect(matchesColumn(row('2026'), 'title', operator, '2027')).toBe(true);
  });
  it('clears filters explicitly and does not constrain unfinished values', () => {
    expect(columnOperators).toHaveLength(15);
    expect(matchesColumn(row('2026'), 'title', 'none', 'different')).toBe(true);
    expect(matchesColumn(row('2026'), 'title', 'equals', '')).toBe(true);
    expect(matchesColumn(row('', true), 'title', 'not-equals', '2026')).toBe(
      false,
    );
  });
});
