import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'http://api.local/api/v1',
}));
vi.mock('@/lib/auth-session', () => ({
  refreshAuthenticatedSession: vi.fn().mockResolvedValue(false),
}));

import { messagingApi, messagingRequestId } from './messaging-api';

describe('Workbench messaging API client', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      }),
    );
  });

  it('loads branch-scoped contacts with authenticated cookies', async () => {
    await messagingApi.contacts('رضا');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/messaging/contacts?limit=50&search='),
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
  });

  it('posts group membership and server-side forward requests as JSON', async () => {
    await messagingApi.createGroup({
      title: 'گروه فروش',
      memberIds: ['11111111-1111-4111-8111-111111111111'],
      clientRequestId: 'group:request-0001',
    });
    await messagingApi.forward('22222222-2222-4222-8222-222222222222', {
      sourceMessageId: '33333333-3333-4333-8333-333333333333',
      clientRequestId: 'forward:request-0001',
    });

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('/messaging/conversations/groups'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('گروه فروش'),
      }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/forwards'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('sourceMessageId'),
      }),
    );
  });

  it('generates stable-format unique request identifiers', () => {
    vi.stubGlobal('crypto', {
      randomUUID: () => '44444444-4444-4444-8444-444444444444',
    });
    expect(messagingRequestId('message')).toBe(
      'message:44444444-4444-4444-8444-444444444444',
    );
  });
});
