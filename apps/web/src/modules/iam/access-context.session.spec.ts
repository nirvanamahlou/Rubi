import { createElement, type ReactElement, type ReactNode } from 'react';
import type * as ReactRuntime from 'react';
import type { AuthenticatedActor } from '@nora/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Exercise the provider's polling effect while retaining its hook state across
// renders. No browser renderer or persistent session fixtures are needed.
const hooks = vi.hoisted(() => ({
  values: [] as unknown[],
  cursor: 0,
  effect: null as (() => (() => void) | void) | null,
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactRuntime>()),
  useState: (initial: unknown) => {
    const index = hooks.cursor++;
    if (!(index in hooks.values)) hooks.values[index] = initial;
    return [
      hooks.values[index],
      (value: unknown) => {
        hooks.values[index] = value;
      },
    ];
  },
  useEffect: (effect: () => (() => void) | void) => {
    hooks.effect ??= effect;
  },
}));
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  usePathname: () => '/sales/contracts/new',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/lib/environment', () => ({ getPublicApiBaseUrl: () => '/api/v1' }));
vi.mock('./access-session', () => ({ loadAccessSession: vi.fn() }));
import { redirect } from 'next/navigation';
import { loadAccessSession } from './access-session';
import { AccessProvider } from './access-context';

const actor: AuthenticatedActor = {
  userId: 'seller',
  sessionId: 'session',
  permissions: ['sales.contracts.create'],
  branchIds: ['branch'],
};
const draft = createElement('input', {
  defaultValue: 'Unsaved customer details',
});
const render = () => {
  hooks.cursor = 0;
  return AccessProvider({ children: draft }) as ReactElement<{
    value: unknown;
    children: ReactElement<{ value: unknown; children: ReactNode }>;
  }>;
};
let cleanup: (() => void) | void;
beforeEach(() => {
  vi.useFakeTimers();
  hooks.values = [];
  hooks.cursor = 0;
  hooks.effect = null;
  vi.stubGlobal('window', new EventTarget());
  vi.mocked(loadAccessSession).mockResolvedValue({ status: 'ready', actor });
});
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
async function mount() {
  render();
  cleanup = hooks.effect?.();
  await vi.advanceTimersByTimeAsync(0);
}
describe('access polling preserves the open form', () => {
  it('keeps the same draft and actor on a failed poll, then accepts changed permissions', async () => {
    await mount();
    expect(render().props.children.props.children).toBe(draft);
    vi.mocked(loadAccessSession).mockRejectedValueOnce(
      new TypeError('connection interrupted'),
    );
    await vi.advanceTimersByTimeAsync(30_000);
    const afterOutage = render();
    expect(afterOutage.props.value).toBe(actor);
    expect(afterOutage.props.children.props.value).toBe(actor.permissions);
    expect(afterOutage.props.children.props.children).toBe(draft);
    expect(redirect).not.toHaveBeenCalled();
    const restricted = { ...actor, permissions: [] };
    vi.mocked(loadAccessSession).mockResolvedValueOnce({
      status: 'ready',
      actor: restricted,
    });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(render().props.children.props.value).toEqual([]);
  });
  it('still sends a truly expired session to login', async () => {
    await mount();
    vi.mocked(loadAccessSession).mockResolvedValueOnce({ status: 'expired' });
    await vi.advanceTimersByTimeAsync(30_000);
    render();
    expect(redirect).toHaveBeenCalledWith('/login');
  });
  it('does not show protected children before the first successful check', async () => {
    vi.mocked(loadAccessSession).mockRejectedValue(new TypeError('offline'));
    await mount();
    const tree = render();
    expect(tree.props.value).toBeNull();
    expect(tree.props.children.props.value).toBeNull();
    expect(tree.props.children.props.children).not.toBe(draft);
  });
  it('clears actor access on a confirmed forbidden response', async () => {
    await mount();
    vi.mocked(loadAccessSession).mockResolvedValueOnce({ status: 'forbidden' });
    await vi.advanceTimersByTimeAsync(30_000);
    const tree = render();
    expect(tree.props.value).toBeNull();
    expect(tree.props.children.props.value).toEqual([]);
  });
});
