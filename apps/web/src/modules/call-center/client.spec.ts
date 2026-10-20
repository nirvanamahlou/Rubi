import { previewCalls } from './fixture-data';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { callCenterApi } from './client';

const transport = vi.hoisted(() => vi.fn());
vi.mock('@/i18n/localized-fetch', () => ({ localizedFetch: transport }));
vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'http://localhost:4000/api/v1',
}));
describe('durable Call Center client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('keeps the same event ID on retries and sends no provider URL or forged contact ID', async () => {
    const call = {
      ...previewCalls()[0]!,
      id: 'stable-id',
      contactId: 'not-client-owned',
      recordings: [
        { id: 'a', title: 'audio', url: 'https://untrusted.example' },
      ],
    };
    transport.mockResolvedValue(new Response(JSON.stringify({ data: call })));
    await callCenterApi.create('branch-1', call);
    const [url, options] = transport.mock.calls[0]!;
    expect(url).toContain('/customer-affairs/call-center/calls');
    expect(options.credentials).toBe('include');
    expect(options.headers['x-branch-id']).toBe('branch-1');
    expect(JSON.parse(options.body)).toMatchObject({ id: 'stable-id' });
    expect(options.body).not.toContain('untrusted');
    expect(options.body).not.toContain('not-client-owned');
  });
  it('surfaces failed saves instead of reporting local success', async () => {
    transport.mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: 'Database unavailable' } }),
        { status: 503 },
      ),
    );
    await expect(
      callCenterApi.note('branch-1', 'contact', 'note-id', 'note'),
    ).rejects.toThrow('Database unavailable');
  });
  it('fetches a branch-scoped no-cache server page with cancellation', async () => {
    transport.mockResolvedValue(
      new Response(JSON.stringify({ data: [], meta: { total: 0 } })),
    );
    const abort = new AbortController();
    await callCenterApi.list('branch-1', 2, abort.signal);
    expect(transport).toHaveBeenCalledWith(
      expect.stringContaining('?page=2&pageSize=50'),
      expect.objectContaining({
        signal: abort.signal,
        cache: 'no-store',
        credentials: 'include',
      }),
    );
  });
});
