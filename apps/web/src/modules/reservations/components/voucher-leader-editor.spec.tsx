import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import type * as ReactModule from 'react';
import { VoucherLeaderEditor } from './voucher-leader-editor';
import { SearchCombobox } from '@/components/ui/search-combobox';
import type { ReservationFormIntake } from '../model/reservation-form';

const harness = vi.hoisted(() => ({
  states: [] as unknown[],
  refs: [] as { current: unknown }[],
  effects: [] as (() => unknown)[],
  stateIndex: 0,
  refIndex: 0,
  request: vi.fn(),
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useState: (initial: unknown) => {
    const index = harness.stateIndex++;
    if (!(index in harness.states))
      harness.states[index] =
        typeof initial === 'function' ? initial() : initial;
    return [
      harness.states[index],
      (value: unknown) => {
        harness.states[index] =
          typeof value === 'function' ? value(harness.states[index]) : value;
      },
    ];
  },
  useRef: (initial: unknown) => {
    const index = harness.refIndex++;
    if (!harness.refs[index]) harness.refs[index] = { current: initial };
    return harness.refs[index];
  },
  useEffect: (effect: () => unknown) => {
    harness.effects.push(effect);
  },
}));
vi.mock('./travel-workflow-form', () => ({ travelRequest: harness.request }));
vi.mock('../model/voucher-settings', () => ({
  defaultVoucherSettings: () => ({
    brokerId: 'broker-a',
    text: {
      broker: 'A',
      transferBoard: 'Old',
      leaderName: '',
      leaderPhone: '',
    },
    flags: { tourLeader: false },
  }),
}));
const intake = {
  id: 'intake',
  workflow: { version: 1 },
} as unknown as ReservationFormIntake;
function render() {
  harness.stateIndex = 0;
  harness.refIndex = 0;
  return VoucherLeaderEditor({ intake, onDirty: vi.fn(), onSaved: vi.fn() });
}
function elements(tree: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!tree || typeof tree !== 'object' || !('props' in tree)) return [];
  const node = tree as ReactElement<Record<string, unknown>>;
  return [node, ...elements(node.props.children as ReactNode)];
}
function choose(tree: ReactNode, index: number, value: string) {
  const control = elements(tree).filter((node) => node.type === SearchCombobox)[
    index
  ]!;
  (control.props.onValueChange as (value: string) => void)(value);
}
async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
beforeEach(() => {
  vi.stubGlobal('window', { dispatchEvent: vi.fn() });
  harness.states = [];
  harness.refs = [];
  harness.effects = [];
  harness.stateIndex = 0;
  harness.refIndex = 0;
  harness.request.mockReset().mockImplementation(async (path: string) => ({
    data: path.endsWith('/leaders')
      ? []
      : [
          { id: 'broker-a', name: 'A' },
          { id: 'broker-b', name: 'B' },
        ],
  }));
});
describe('voucher leader selection', () => {
  it('uses two searchable dropdowns and a readonly automatic Board field', () => {
    const tree = render();
    const controls = elements(tree).filter(
      (node) => node.type === SearchCombobox,
    );
    expect(controls).toHaveLength(2);
    expect(controls[0]?.props).toMatchObject({
      remote: true,
      selectedLabel: 'A',
    });
    expect(
      elements(tree).find(
        (node) => node.props['aria-label'] === 'Board ثبت‌شدهٔ کارگزار',
      )?.props.readOnly,
    ).toBe(true);
    expect(elements(tree).some((node) => node.type === 'select')).toBe(false);
  });
  it('keeps a failed save draft available for retry and normalizes a missing phone', async () => {
    render();
    for (const effect of harness.effects) effect();
    await flush();
    harness.request.mockResolvedValueOnce({
      data: { id: 'leader', name: 'Leader', phone: null, board: 'Board' },
    });
    harness.request.mockRejectedValueOnce(
      new Error('ثبت انجام نشد؛ دوباره تلاش کنید.'),
    );
    choose(render(), 1, 'leader');
    await flush();
    expect(harness.states[0]).toMatchObject({
      leaderId: 'leader',
      text: { leaderName: 'Leader', leaderPhone: '', transferBoard: 'Board' },
    });
    const tree = render();
    expect(
      elements(tree).find((node) => node.props.role === 'alert')?.props
        .children,
    ).toContain('دوباره تلاش کنید');
    const retry = elements(tree).find(
      (node) => node.props.children === 'ذخیره تنظیمات واچر',
    )!;
    expect(retry.props.disabled).toBe(false);
    harness.request.mockResolvedValueOnce({ data: { version: 2 } });
    await (retry.props.onClick as () => Promise<void>)();
    await flush();
    expect(
      harness.request.mock.calls.filter(([path]) => path.endsWith('/workflow')),
    ).toHaveLength(2);
  });
  it('does not save a leader when its authorized contact lookup fails', async () => {
    render();
    for (const effect of harness.effects) effect();
    await flush();
    harness.request.mockRejectedValueOnce(new Error('دریافت تماس مجاز نیست.'));
    choose(render(), 1, 'leader');
    await flush();
    expect(
      harness.request.mock.calls.some(([path]) => path.endsWith('/workflow')),
    ).toBe(false);
    expect(harness.states[0]).not.toHaveProperty('leaderId');
  });
  it('fills Board, leader name and phone from the audited contact response', async () => {
    let tree = render();
    for (const effect of harness.effects) effect();
    await flush();
    tree = render();
    harness.request.mockResolvedValueOnce({
      data: {
        id: 'leader',
        name: 'Leader A',
        phone: '+905551234567',
        board: 'AIRPORT BOARD',
      },
    });
    choose(tree, 1, 'leader');
    await flush();
    expect(harness.states[0]).toMatchObject({
      leaderId: 'leader',
      text: {
        transferBoard: 'AIRPORT BOARD',
        leaderName: 'Leader A',
        leaderPhone: '+905551234567',
      },
    });
    expect(harness.request).toHaveBeenCalledWith(
      'reservations/requests/intake/workflow',
      expect.objectContaining({
        action: 'VOUCHER_SETTINGS',
        expectedVersion: 1,
        voucherSettings: expect.objectContaining({
          leaderId: 'leader',
          text: expect.objectContaining({ transferBoard: 'AIRPORT BOARD' }),
        }),
      }),
    );
  });
  it('ignores an old contact response after the broker changes', async () => {
    let tree = render();
    for (const effect of harness.effects) effect();
    await flush();
    tree = render();
    let complete: (result: unknown) => void = () => undefined;
    harness.request.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    choose(tree, 1, 'leader-a');
    choose(render(), 0, 'broker-b');
    complete({
      data: {
        id: 'leader-a',
        name: 'Wrong',
        phone: '+905551234567',
        board: 'Wrong Board',
      },
    });
    await flush();
    expect(harness.states[0]).toMatchObject({
      brokerId: 'broker-b',
      text: { broker: 'B', transferBoard: '', leaderName: '', leaderPhone: '' },
    });
    expect(harness.states[0]).not.toHaveProperty('leaderId');
  });
});

it('uses the sent form broker and locks its selector', () => {
  harness.stateIndex = 0;
  harness.refIndex = 0;
  const tree = VoucherLeaderEditor({
    intake: {
      ...intake,
      workflow: {
        ...intake.workflow,
        sentSupplierFormSettings: {
          brokerId: 'broker-b',
          text: { broker: 'B' },
        } as never,
      },
    },
    onDirty: vi.fn(),
    onSaved: vi.fn(),
  });
  expect(harness.states[0]).toMatchObject({
    brokerId: 'broker-b',
    text: { broker: 'B', leaderName: '', leaderPhone: '' },
  });
  expect(
    elements(tree).find((node) => node.type === SearchCombobox)?.props.disabled,
  ).toBe(true);
});
