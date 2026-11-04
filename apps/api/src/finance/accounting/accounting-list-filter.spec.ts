import { describe, expect, it } from 'vitest';
import { listFilterAttributes } from './accounting-list-filter';

const rule = {
  type: 'rule',
  id: 'title',
  field: 'title',
  operator: 'contains',
  value: '۱۴۰۵',
  relationMode: 'any',
};
const tree = { type: 'group', id: 'root', mode: 'all', children: [rule] };
const input = (filter: unknown = tree, listKind = 'fiscal-years') => ({
  listKind,
  filter: JSON.stringify(filter),
});
describe('saved accounting list filters', () => {
  it('round trips nested allocation predicates without evaluating values', () => {
    const filter = {
      ...tree,
      children: [
        {
          type: 'group',
          id: 'allocation',
          scope: 'allocations',
          mode: 'all',
          relationMode: 'any',
          children: [{ ...rule, field: 'allocation.title' }],
        },
      ],
    };
    expect(
      JSON.parse(String(listFilterAttributes(input(filter)).filter)),
    ).toEqual(filter);
  });
  it('rejects unknown lists, fields, operators and duplicate node IDs', () => {
    for (const attributes of [
      input(tree, 'unknown'),
      input({ ...tree, children: [{ ...rule, field: 'password' }] }),
      input({ ...tree, children: [{ ...rule, operator: 'execute' }] }),
      input({ ...tree, children: [rule, rule] }),
    ])
      expect(() => listFilterAttributes(attributes)).toThrow();
  });
  it('rejects too many nodes and excessive nesting', () => {
    expect(() =>
      listFilterAttributes(
        input({
          ...tree,
          children: Array.from({ length: 32 }, (_, i) => ({
            ...rule,
            id: String(i),
          })),
        }),
      ),
    ).toThrow();
    let nested: unknown = rule;
    for (let i = 0; i < 8; i++)
      nested = { ...tree, id: `group-${i}`, children: [nested] };
    expect(() => listFilterAttributes(input(nested))).toThrow();
  });
  it('rejects allocation scopes on other lists and unrelated fields inside allocations', () => {
    const filter = { ...tree, scope: 'allocations' };
    expect(() => listFilterAttributes(input(filter, 'ledgers'))).toThrow();
    expect(() => listFilterAttributes(input(filter))).toThrow();
  });
});
