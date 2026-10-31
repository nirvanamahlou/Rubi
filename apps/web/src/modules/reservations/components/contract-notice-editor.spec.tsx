import { isValidElement, type ReactNode } from 'react';
import type * as ReactModule from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { canonicalTestTree } from '@/i18n/test-tree';
import { ContractNoticeEditor } from './contract-notice-editor';
const h = vi.hoisted(() => ({
  states: [] as unknown[],
  index: 0,
  deps: [] as unknown[],
  effects: [] as (() => void)[],
  request: vi.fn(),
  saved: vi.fn(),
}));
vi.mock('./travel-workflow-form', () => ({ travelRequest: h.request }));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useState(initial: unknown) {
    const i = h.index++;
    if (!(i in h.states)) h.states[i] = initial;
    return [
      h.states[i],
      (value: unknown) => {
        h.states[i] = typeof value === 'function' ? value(h.states[i]) : value;
      },
    ];
  },
  useRef(initial: unknown) {
    const i = h.index++;
    if (!(i in h.states)) h.states[i] = { current: initial };
    return h.states[i];
  },
  useEffect(run: () => void, deps: unknown[]) {
    if (deps.some((v, i) => v !== h.deps[i])) {
      h.effects.push(run);
      h.deps = deps;
    }
  },
}));
function nodes(node: ReactNode): Record<string, unknown>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node.props, ...nodes(node.props.children as ReactNode)];
}
function render() {
  h.index = 0;
  const result = nodes(
    canonicalTestTree(
      ContractNoticeEditor({ contractId: 'contract/id', onSaved: h.saved }),
    ),
  );
  h.effects.splice(0).forEach((run) => run());
  return result;
}
const field = () =>
  render().find((n) => n.id === 'contract-notice-contract/id')!;
const button = (name: string) => render().find((n) => n.children === name)!;
async function load(canEdit = true) {
  h.request.mockResolvedValueOnce({
    version: 7,
    notice: 'Original 120123',
    canEdit,
  });
  render();
  await vi.waitFor(() => expect(field().value).toBe('Original 120123'));
}
const change = (value: string) =>
  (field().onChange as (e: unknown) => void)({ target: { value } });
beforeEach(() => {
  h.states = [];
  h.index = 0;
  h.deps = [];
  h.effects = [];
  vi.resetAllMocks();
});
it('loads the saved Notice through the encoded scoped contract API', async () => {
  await load();
  expect(h.request).toHaveBeenCalledWith(
    'sales/contracts/contract%2Fid/notice',
  );
  expect(button('ذخیره نوتیس').disabled).toBe(true);
});
it.each(['Edited 120123', ''])(
  'saves changes including clearing and refreshes the preview (%s)',
  async (notice) => {
    await load();
    change(notice);
    h.request.mockResolvedValueOnce({ version: 8, notice, canEdit: true });
    (button('ذخیره نوتیس').onClick as () => void)();
    await vi.waitFor(() => expect(h.saved).toHaveBeenCalledTimes(1));
    expect(h.request).toHaveBeenLastCalledWith(
      'sales/contracts/contract%2Fid/notice',
      { expectedVersion: 7, notice },
    );
    expect(field().value).toBe(notice);
    expect(button('ذخیره نوتیس').disabled).toBe(true);
  },
);
it('keeps entered text and version after failed save instead of claiming success', async () => {
  await load();
  change('Keep my edit');
  h.request.mockRejectedValueOnce(Error('Stale version'));
  (button('ذخیره نوتیس').onClick as () => void)();
  await vi.waitFor(() =>
    expect(
      render().some(
        (n) => n.role === 'alert' && n.children === 'Stale version',
      ),
    ).toBe(true),
  );
  expect(field().value).toBe('Keep my edit');
  expect(h.saved).not.toHaveBeenCalled();
});
it('shows the saved text read-only without a Save action for non-writers', async () => {
  await load(false);
  expect(field().disabled).toBe(true);
  expect(render().some((n) => n.children === 'ذخیره نوتیس')).toBe(false);
});
it('locks duplicate submissions while a write is pending', async () => {
  await load();
  change('Next');
  let finish!: (value: unknown) => void;
  h.request.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const click = button('ذخیره نوتیس').onClick as () => void;
  click();
  click();
  expect(h.request).toHaveBeenCalledTimes(2);
  finish({ version: 8, notice: 'Next', canEdit: true });
  await vi.waitFor(() => expect(h.saved).toHaveBeenCalledTimes(1));
});
