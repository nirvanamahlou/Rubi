import type { LoginResponse } from '@rubi/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  loadAuthenticatedProfile,
  logoutAuthenticatedSession,
  ProfileUnauthorizedError,
} from './client';

const baseUrl = 'http://localhost:4000/api/v1';
const login: LoginResponse = {
  user: {
    id: 'user-1',
    username: 'nirvana',
    displayName: 'کاربر احرازشده',
    email: 'user@example.test',
    permissions: ['iam.sessions.manage'],
    branches: [{ id: 'branch-1', code: 'THR', name: 'تهران' }],
  },
};

describe('authenticated profile API client', () => {
  it('loads identity, own sessions and MFA only through public IAM endpoints', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: 'session-1',
              status: 'ACTIVE',
              createdAt: '2026-09-08T06:00:00.000Z',
              lastUsedAt: '2026-09-08T06:10:00.000Z',
              expiresAt: '2026-09-15T06:00:00.000Z',
            },
          ]),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: { enabled: true, setupPending: false, lockedUntil: null },
          }),
          { status: 200 },
        ),
      );

    const result = await loadAuthenticatedProfile({
      baseUrl,
      fetchImpl: fetchMock as unknown as typeof fetch,
      refresh: vi.fn().mockResolvedValue(login),
      loggedInAt: '2026-09-08T05:50:00.000Z',
    });

    expect(result?.user.displayName).toBe('کاربر احرازشده');
    expect(result?.sessions).toHaveLength(1);
    expect(result?.mfa.enabled).toBe(true);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `${baseUrl}/iam/auth/sessions`,
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `${baseUrl}/iam/auth/mfa/status`,
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    );
  });

  it('reports an unauthorized state when the authenticated refresh is unavailable', async () => {
    await expect(
      loadAuthenticatedProfile({
        baseUrl,
        refresh: vi.fn().mockResolvedValue(null),
      }),
    ).rejects.toBeInstanceOf(ProfileUnauthorizedError);
  });

  it('returns the empty state for a malformed identity response', async () => {
    await expect(
      loadAuthenticatedProfile({
        baseUrl,
        refresh: vi.fn().mockResolvedValue({ user: {} }),
      }),
    ).resolves.toBeNull();
  });

  it('uses the existing secure logout endpoint with session cookies', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));

    await logoutAuthenticatedSession(
      baseUrl,
      fetchMock as unknown as typeof fetch,
    );

    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/iam/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: { accept: 'application/json' },
    });
  });
});
