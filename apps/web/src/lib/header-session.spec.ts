import { describe, expect, it } from 'vitest';
import type { LoginResponse } from '@nora/contracts';

import {
  clearHeaderSession,
  formatHeaderLoginTime,
  getHeaderRoleLabel,
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
    removeItem(key: string) {
      values.delete(key);
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
      roleNames: [],
    });
    expect(readHeaderSession(storage)).toEqual({
      displayName: 'کاربر نمونه',
      loggedInAt,
      roleNames: [],
    });
  });

  it('rejects malformed or incomplete cached values', () => {
    const storage = memoryStorage();
    storage.setItem('nora:header-session:v1', '{"displayName":"ناقص"}');
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

  it('exposes assigned role names for the date-adjacent header label', () => {
    const storage = memoryStorage();
    rememberHeaderSession(
      { ...user, roles: [{ code: 'sales', name: 'کارشناس فروش' }] },
      '2026-09-07T07:32:00.000Z',
      storage,
    );

    expect(getHeaderRoleLabel(storage)).toBe('کارشناس فروش');
  });

  it('prefers the user-specific title over an administrator or shared template', () => {
    const storage = memoryStorage();
    rememberHeaderSession(
      {
        ...user,
        roles: [
          { code: 'administrator', name: 'مدیر سیستم' },
          { code: 'sales', name: 'کارشناس فروش' },
          { code: 'manual-access-v3-user-1', name: '  مسئول رزرو بین‌الملل  ' },
        ],
      },
      '2026-09-07T07:32:00.000Z',
      storage,
    );
    expect(getHeaderRoleLabel(storage)).toBe('مسئول رزرو بین‌الملل');
    expect(readHeaderSession(storage)?.roleNames).toEqual([
      'مسئول رزرو بین‌الملل',
    ]);
  });

  it('retains custom shared titles and never invents a manager title', () => {
    const storage = memoryStorage();
    rememberHeaderSession(
      { ...user, roles: [{ code: 'custom', name: 'هماهنگ‌کننده سفر' }] },
      '2026-09-07T07:32:00.000Z',
      storage,
    );
    expect(getHeaderRoleLabel(storage)).toBe('هماهنگ‌کننده سفر');
    rememberHeaderSession(
      { ...user, roles: [{ code: 'administrator', name: 'مدیر سیستم' }] },
      '2026-09-07T07:32:00.000Z',
      storage,
    );
    expect(getHeaderRoleLabel(storage)).toBe('مدیر سیستم');
    rememberHeaderSession(user, '2026-09-07T07:32:00.000Z', storage);
    expect(getHeaderRoleLabel(storage)).toBe('');
  });

  it('does not present technical personal-access grants as the user job title', () => {
    const storage = memoryStorage();
    rememberHeaderSession(
      {
        ...user,
        roles: [
          { code: 'personal-access-user-1', name: 'Technical grant' },
          { code: 'manual-access-v3-user-1', name: '  ' },
          { code: 'custom', name: 'هماهنگ‌کننده سفر' },
        ],
      },
      '2026-09-07T07:32:00.000Z',
      storage,
    );
    expect(getHeaderRoleLabel(storage)).toBe('هماهنگ‌کننده سفر');
  });

  it('formats a valid login time and safely handles an invalid value', () => {
    expect(formatHeaderLoginTime('2026-09-07T07:32:00.000Z')).toContain(':');
    expect(formatHeaderLoginTime('invalid')).toBe('—');
  });

  it('clears only the header identity after secure logout', () => {
    const storage = memoryStorage();
    rememberHeaderSession(user, '2026-09-07T07:32:00.000Z', storage);

    clearHeaderSession(storage);

    expect(readHeaderSession(storage)).toBeNull();
  });
});
