import { describe, expect, it } from 'vitest';

import {
  activeProfileSessions,
  formatProfileDate,
  normalizeProfileTab,
  profileInitials,
  safeProfileDisplayName,
  summarizePermissions,
} from './profile';

describe('authenticated profile model', () => {
  it('builds initials from the authenticated display name and uses the safe fallback', () => {
    expect(profileInitials('نیروانا مهلوجی')).toBe('نم');
    expect(profileInitials('مدیر')).toBe('م');
    expect(safeProfileDisplayName('   ')).toBe('کاربر سامانه');
  });

  it('normalizes only supported profile tabs', () => {
    expect(normalizeProfileTab('preferences')).toBe('preferences');
    expect(normalizeProfileTab('security')).toBe('security');
    expect(normalizeProfileTab('roles')).toBe('overview');
  });

  it('keeps only active sessions and summarizes permissions without granting anything', () => {
    const sessions = [
      {
        id: 'active',
        status: 'ACTIVE',
        createdAt: '2026-09-08T06:00:00.000Z',
        lastUsedAt: '2026-09-08T06:10:00.000Z',
        expiresAt: '2026-09-15T06:00:00.000Z',
      },
      {
        id: 'revoked',
        status: 'REVOKED',
        createdAt: '2026-09-01T06:00:00.000Z',
        lastUsedAt: '2026-09-01T06:10:00.000Z',
        expiresAt: '2026-09-08T06:00:00.000Z',
      },
    ];
    expect(activeProfileSessions(sessions).map(({ id }) => id)).toEqual([
      'active',
    ]);
    expect(
      summarizePermissions([
        'iam.users.read',
        'documents.list',
        'documents.file.read',
      ]),
    ).toEqual(
      expect.arrayContaining([
        { key: 'iam', label: 'مدیریت هویت', count: 1 },
        { key: 'documents', label: 'اسناد', count: 2 },
      ]),
    );
  });

  it('formats session dates and safely handles unavailable values', () => {
    expect(formatProfileDate('2026-09-08T06:00:00.000Z')).not.toBe(
      'در دسترس نیست',
    );
    expect(formatProfileDate('invalid')).toBe('در دسترس نیست');
    expect(formatProfileDate(null)).toBe('در دسترس نیست');
  });
});
