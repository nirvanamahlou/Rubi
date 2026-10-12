import { renderToStaticMarkup } from 'react-dom/server';
import type * as React from 'react';
import type { AccountingAccountV1 } from '@nora/contracts';
import { describe, expect, it, vi } from 'vitest';
import { AccountingChartTree } from './accounting-chart-tree';

const state = vi.hoisted(() => ({ expanded: ['root'] }));
vi.mock('react', async (original) => {
  const react = await original<typeof React>();
  return {
    ...react,
    useState: (value: unknown) =>
      react.useState(Array.isArray(value) ? state.expanded : value),
  };
});
const accounts = [
  { id: 'group', parentId: null, code: '1', title: 'دارایی', level: 'GROUP' },
  {
    id: 'general',
    parentId: 'group',
    code: '101',
    title: 'وجوه نقد',
    level: 'GENERAL',
  },
  {
    id: 'subsidiary',
    parentId: 'general',
    code: '10101',
    title: 'صندوق',
    level: 'SUBSIDIARY',
  },
] as AccountingAccountV1[];

describe('restyled account tree', () => {
  it('preserves collapsed hierarchy, accessible selection and search controls', () => {
    state.expanded = ['root'];
    const html = renderToStaticMarkup(
      <AccountingChartTree
        accounts={accounts}
        selectedId="group"
        onSelect={vi.fn()}
      />,
    );
    expect(html).toContain('دارایی');
    expect(html).not.toContain('وجوه نقد');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('بازکردن شاخه دارایی');
    expect(html).toContain('مرتب سازی');
    expect(html).toContain('نتایج جستجو');
  });
  it('renders the same three-level parent-child hierarchy when expanded', () => {
    state.expanded = ['root', 'group', 'general'];
    const html = renderToStaticMarkup(
      <AccountingChartTree
        accounts={accounts}
        selectedId="subsidiary"
        onSelect={vi.fn()}
      />,
    );
    expect(html).toContain('وجوه نقد');
    expect(html).toContain('صندوق');
    expect(html).toContain('10101');
    expect(html.match(/<ul/g)).toHaveLength(3);
    expect(html).toContain('بستن شاخه دارایی');
    expect(html).toContain('data-selected="true"');
  });
});
