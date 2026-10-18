import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SelectHTMLAttributes } from 'react';
const state = vi.hoisted(() => ({
  props: null as SelectHTMLAttributes<HTMLSelectElement> | null,
}));
vi.mock('@/components/ui/native-search-select', () => ({
  NativeSearchSelect: (props: SelectHTMLAttributes<HTMLSelectElement>) => {
    state.props = props;
    return (
      <select
        value={props.value}
        disabled={props.disabled}
        onChange={props.onChange}
      >
        {props.children}
      </select>
    );
  },
}));
import { UserUnitSelect } from './user-unit-select';
const units = [
  { id: 'unit', name: 'Sales Department', branchId: 'allowed' },
  { id: 'other', name: 'Other Branch Department', branchId: 'outside' },
];
describe('HR-backed user unit selector', () => {
  it('shows only the selected account branches and keeps the saved unit selected', () => {
    const change = vi.fn();
    const html = renderToStaticMarkup(
      <UserUnitSelect
        value="unit"
        units={units}
        branchIds={['allowed']}
        disabled={false}
        onChange={change}
      />,
    );
    expect(html).toContain('Sales Department');
    expect(html).not.toContain('Other Branch Department');
    expect(state.props?.value).toBe('unit');
    expect(change).not.toHaveBeenCalled();
  });
  it('forwards the real unit ID and supports explicitly clearing it', () => {
    const change = vi.fn();
    renderToStaticMarkup(
      <UserUnitSelect
        value=""
        units={units}
        branchIds={['allowed']}
        disabled={false}
        onChange={change}
      />,
    );
    state.props?.onChange?.({ target: { value: 'unit' } } as never);
    state.props?.onChange?.({ target: { value: '' } } as never);
    expect(change.mock.calls).toEqual([['unit'], ['']]);
  });
  it('retains unavailable existing units without silently clearing them', () => {
    const html = renderToStaticMarkup(
      <UserUnitSelect
        value="archived"
        units={[]}
        branchIds={['allowed']}
        disabled={false}
        onChange={vi.fn()}
      />,
    );
    expect(html).toContain('value="archived"');
    expect(html).toContain('واحد فعلی');
    expect(state.props?.value).toBe('archived');
  });
  it('disables editing for a read-only or saving form', () => {
    renderToStaticMarkup(
      <UserUnitSelect
        value="unit"
        units={units}
        branchIds={['allowed']}
        disabled
        onChange={vi.fn()}
      />,
    );
    expect(state.props?.disabled).toBe(true);
  });
});
