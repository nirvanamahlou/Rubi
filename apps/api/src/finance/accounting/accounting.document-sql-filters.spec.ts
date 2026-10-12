import { describe, it, expect } from 'vitest';
import { documentSqlFilter } from './accounting.document-sql-filters';
describe('bound document SQL filters', () => {
  it.each(['nonRefundableTax', 'nonRefundableDuty'])(
    'uses the observed checkbox operand for %s',
    (field) => {
      const filter = (value: unknown) =>
        documentSqlFilter({
          type: 'lines',
          mode: 'any',
          condition: {
            type: 'rule',
            field,
            operator: 'equals',
            value,
          },
        });
      expect(filter(true).values).toContain('true');
      expect(filter(false).values).toContain('false');
      expect(() => filter('123')).toThrow();
    },
  );
  it('never places a user operand in SQL text', () => {
    const input = "' OR TRUE; DROP TABLE accounting_journals; --";
    const query = documentSqlFilter({
      type: 'rule',
      field: 'description',
      operator: 'contains',
      value: input,
    });
    expect(query.sql).not.toContain(input);
    expect(query.values).toContain(input);
  });
  it('binds exact financial operands without Number conversion', () => {
    const query = documentSqlFilter({
      type: 'lines',
      mode: 'any',
      condition: {
        type: 'rule',
        field: 'debit',
        operator: 'between',
        value: '12345678901234567890.123456789012345678',
        end: '12345678901234567891',
      },
    });
    expect(query.values).toContain('12345678901234567890.123456789012345678');
    expect(query.sql).toContain('EXISTS');
  });
  it('covers absent JSON values and numeric ranges', () => {
    const empty = documentSqlFilter({
      type: 'rule',
      field: 'dailyNumber',
      operator: 'empty',
    });
    expect(empty.sql).toContain('IS NULL');
    const range = documentSqlFilter({
      type: 'rule',
      field: 'dailyNumber',
      operator: 'between',
      value: '2',
      end: '10',
    });
    expect(range.sql).toContain('::numeric');
  });
  it.each(['unknown', 'description); DROP TABLE accounting_books;--'])(
    'rejects unlisted field %s',
    (field) => {
      expect(() =>
        documentSqlFilter({
          type: 'rule',
          field,
          operator: 'equals',
          value: 'x',
        }),
      ).toThrow();
    },
  );
  it('rejects invalid group modes, operands and overdeep conditions', () => {
    expect(() =>
      documentSqlFilter({ type: 'group', mode: 'bad', children: [] }),
    ).toThrow();
    expect(() =>
      documentSqlFilter({
        type: 'rule',
        field: 'makerId',
        operator: 'equals',
        value: 'no',
      }),
    ).toThrow();
    let node: unknown = { type: 'group', mode: 'all', children: [] };
    for (let n = 0; n < 10; n++)
      node = { type: 'group', mode: 'all', children: [node] };
    expect(() => documentSqlFilter(node)).toThrow();
  });
});
