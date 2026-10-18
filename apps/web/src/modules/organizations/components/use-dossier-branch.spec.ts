import { afterEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  shared: null as unknown,
  effects: [] as Array<() => void | (() => void)>,
  session: vi.fn(),
}));
vi.mock('react', () => ({
  createContext: () => ({ Provider: {} }),
  useContext: () => harness.shared,
  useCallback: (fn: unknown) => fn,
  useRef: (value: unknown) => ({ current: value }),
  useState: (value: unknown) => [value, vi.fn()],
  useEffect: (effect: () => void | (() => void)) =>
    harness.effects.push(effect),
}));
vi.mock('../api/agency-client', () => ({
  agencyClient: { session: harness.session },
}));

import { useDossierBranch } from './use-dossier-branch';

afterEach(() => {
  harness.shared = null;
  harness.effects = [];
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('dossier session ownership', () => {
  it('mounting 25 child panels reuses the exact live session without refresh timers or auth listeners', () => {
    const session = {
      actorUserId: 'actor',
      branchId: 'branch',
      permissions: ['master_data.read'],
      sessionContextKey: 'current',
    };
    harness.shared = session;
    const timer = vi.fn();
    const listen = vi.fn();
    vi.stubGlobal('window', { setTimeout: timer, addEventListener: listen });
    for (let i = 0; i < 25; i++) expect(useDossierBranch()).toBe(session);
    for (const effect of harness.effects) effect();
    expect(timer).not.toHaveBeenCalled();
    expect(listen).not.toHaveBeenCalled();
    expect(harness.session).not.toHaveBeenCalled();
  });

  it('the owning hook alone subscribes and cleans up session/focus changes', () => {
    const timer = vi.fn().mockReturnValue(17);
    const clear = vi.fn();
    const listen = vi.fn();
    const remove = vi.fn();
    vi.stubGlobal('window', {
      setTimeout: timer,
      clearTimeout: clear,
      addEventListener: listen,
      removeEventListener: remove,
    });
    useDossierBranch();
    const cleanup = harness.effects[0]();
    expect(timer).toHaveBeenCalledTimes(1);
    expect(listen.mock.calls.map(([event]) => event)).toEqual([
      'focus',
      'nora:auth-session-recovered',
    ]);
    if (typeof cleanup === 'function') cleanup();
    expect(clear).toHaveBeenCalledWith(17);
    expect(remove).toHaveBeenCalledTimes(2);
  });

  it('children immediately receive replacement actor, revoked grants and branch from their owner', () => {
    harness.shared = {
      actorUserId: 'actor',
      branchId: 'one',
      permissions: ['master_data.read'],
    };
    expect(useDossierBranch()).toBe(harness.shared);
    harness.shared = { actorUserId: 'other', branchId: 'two', permissions: [] };
    expect(useDossierBranch()).toBe(harness.shared);
    harness.shared = {
      actorUserId: '',
      branchId: '',
      permissions: [],
      sessionContextKey: '',
    };
    expect(useDossierBranch()).toBe(harness.shared);
  });
});
