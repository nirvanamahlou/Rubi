import { beforeEach, expect, it, vi } from 'vitest';
import type { ReactNode, ReactElement } from 'react';
import type * as ReactModule from 'react';
import { canonicalTestTree } from '@/i18n/test-tree';
const hooks = vi.hoisted(() => ({
  states: [] as unknown[],
  refs: [] as { current: unknown }[],
  stateIndex: 0,
  refIndex: 0,
  effect: undefined as (() => void | (() => void)) | undefined,
  request: vi.fn(),
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useState: (initial: unknown) => {
    const i = hooks.stateIndex++;
    if (!(i in hooks.states)) hooks.states[i] = initial;
    return [
      hooks.states[i],
      (next: unknown) => {
        hooks.states[i] =
          typeof next === 'function' ? next(hooks.states[i]) : next;
      },
    ];
  },
  useRef: (initial: unknown) =>
    (hooks.refs[hooks.refIndex++] ??= { current: initial }),
  useEffect: (effect: () => void | (() => void)) => {
    hooks.effect = effect;
  },
}));
vi.mock('./controls', () => ({ rateRequest: hooks.request }));
import { PackHotelCopy } from './pack-hotel-copy';
import { savedPack } from './existing-packs.fixture';
function nodes(tree: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object' || !('props' in tree)) return [];
  const node = tree as ReactElement<Record<string, unknown>>;
  return [node, ...nodes(node.props.children as ReactNode)];
}
const onCopy = vi.fn();
function render(disabled = false) {
  hooks.stateIndex = hooks.refIndex = 0;
  return nodes(
    canonicalTestTree(
      PackHotelCopy({
        branchId: 'branch-1',
        cityId: 'city-1',
        availableHotelIds: ['hotel-0'],
        disabled,
        onCopy,
      }),
    ),
  );
}
function click(text: string) {
  const button = render().find(
    (node) => node.type === 'button' && node.props.children === text,
  )!;
  (button.props.onClick as () => void)();
}
beforeEach(() => {
  hooks.states = [];
  hooks.refs = [];
  hooks.effect = undefined;
  hooks.request.mockReset();
  onCopy.mockReset();
});

it('loads same-city packages, then automatically copies hotel IDs without saving prices', async () => {
  const pack = savedPack();
  hooks.request.mockImplementation(async (path: string) =>
    path.startsWith('/packs?')
      ? {
          data: [
            { ...pack, hotelCount: 2 },
            { ...pack, id: 'other', cityId: 'other' },
          ],
          total: 2,
        }
      : pack,
  );
  render();
  click('کپی از بستهٔ دیگر');
  await vi.waitFor(() =>
    expect(
      render().some(
        (node) => node.props.label === 'بستهٔ مبدأ برای کپی هتل‌ها',
      ),
    ).toBe(true),
  );
  const picker = render().find(
    (node) => node.props.label === 'بستهٔ مبدأ برای کپی هتل‌ها',
  )!;
  expect(
    (picker.props.options as { value: string }[]).map((o) => o.value),
  ).toEqual(['pack-1']);
  (picker.props.onValueChange as (id: string) => void)('pack-1');
  await vi.waitFor(() => expect(onCopy).toHaveBeenCalledWith(['hotel-0']));
  expect(
    render().some(
      (node) =>
        node.props.role === 'status' &&
        String(node.props.children).includes('هتل از بسته انتخاب شد'),
    ),
  ).toBe(true);
  expect(hooks.request.mock.calls.every((call) => call.length === 1)).toBe(
    true,
  );
});

it('ignores a pending response after closing the dialog', async () => {
  let finish: ((value: unknown) => void) | undefined;
  const pack = savedPack();
  hooks.request.mockImplementation((path: string) =>
    path.startsWith('/packs?')
      ? Promise.resolve({ data: [{ ...pack, hotelCount: 2 }], total: 1 })
      : new Promise((resolve) => {
          finish = resolve;
        }),
  );
  render();
  click('کپی از بستهٔ دیگر');
  await vi.waitFor(() =>
    expect(
      render().some(
        (node) => node.props.label === 'بستهٔ مبدأ برای کپی هتل‌ها',
      ),
    ).toBe(true),
  );
  const picker = render().find(
    (node) => node.props.label === 'بستهٔ مبدأ برای کپی هتل‌ها',
  )!;
  (picker.props.onValueChange as (id: string) => void)('pack-1');
  click('بستن');
  finish?.(pack);
  await Promise.resolve();
  await Promise.resolve();
  expect(onCopy).not.toHaveBeenCalled();
});

it('does not load packages without editing access', () => {
  const button = render(true).find(
    (node) =>
      node.type === 'button' && node.props.children === 'کپی از بستهٔ دیگر',
  )!;
  expect(button.props.disabled).toBe(true);
  (button.props.onClick as () => void)();
  expect(hooks.request).not.toHaveBeenCalled();
});
