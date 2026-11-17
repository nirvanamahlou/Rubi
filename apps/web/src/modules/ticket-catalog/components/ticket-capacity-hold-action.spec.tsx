import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
import { TicketCapacityHoldAction } from './ticket-capacity-hold-action';
const f = vi.hoisted(() => ({
  button: undefined as React.ComponentProps<'button'> | undefined,
}));
vi.mock('@/components/ui', () => ({
  Button: ({ children, ...props }: React.ComponentProps<'button'>) => {
    f.button = { children, ...props };
    return <button {...props}>{children}</button>;
  },
}));
const now = Date.parse('2030-01-01T00:00:00Z');
const offer = {
  status: 'ACTIVE' as const,
  departureAt: '2030-01-02T00:00:00Z',
  remainingCapacity: 0,
};
beforeEach(() => {
  f.button = undefined;
});
function render(
  mode: 'inspect' | 'create',
  onAction: () => void,
  value: React.ComponentProps<typeof TicketCapacityHoldAction>['offer'] = offer,
  busy = false,
) {
  return renderToStaticMarkup(
    <TicketCapacityHoldAction
      mode={mode}
      offer={value}
      now={now}
      busy={busy}
      onAction={onAction}
    />,
  );
}
function click() {
  f.button?.onClick?.({} as React.MouseEvent<HTMLButtonElement>);
}
it('opens the existing-hold roster with zero seats but never creates another hold', () => {
  const open = vi.fn(),
    create = vi.fn();
  const inspect = render('inspect', open);
  expect(inspect).not.toContain('disabled');
  click();
  expect(open).toHaveBeenCalledOnce();
  const submit = render('create', create);
  expect(submit).toContain('disabled');
  click();
  expect(create).not.toHaveBeenCalled();
});
it('can inspect a capacity deficit while still refusing an additional reservation', () => {
  const action = vi.fn();
  render('inspect', action, { ...offer, remainingCapacity: -1 });
  click();
  expect(action).toHaveBeenCalledOnce();
  action.mockClear();
  render('create', action, { ...offer, remainingCapacity: -1 });
  click();
  expect(action).not.toHaveBeenCalled();
});
it('enables creation after capacity returns and closes it again when refreshed capacity becomes zero', () => {
  const create = vi.fn();
  expect(
    render('create', create, { ...offer, remainingCapacity: 1 }),
  ).not.toContain('disabled');
  click();
  expect(create).toHaveBeenCalledOnce();
  expect(render('create', create, offer)).toContain('disabled');
  click();
  expect(create).toHaveBeenCalledOnce();
});
it.each([
  { ...offer, status: 'PAUSED' as const },
  { ...offer, departureAt: '2029-12-31T00:00:00Z' },
])('preserves inactive and past-flight inspection restrictions', (value) => {
  const open = vi.fn();
  expect(render('inspect', open, value)).toContain('disabled');
  click();
  expect(open).not.toHaveBeenCalled();
});
it('blocks duplicate creation while saving even when a seat remains', () => {
  const create = vi.fn();
  expect(
    render('create', create, { ...offer, remainingCapacity: 1 }, true),
  ).toContain('disabled');
  click();
  expect(create).not.toHaveBeenCalled();
});
