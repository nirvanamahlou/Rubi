import { describe, expect, it } from 'vitest';
import { journalFilter } from './accounting.document-filters';

const rule = (
  field: string,
  operator = 'equals',
  value: unknown = 'value',
) => ({ type: 'rule', field, operator, value });
describe('document database filters', () => {
  it('compiles nested negative groups without flattening their logic', () => {
    expect(
      journalFilter({
        type: 'group',
        mode: 'none',
        children: [
          rule('description'),
          {
            type: 'group',
            mode: 'not-all',
            children: [
              rule('status', 'equals', 'DRAFT'),
              rule('number', 'equals', '12'),
            ],
          },
        ],
      }),
    ).toEqual({
      NOT: {
        OR: [
          { description: { equals: 'value' } },
          {
            NOT: {
              AND: [
                { status: { equals: 'DRAFT' } },
                { number: { equals: 12 } },
              ],
            },
          },
        ],
      },
    });
  });
  it('keeps all line predicates inside the same quantified line', () => {
    expect(
      journalFilter({
        type: 'lines',
        mode: 'any',
        condition: {
          type: 'group',
          mode: 'all',
          children: [
            rule('debit', 'equals', '۱۲۳٫۴۵'),
            rule('description', 'contains', 'receipt'),
          ],
        },
      }),
    ).toEqual({
      lines: {
        some: {
          AND: [
            { debit: { equals: '123.45' } },
            { description: { contains: 'receipt' } },
          ],
        },
      },
    });
  });
  it('preserves decimal strings rather than converting financial amounts to JS numbers', () => {
    expect(
      journalFilter({
        type: 'lines',
        mode: 'all',
        condition: rule(
          'debit',
          'equals',
          '99999999999999999999.123456789123456789',
        ),
      }),
    ).toEqual({
      lines: {
        every: { debit: { equals: '99999999999999999999.123456789123456789' } },
      },
    });
  });
  it('accepts validated date intervals', () => {
    expect(
      journalFilter({
        ...rule('documentDate', 'between', '2026-01-01'),
        end: '2026-01-31',
      }),
    ).toEqual({
      AND: [
        { documentDate: { gte: '2026-01-01' } },
        { documentDate: { lte: '2026-01-31' } },
      ],
    });
  });
  it.each([
    rule('bookId'),
    rule('maker.password'),
    rule('description', 'rawSql'),
    rule('number', 'equals', 'NaN'),
    rule('documentDate', 'equals', '2026-02-30'),
    { type: 'group', mode: 'unsafe', children: [rule('description')] },
    { type: 'lines', mode: 'any', condition: rule('makerId') },
  ])(
    'rejects unknown fields, operators, invalid values and cross-scope access',
    (input) => {
      expect(() => journalFilter(input)).toThrow();
    },
  );
  it('bounds recursive work and membership list size', () => {
    let input: unknown = rule('description');
    for (let i = 0; i < 10; i++)
      input = { type: 'group', mode: 'all', children: [input] };
    expect(() => journalFilter(input)).toThrow();
    expect(() =>
      journalFilter({ ...rule('number', 'in'), values: Array(51).fill('1') }),
    ).toThrow();
  });
  it('treats an empty filter group as no restriction', () => {
    expect(
      journalFilter({ type: 'group', mode: 'none', children: [] }),
    ).toEqual({});
  });
});
