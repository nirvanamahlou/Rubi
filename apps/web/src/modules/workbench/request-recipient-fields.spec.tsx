import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  selects: [] as Array<{
    label: string;
    value: string;
    disabled: boolean;
    options: Array<{ value: string; label: string }>;
    onValueChange: (id: string) => void;
  }>,
}));
vi.mock('./workbench-select', () => ({
  WorkbenchSelect: (props: (typeof state.selects)[number]) => {
    state.selects.push(props);
    return (
      <select
        aria-label={props.label}
        disabled={props.disabled}
        defaultValue={props.value}
      >
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  },
}));
import { RequestRecipientFields } from './request-recipient-fields';
const units = [
  {
    id: 'reservation',
    name: 'رزرواسیون',
    users: [
      {
        id: 'receiver',
        displayName: 'Reservation Receiver',
        username: 'reservation-user',
      },
    ],
  },
  {
    id: 'sales',
    name: 'فروش',
    users: [{ id: 'sales-user', displayName: 'Sales User', username: 'sales' }],
  },
  { id: 'empty', name: 'بدون عضو', users: [] },
];
describe('Workbench real unit recipient fields', () => {
  beforeEach(() => {
    state.selects = [];
  });
  it('offers only actual members of the selected unit with real account IDs', () => {
    const html = renderToStaticMarkup(
      <RequestRecipientFields
        units={units}
        unitId="reservation"
        recipientId="receiver"
        disabled={false}
        onUnitChange={vi.fn()}
        onRecipientChange={vi.fn()}
      />,
    );
    expect(html).toContain('Reservation Receiver');
    expect(html).not.toContain('Sales User');
    expect(state.selects[1]!.options[0]!.value).toBe('receiver');
  });
  it('clears the previous recipient before changing unit', () => {
    const change = vi.fn();
    const recipient = vi.fn();
    renderToStaticMarkup(
      <RequestRecipientFields
        units={units}
        unitId="reservation"
        recipientId="receiver"
        disabled={false}
        onUnitChange={change}
        onRecipientChange={recipient}
      />,
    );
    state.selects[0]!.onValueChange('sales');
    expect(recipient).toHaveBeenCalledWith('');
    expect(change).toHaveBeenCalledWith('sales');
    expect(recipient.mock.invocationCallOrder[0]).toBeLessThan(
      change.mock.invocationCallOrder[0]!,
    );
  });
  it('disables the recipient field for a unit with no configured active accounts', () => {
    const html = renderToStaticMarkup(
      <RequestRecipientFields
        units={units}
        unitId="empty"
        recipientId=""
        disabled={false}
        onUnitChange={vi.fn()}
        onRecipientChange={vi.fn()}
      />,
    );
    expect(state.selects[1]!.disabled).toBe(true);
    expect(state.selects[1]!.options).toEqual([]);
    expect(html).toContain('کاربر فعالی');
  });
  it('disables both controls while loading or submitting', () => {
    renderToStaticMarkup(
      <RequestRecipientFields
        units={units}
        unitId="reservation"
        recipientId="receiver"
        disabled
        onUnitChange={vi.fn()}
        onRecipientChange={vi.fn()}
      />,
    );
    expect(state.selects.every((select) => select.disabled)).toBe(true);
  });
});
