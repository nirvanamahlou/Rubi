import { previewCalls } from './fixture-data';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { callCenterApi } from './client';
import { workflowApi } from './workflow-client';

const transport = vi.hoisted(() => vi.fn());
vi.mock('@/i18n/localized-fetch', () => ({ localizedFetch: transport }));
vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'http://localhost:4000/api/v1',
}));
describe('durable Call Center client', () => {
  it('preserves explicit completion identity without converting it to a new call', async () => {
    const call = { ...previewCalls()[0]!, completionToken: 'a'.repeat(64) };
    transport.mockResolvedValue(new Response(JSON.stringify({ data: call })));
    await callCenterApi.create('branch-1', call);
    expect(JSON.parse(transport.mock.calls.at(-1)![1].body)).toMatchObject({
      id: call.id,
      completionToken: call.completionToken,
    });
  });
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
  it('preserves command and optimistic version for workflow retries', async () => {
    transport.mockImplementation(
      async () => new Response(JSON.stringify({ data: [] })),
    );
    const input = {
      commandId: 'stable-command',
      id: 'request-id',
      expectedVersion: 3,
      title: 'Synthetic request',
    };
    await workflowApi.saveRequest('branch-1', 'contact-id', input);
    await workflowApi.saveRequest('branch-1', 'contact-id', input);
    expect(transport.mock.calls.map((call) => call[1].body)).toEqual([
      JSON.stringify(input),
      JSON.stringify(input),
    ]);
    expect(transport.mock.calls[0]?.[1]).toMatchObject({
      credentials: 'include',
      cache: 'no-store',
      headers: expect.objectContaining({ 'x-branch-id': 'branch-1' }),
    });
  });
  it('cancels stale queue reads and surfaces workflow conflicts', async () => {
    const abort = new AbortController();
    transport.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [], meta: { total: 0 } })),
    );
    await workflowApi.queue('branch-1', 'OVERDUE', 2, abort.signal);
    expect(transport.mock.calls[0]?.[0]).toContain(
      '/queue?view=OVERDUE&page=2',
    );
    expect(transport.mock.calls[0]?.[1].signal).toBe(abort.signal);
    transport.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Version conflict' }), {
        status: 409,
      }),
    );
    await expect(
      workflowApi.saveFollowUp('branch-1', 'request-id', {}),
    ).rejects.toThrow('Version conflict');
  });
});
