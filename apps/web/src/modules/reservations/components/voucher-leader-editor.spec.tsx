import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import type * as ReactModule from 'react';
import { VoucherLeaderEditor } from './voucher-leader-editor';
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
  const control = elements(tree).filter((node) => node.type === 'select')[
    index
  ]!;
  (control.props.onChange as (event: { target: { value: string } }) => void)({
    target: { value },
  });
}
async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}
beforeEach(() => {
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
    elements(tree).find((node) => node.type === 'select')?.props.disabled,
  ).toBe(true);
});
