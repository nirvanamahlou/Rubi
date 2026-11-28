import type { LoginResponse } from '@nora/contracts';
import type * as ReactRuntime from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { rememberHeaderSession, readHeaderSession } from '@/lib/header-session';
import { AUTH_SESSION_RECOVERED_EVENT } from '@/lib/auth-session';
import { UserMenu } from './user-menu';

const h = vi.hoisted(() => ({
  userId: 'staff-a',
  effects: [] as (() => (() => void) | void)[],
  refresh: vi.fn(),
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactRuntime>()),
  useState: (initial: unknown) => [initial, vi.fn()],
  useEffect: (effect: () => (() => void) | void) => {
    h.effects.push(effect);
  },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({}) }));
vi.mock('@/lib/environment', () => ({ getPublicApiBaseUrl: () => '/api/v1' }));
vi.mock('@/modules/iam/access-context', () => ({
  useAccessActor: () => ({ userId: h.userId }),
}));
vi.mock('@/lib/auth-session', () => ({
  AUTH_SESSION_RECOVERED_EVENT: 'nora:auth-session-recovered',
  refreshAuthenticatedSession: h.refresh,
}));
vi.mock('@/modules/workbench/workbench-personal-api', () => ({
  PROFILE_PHOTO_CHANGED_EVENT: 'photo-changed',
  workbenchPersonalApi: {
    profilePhoto: async () => {
      throw new Error('no photo');
    },
  },
}));

const user = (id: string, role = 'فروش'): LoginResponse['user'] => ({
  id,
  username: 'test',
  displayName: id,
  email: null,
  branches: [],
  permissions: [],
  roles: [{ code: 'staff', name: role }],
});
const login = (id: string, role?: string): LoginResponse => ({
  user: user(id, role),
});

async function mount() {
  const shell = UserMenu();
  (shell.type as (props: typeof shell.props) => unknown)(shell.props);
  const cleanups = h.effects.splice(0).map((effect) => effect());
  await new Promise((done) => setTimeout(done, 0));
  return () => cleanups.forEach((close) => close?.());
}

beforeEach(() => {
  h.userId = 'staff-a';
  h.refresh.mockReset();
  const values = new Map<string, string>();
  vi.stubGlobal(
    'window',
    Object.assign(new EventTarget(), {
      sessionStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

it('does not rotate on repeated authenticated header mounts and accepts role updates only for the same actor', async () => {
  const loggedIn = rememberHeaderSession(user(h.userId));
  for (let page = 0; page < 3; page++) (await mount())();
  const close = await mount();
  window.dispatchEvent(
    new CustomEvent(AUTH_SESSION_RECOVERED_EVENT, {
      detail: login('staff-b', 'نامرتبط'),
    }),
  );
  expect(readHeaderSession(undefined, h.userId)).toEqual(loggedIn);
  window.dispatchEvent(
    new CustomEvent(AUTH_SESSION_RECOVERED_EVENT, {
      detail: login('staff-a', 'فروش جدید'),
    }),
  );
  expect(readHeaderSession(undefined, h.userId)).toMatchObject({
    roleNames: ['فروش جدید'],
    loggedInAt: loggedIn.loggedInAt,
  });
  expect(h.refresh).not.toHaveBeenCalled();
  close();
});

it('recovers an uncached actor once and keeps the previous account and role out of their display', async () => {
  rememberHeaderSession(user('staff-b'));
  h.refresh.mockResolvedValue(login('staff-a'));
  (await mount())();
  (await mount())();
  expect(h.refresh).toHaveBeenCalledTimes(1);
  expect(readHeaderSession(undefined, 'staff-b')).toBeNull();
  expect(readHeaderSession(undefined, 'staff-a')?.displayName).toBe('staff-a');
});
