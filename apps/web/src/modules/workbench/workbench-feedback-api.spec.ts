import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'http://api.local/api/v1',
}));
vi.mock('@/lib/auth-session', () => ({
  refreshAuthenticatedSession: vi.fn().mockResolvedValue(false),
}));

import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { uploadWorkbenchFeedbackFiles } from './workbench-feedback-api';

describe('Workbench feedback attachment client', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({
          data: { id: '55555555-5555-4555-8555-555555555555' },
        }),
      }),
    );
  });

  it('uses the dedicated feedback endpoint instead of generic Documents upload', async () => {
    const file = new File(['%PDF-test'], 'feedback.pdf', {
      type: 'application/pdf',
    });

    await expect(
      uploadWorkbenchFeedbackFiles({
        feedbackId: '44444444-4444-4444-8444-444444444444',
        subject: 'پیشنهاد کارکنان',
        branchId: '33333333-3333-4333-8333-333333333333',
        anonymous: false,
        files: [file],
      }),
    ).resolves.toEqual(['55555555-5555-4555-8555-555555555555']);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        '/workbench/feedback/44444444-4444-4444-8444-444444444444/attachments',
      ),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: expect.any(FormData),
      }),
    );
  });
  it('retries multipart only once after authentication rejection with the same body', async () => {
    const refresh = vi.mocked(refreshAuthenticatedSession);
    refresh.mockClear();
    refresh.mockResolvedValueOnce({
      user: {
        id: 'synthetic',
        username: 'synthetic',
        displayName: 'Synthetic',
        email: null,
        permissions: [],
        branches: [],
      },
    });
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 409 }));

    await expect(
      uploadWorkbenchFeedbackFiles({
        feedbackId: 'feedback',
        subject: 'پیشنهاد کارکنان',
        branchId: 'branch',
        anonymous: true,
        files: [new File(['pdf'], 'test.pdf')],
      }),
    ).rejects.toMatchObject({ status: 409 });

    expect(refresh).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const first = fetchMock.mock.calls[0]?.[1];
    const second = fetchMock.mock.calls[1]?.[1];
    expect(first?.body).toBeInstanceOf(FormData);
    expect(first?.body).toBe(second?.body);
    expect(first?.signal).toBe(second?.signal);
    expect(first?.signal).toBeInstanceOf(AbortSignal);
  });
});
