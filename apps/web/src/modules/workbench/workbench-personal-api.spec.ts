import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'http://api.local/api/v1',
}));
vi.mock('@/lib/auth-session', () => ({
  refreshAuthenticatedSession: vi.fn().mockResolvedValue(false),
}));

import { workbenchPersonalApi } from './workbench-personal-api';

describe('profile photo save request', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends the photo and edited profile together to the owner endpoint', async () => {
    const saved = {
      displayName: 'کاربر آزمون',
      email: 'qa@example.com',
      phone: '09121234567',
      photoDocumentId: '44444444-4444-4444-8444-444444444444',
      updatedAt: '2026-10-03T08:00:00.000Z',
    };
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      text: async () =>
        JSON.stringify({ data: { id: saved.photoDocumentId, profile: saved } }),
    });
    vi.stubGlobal('fetch', fetchImpl);
    const file = new File(['photo'], 'avatar.png', { type: 'image/png' });

    const response = await workbenchPersonalApi.uploadProfilePhoto({
      branchId: '33333333-3333-4333-8333-333333333333',
      title: 'عکس پروفایل',
      file,
      displayName: saved.displayName,
      email: saved.email,
      phone: saved.phone,
    });

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://api.local/api/v1/workbench/profile/photo');
    expect(init).toMatchObject({ method: 'POST', credentials: 'include' });
    const body = init.body as FormData;
    expect(body.get('file')).toBe(file);
    expect(body.get('displayName')).toBe(saved.displayName);
    expect(body.get('email')).toBe(saved.email);
    expect(body.get('phone')).toBe(saved.phone);
    expect(response.data.profile).toEqual(saved);
  });

  it('loads only the authenticated user’s assigned Procurement follow-ups', async () => {
    const payload = {
      items: [
        {
          id: 'task-1',
          requestId: 'request-1',
          title: 'پیگیری درخواست خرید PR-1',
          dueAt: '2026-10-07T10:00:00.000Z',
          createdAt: '2026-10-06T10:00:00.000Z',
        },
      ],
    };
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(payload),
    });
    vi.stubGlobal('fetch', fetchImpl);

    await expect(workbenchPersonalApi.procurementFollowUps()).resolves.toEqual(
      payload,
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://api.local/api/v1/workbench/procurement-follow-ups',
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
  });
});
