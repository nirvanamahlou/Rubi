import type * as ReactModule from 'react';
import type { ReactElement } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
const hooks = vi.hoisted(() => ({
  index: 0,
  refIndex: 0,
  states: [] as unknown[],
  refs: [] as { current: unknown }[],
  create: vi.fn(),
  list: vi.fn(),
  options: vi.fn(),
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useEffect: () => undefined,
  useCallback: <T,>(fn: T) => fn,
  useRef: <T,>(value: T) =>
    hooks.refs[hooks.refIndex++] ??
    (hooks.refs[hooks.refIndex - 1] = { current: value }),
  useState: <T,>(value: T) => {
    const index = hooks.index++;
    if (!(index in hooks.states)) hooks.states[index] = value;
    return [
      hooks.states[index],
      (next: T) => {
        hooks.states[index] =
          typeof next === 'function'
            ? (next as (previous: unknown) => T)(hooks.states[index])
            : next;
      },
    ];
  },
}));
vi.mock('../api/exchange-offices-api', () => ({
  exchangeOfficesApi: {
    save: hooks.create,
    list: hooks.list,
    options: hooks.options,
  },
}));
import { ExchangeOfficeWorkspace } from './exchange-office-workspace';
function nodes(node: unknown): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== 'object' || !('props' in node)) return [];
  const element = node as ReactElement<Record<string, unknown>>;
  return [element, ...nodes(element.props.children)];
}
function render() {
  hooks.index = 0;
  hooks.refIndex = 0;
  return nodes(ExchangeOfficeWorkspace());
}

beforeEach(() => {
  hooks.states = [];
  hooks.refs = [];
  hooks.states[1] = {
    canManage: true,
    countries: [],
    currencies: [{ code: 'USD', name: 'Dollar' }],
  };
  hooks.states[8] = false;
  hooks.create.mockReset().mockResolvedValue({});
});
function click(label: string) {
  const node = render().find(
    (n) =>
      typeof n.props.onClick === 'function' &&
      nodes(n).some((child) => child.props.children === label),
  )!;
  (node.props.onClick as () => void)();
}
it('submits title only, ignores an unused balance row and prevents duplicate submission', async () => {
  click('تعریف صرافی');
  const title = render().find(
    (n) => n.props.id === 'exchange-title' && n.props.onChange,
  )!;
  (title.props.onChange as (e: unknown) => void)({
    target: { value: 'Office' },
  });
  click('افزودن ارز');
  const tree = render();
  expect(
    tree
      .filter((n) => n.props.required && n.props.onChange)
      .map((n) => n.props.id),
  ).toEqual(['exchange-title']);
  const submit = tree.find((n) => n.type === 'form')!.props.onSubmit as (
    e: unknown,
  ) => void;
  submit({ preventDefault() {} });
  submit({ preventDefault() {} });
  await vi.waitFor(() => expect(hooks.create).toHaveBeenCalledOnce());
  expect(hooks.create).toHaveBeenCalledWith(
    null,
    expect.objectContaining({ title: 'Office', balances: [] }),
  );
});
it('keeps a failed draft and shows the API error', async () => {
  hooks.create.mockRejectedValue(new Error('Balance changed'));
  click('تعریف صرافی');
  (
    render().find((n) => n.type === 'form')!.props.onSubmit as (
      e: unknown,
    ) => void
  )({ preventDefault() {} });
  await vi.waitFor(() =>
    expect(
      render().some(
        (n) =>
          n.props.role === 'alert' && n.props.children === 'Balance changed',
      ),
    ).toBe(true),
  );
  expect(render().some((n) => n.type === 'form')).toBe(true);
});
it('hides mutations for read-only users', () => {
  hooks.states[1] = { canManage: false, countries: [], currencies: [] };
  expect(
    render().some(
      (n) =>
        typeof n.props.onClick === 'function' &&
        nodes(n).some((child) => child.props.children === 'تعریف صرافی'),
    ),
  ).toBe(false);
});
