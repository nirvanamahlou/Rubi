import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import type * as ReactModule from 'react';
import { canonicalTestTree } from '@/i18n/test-tree';
import { GeneratorDailyPackagePublisher } from './generator-daily-package-publisher';

const hooks = vi.hoisted(() => ({
  states: [] as unknown[],
  refs: [] as { current: unknown }[],
  effects: [] as (() => unknown)[],
  deps: [] as (readonly unknown[])[],
  stateIndex: 0,
  refIndex: 0,
  effectIndex: 0,
  options: vi.fn(),
  publish: vi.fn(),
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useState: (initial: unknown) => {
    const i = hooks.stateIndex++;
    if (!(i in hooks.states)) hooks.states[i] = initial;
    return [
      hooks.states[i],
      (next: unknown) => {
        hooks.states[i] = next;
      },
    ];
  },
  useRef: (initial: unknown) =>
    (hooks.refs[hooks.refIndex++] ??= { current: initial }),
  useEffect: (callback: () => unknown, deps: readonly unknown[]) => {
    const i = hooks.effectIndex++;
    if (hooks.deps[i]?.every((value, j) => Object.is(value, deps[j]))) return;
    hooks.deps[i] = deps;
    hooks.effects.push(callback);
  },
}));
vi.mock('@/modules/workbench/workbench-personal-api', () => ({
  workbenchPersonalApi: {
    dailyPackageOptions: hooks.options,
    publishDailyPackage: hooks.publish,
  },
}));
const origin = 'http://192.168.8.108:3100';
const branchId = '11111111-1111-4111-8111-111111111111';
const postMessage = vi.fn();
const frame = { current: { contentWindow: { postMessage } } } as unknown as {
  current: HTMLIFrameElement;
};
let receive: (event: unknown) => void;
function render() {
  hooks.stateIndex = hooks.refIndex = hooks.effectIndex = 0;
  const tree = GeneratorDailyPackagePublisher({ frame, loaded: true });
  hooks.effects.splice(0).forEach((effect) => effect());
  return tree;
}
function nodes(tree: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object' || !('props' in tree)) return [];
  const node = tree as ReactElement<Record<string, unknown>>;
  return [node, ...nodes(node.props.children as ReactNode)];
}
function tree() {
  return nodes(canonicalTestTree(render()));
}
function sendButton() {
  return tree().find((node) => node.props.loading !== undefined)!;
}
async function open() {
  render();
  receive({
    origin,
    source: frame.current.contentWindow,
    data: {
      type: 'rubi-daily-package-publish',
      requestId: branchId,
      title: 'پکیج آزمایشی',
      blob: new Blob(['%PDF-1.4'], { type: 'application/pdf' }),
    },
  });
  for (let i = 0; i < 5; i++) await Promise.resolve();
  render();
}
async function settle() {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  render();
}
beforeEach(() => {
  hooks.states = [];
  hooks.refs = [];
  hooks.effects = [];
  hooks.deps = [];
  vi.clearAllMocks();
  hooks.options.mockResolvedValue({
    data: [{ id: branchId, name: 'شعبه تست' }],
  });
  hooks.publish.mockResolvedValue({ data: { id: 'document' } });
  vi.stubGlobal('window', {
    location: { origin },
    addEventListener: (_: string, callback: typeof receive) => {
      receive = callback;
    },
    removeEventListener: vi.fn(),
  });
});
afterEach(() => vi.unstubAllGlobals());

it('clicking confirmation submits the PDF directly once and acknowledges only server success', async () => {
  await open();
  let resolve!: (value: unknown) => void;
  hooks.publish.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const button = sendButton();
  expect(button.props.type).toBe('button');
  expect(button.props.disabled).toBe(false);
  (button.props.onClick as () => void)();
  (button.props.onClick as () => void)();
  expect(hooks.publish).toHaveBeenCalledTimes(1);
  const input = hooks.publish.mock.calls[0]![0];
  expect(input.branchId).toBe(branchId);
  expect(input.file.type).toBe('application/pdf');
  expect(await input.file.text()).toBe('%PDF-1.4');
  expect(input.signal).toBeInstanceOf(AbortSignal);
  expect(sendButton().props.loading).toBe(true);
  expect(postMessage).not.toHaveBeenCalledWith(
    expect.objectContaining({ success: true }),
    origin,
  );
  resolve({ data: { id: 'saved' } });
  await settle();
  expect(postMessage).toHaveBeenCalledWith(
    expect.objectContaining({ success: true, requestId: branchId }),
    origin,
  );
});

it('keeps the dialog for correction and retry after an upload failure', async () => {
  await open();
  hooks.publish.mockRejectedValueOnce(Error('ارسال ناموفق'));
  (sendButton().props.onClick as () => void)();
  await settle();
  expect(tree().some((node) => node.props.description === 'ارسال ناموفق')).toBe(
    true,
  );
  expect(sendButton().props.loading).toBe(false);
  expect(postMessage).not.toHaveBeenCalledWith(
    expect.objectContaining({ success: true }),
    origin,
  );
  (sendButton().props.onClick as () => void)();
  await settle();
  expect(hooks.publish).toHaveBeenCalledTimes(2);
});

it('supports keyboard submit without hidden native validity blocking the handler', async () => {
  await open();
  const form = tree().find((node) => node.type === 'form')!;
  expect(form.props.noValidate).toBe(true);
  const preventDefault = vi.fn();
  (form.props.onSubmit as (event: unknown) => void)({ preventDefault });
  await settle();
  expect(preventDefault).toHaveBeenCalled();
  expect(hooks.publish).toHaveBeenCalledTimes(1);
});

it('never publishes while permitted branches are unavailable', async () => {
  hooks.options.mockResolvedValue({ data: [] });
  await open();
  expect(sendButton().props.disabled).toBe(true);
  (sendButton().props.onClick as () => void)();
  await settle();
  expect(hooks.publish).not.toHaveBeenCalled();
});

it('reports an uncertain timeout without pretending it succeeded or retrying the upload', async () => {
  await open();
  hooks.publish.mockRejectedValueOnce(
    new DOMException('timeout', 'TimeoutError'),
  );
  (sendButton().props.onClick as () => void)();
  await settle();
  expect(
    tree().some((node) =>
      String(node.props.description).includes('پیش از ارسال دوباره'),
    ),
  ).toBe(true);
  expect(hooks.publish).toHaveBeenCalledTimes(1);
  expect(postMessage).not.toHaveBeenCalledWith(
    expect.objectContaining({ success: true }),
    origin,
  );
});
