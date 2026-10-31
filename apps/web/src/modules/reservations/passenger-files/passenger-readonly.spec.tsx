import { beforeEach, it, expect, vi } from 'vitest';
import type * as ReactModule from 'react';
import { isValidElement, type ReactNode } from 'react';
import { ReservationPassengers } from './passengers';
const state = vi.hoisted(() => ({ index: 0, values: [] as unknown[] }));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useState(initial: unknown) {
    const i = state.index++;
    return [i in state.values ? state.values[i] : initial, vi.fn()];
  },
  useEffect: vi.fn(),
  useImperativeHandle: vi.fn(),
}));
function nodes(
  n: ReactNode,
): { type: unknown; props: Record<string, unknown> }[] {
  if (Array.isArray(n)) return n.flatMap(nodes);
  if (!isValidElement<Record<string, unknown>>(n)) return [];
  return [
    { type: n.type, props: n.props },
    ...nodes(n.props.children as ReactNode),
  ];
}
beforeEach(() => {
  state.index = 0;
  state.values = [
    [
      {
        id: 'person',
        firstName: 'Synthetic',
        lastName: 'Passenger',
        ageCategory: 'ADL',
        passportNumber: 'MASKED',
        nationalityCode: 'IR',
      },
    ],
    [],
    true,
    true,
    false,
  ];
});
it('displays passenger facts without any editable control even with identity permission', () => {
  const tree = nodes(ReservationPassengers({ id: 'request', readOnly: true }));
  expect(tree.some((n) => n.props.children === 'Synthetic')).toBe(true);
  expect(
    tree.some((n) => n.props.onChange || n.props.onClick || n.props.onSubmit),
  ).toBe(false);
  expect(
    tree.some(
      (n) => n.type === 'input' || n.type === 'select' || n.type === 'button',
    ),
  ).toBe(false);
});
it.each([true, false])(
  'shows the issued policy number and keeps unissued cells empty (readonly=%s)',
  (readOnly) => {
    const passengers = state.values[0] as Record<string, unknown>[];
    passengers.push({
      ...passengers[0],
      id: 'second',
      insurancePolicyNumber: 'TEST-POLICY-2',
    });
    const tree = nodes(ReservationPassengers({ id: 'request', readOnly }));
    expect(
      tree.some(
        (n) =>
          n.type === 'th' &&
          nodes(n.props.children as ReactNode).some(
            (child) => child.props.children === 'شماره بیمه‌نامه',
          ),
      ),
    ).toBe(true);
    expect(
      tree
        .filter(
          (n) =>
            (n.type === 'td' || n.props.tag === 'td') && n.props.dir === 'ltr',
        )
        .map((n) => n.props.children),
    ).toEqual(['', 'TEST-POLICY-2']);
  },
);
it('places contract category controls inside the existing editable passenger row, never in read-only output', () => {
  const editor = vi.fn(() => <span>inline-contract-age</span>);
  const tree = nodes(
    ReservationPassengers({ id: 'request', ageEditor: editor }),
  );
  expect(editor).toHaveBeenCalledWith('person');
  expect(
    tree.some(
      (n) =>
        n.type === 'td' &&
        nodes(n.props.children as ReactNode).some(
          (child) => child.props.children === 'inline-contract-age',
        ),
    ),
  ).toBe(true);
  state.index = 0;
  editor.mockClear();
  ReservationPassengers({ id: 'request', ageEditor: editor, readOnly: true });
  expect(editor).not.toHaveBeenCalled();
});
