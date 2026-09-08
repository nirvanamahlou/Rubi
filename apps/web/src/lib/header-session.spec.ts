import { describe, expect, it } from 'vitest';
import type { LoginResponse } from '@rubi/contracts';

import {
  formatHeaderLoginTime,
  readHeaderSession,
  rememberHeaderSession,
} from './header-session';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

const user: LoginResponse['user'] = {
  id: 'user-1',
  username: 'nirvana',
  displayName: 'کاربر نمونه',
  email: null,
  permissions: [],
  branches: [],
};

describe('header session identity', () => {
  it('stores only the visible identity and the login time for the current tab', () => {
    const storage = memoryStorage();
    const loggedInAt = '2026-09-07T07:32:00.000Z';

    expect(rememberHeaderSession(user, loggedInAt, storage)).toEqual({
      displayName: 'کاربر نمونه',
      loggedInAt,
    });
    expect(readHeaderSession(storage)).toEqual({
      displayName: 'کاربر نمونه',
      loggedInAt,
    });
  });

  it('rejects malformed or incomplete cached values', () => {
    const storage = memoryStorage();
    storage.setItem('rubi:header-session:v1', '{"displayName":"ناقص"}');
    expect(readHeaderSession(storage)).toBeNull();
  });

  it('does not cache the username when the display name is empty', () => {
    const storage = memoryStorage();
    const identity = rememberHeaderSession(
      { ...user, displayName: '   ' },
      '2026-09-07T07:32:00.000Z',
      storage,
    );

    expect(identity.displayName).toBe('کاربر سامانه');
    expect(JSON.stringify(identity)).not.toContain(user.username);
  });

  it('formats a valid login time and safely handles an invalid value', () => {
    expect(formatHeaderLoginTime('2026-09-07T07:32:00.000Z')).toContain(':');
    expect(formatHeaderLoginTime('invalid')).toBe('—');
  });
});
