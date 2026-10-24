import { sourceUiText } from '@/i18n/source-text';
import type * as ReactModule from 'react';
import { expect, it, vi } from 'vitest';
import { isValidElement, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { SalesContractForm } from './sales-contract-form';
vi.mock('@/modules/iam/access-context', () => ({ useAccessActor: () => null }));
const setters = vi.hoisted(() => ({
  draft: vi.fn(),
  refresh: vi.fn(),
  router: vi.fn(),
  other: vi.fn(),
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useEffect: vi.fn(),
  useMemo: (factory: () => unknown) => factory(),
  useCallback: (callback: unknown) => callback,
  useRef: (value: unknown) => ({ current: value }),
  useState: (initial: unknown) => {
    const value =
      typeof initial === 'function' ? (initial as () => unknown)() : initial;
    if (
      value &&
      typeof value === 'object' &&
      'revision' in value &&
      'message' in value
    )
      return [{ ...value, busy: false }, setters.refresh];
    if (value && typeof value === 'object' && 'serviceKinds' in value)
      return [value, setters.draft];
    return [value, setters.other];
  },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: setters.router }),
}));
function nodes(
  node: ReactNode,
): { type: unknown; props: Record<string, unknown> }[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [
    { type: node.type, props: node.props },
    ...nodes(node.props.children as ReactNode),
  ];
}
it('refreshes reference revision without submitting, resetting the draft or refreshing the page', () => {
  const tree = nodes(SalesContractForm());
  const button = tree.find(
    (n) =>
      n.type === Button &&
      Array.isArray(n.props.children) &&
      n.props.children.some(
        (child: ReactNode) => sourceUiText(child) === 'دریافت اطلاعات',
      ),
  );
  expect(button).toBeDefined();
  expect(button!.props.type).toBe('button');
  expect(button!.props.disabled).toBe(false);
  (button!.props.onClick as () => void)();
  const update = setters.refresh.mock.calls[0]![0] as (v: unknown) => unknown;
  expect(update({ revision: 3, busy: false, message: 'old' })).toEqual({
    revision: 4,
    busy: true,
    message: '',
  });
  expect(setters.draft).not.toHaveBeenCalled();
  expect(setters.router).not.toHaveBeenCalled();
  expect(setters.other).not.toHaveBeenCalled();
});
