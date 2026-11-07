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

  it('removes and promotes group members through authenticated encoded routes', async () => {
    await messagingApi.removeMember('group/id', 'member/id');
    expect(fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('/conversations/group%2Fid/members/member%2Fid'),
      expect.objectContaining({ method: 'DELETE', credentials: 'include' }),
    );
    await messagingApi.promoteMember('group/id', 'member/id');
    expect(fetch).toHaveBeenLastCalledWith(
      expect.stringContaining(
        '/conversations/group%2Fid/members/member%2Fid/owner',
      ),
      expect.objectContaining({ method: 'PUT', credentials: 'include' }),
    );
  });

  it('loads branch-scoped contacts with authenticated cookies', async () => {
    await messagingApi.contacts('رضا');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/messaging/contacts?limit=50&search='),
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
  });

  it('removes a conversation and updates a group through authenticated endpoints', async () => {
    await messagingApi.remove('conversation/id');
    expect(fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('/conversations/conversation%2Fid'),
      expect.objectContaining({ method: 'DELETE', credentials: 'include' }),
    );
    const input = { title: 'Updated group', memberIds: ['member'] };
    await messagingApi.updateGroup('group', input);
    expect(fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('/conversations/group'),
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify(input) }),
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

  it('uploads one message attachment as multipart form data', async () => {
    const file = new File(['test'], 'receipt.png', { type: 'image/png' });

    await messagingApi.uploadAttachment(
      '22222222-2222-4222-8222-222222222222',
      'message:request-0001',
      file,
    );

    const [, options] = vi.mocked(fetch).mock.calls[0]!;
    expect(options).toEqual(
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
    );
    expect((options!.body as FormData).get('clientRequestId')).toBe(
      'message:request-0001',
    );
  });

  it('downloads an attachment through its authenticated conversation', async () => {
    const blob = new Blob(['file'], { type: 'image/png' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        blob: async () => blob,
      }),
    );
    const received = await messagingApi.downloadAttachment(
      '22222222-2222-4222-8222-222222222222',
      '33333333-3333-4333-8333-333333333333',
    );
    expect(received).toBe(blob);
    expect(fetch).toHaveBeenCalledWith(
      'http://api.local/api/v1/messaging/conversations/22222222-2222-4222-8222-222222222222/attachments/33333333-3333-4333-8333-333333333333',
      { credentials: 'include', cache: 'no-store' },
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
  it('sends reply targets and explicit idempotent reaction commands', async () => {
    await messagingApi.send('conversation', {
      body: 'reply',
      clientRequestId: 'message:reply-0001',
      replyToMessageId: 'source',
    });
    expect(fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('/conversations/conversation/messages'),
      expect.objectContaining({
        body: expect.stringContaining('"replyToMessageId":"source"'),
      }),
    );
    await messagingApi.react('conversation', 'message', { emoji: '👍' });
    expect(fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('/messages/message/reaction'),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ emoji: '👍' }),
      }),
    );
    await messagingApi.react('conversation', 'message', { emoji: null });
    expect(fetch).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ emoji: null }),
      }),
    );
  });
});
