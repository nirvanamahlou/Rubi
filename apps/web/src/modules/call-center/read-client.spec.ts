import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readApi, emptySearch, searchBody } from './read-client';
import { CallCenterHttpError } from './client';
const transport = vi.hoisted(() => vi.fn());
vi.mock('@/i18n/localized-fetch', () => ({ localizedFetch: transport }));
vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'http://localhost:4000/api/v1',
}));
describe('Call Center paginated read transport', () => {
  beforeEach(() => vi.clearAllMocks());
  it('keeps private query out of URL and sends branch, revision and abort signal', async () => {
    transport.mockImplementation(
      async () => new Response(JSON.stringify({ data: [], meta: {} })),
    );
    const c = new AbortController();
    await readApi.search(
      'branch',
      { ...emptySearch, query: '۰۹۱۲۰۰۰۰۰۰۱' },
      2,
      'snapshot',
      c.signal,
    );
    const [url, options] = transport.mock.calls[0]!;
    expect(url).toBe(
      'http://localhost:4000/api/v1/customer-affairs/call-center/search',
    );
    expect(options).toMatchObject({
      method: 'POST',
      signal: c.signal,
      cache: 'no-store',
      headers: { 'x-branch-id': 'branch' },
    });
    expect(JSON.parse(options.body)).toMatchObject({
      query: '۰۹۱۲۰۰۰۰۰۰۱',
      page: 2,
      revision: 'snapshot',
      pageSize: 20,
    });
  });
  it('sends Tehran midnight and removes reset empty values', () => {
    expect(searchBody({ ...emptySearch, from: '2027-01-01' })).toEqual({
      scope: 'LATEST',
      from: '2026-12-31T20:30:00.000Z',
    });
    expect(searchBody(emptySearch)).toEqual({ scope: 'LATEST' });
  });
  it('preserves denial status so stale private views can be cleared', async () => {
    transport.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 }),
    );
    await expect(
      readApi.search(
        'branch',
        emptySearch,
        1,
        undefined,
        new AbortController().signal,
      ),
    ).rejects.toEqual(new CallCenterHttpError('Forbidden', 403));
  });
  it('propagates aborted requests without treating them as an empty successful page', async () => {
    const c = new AbortController();
    transport.mockImplementation(async () => {
      c.abort();
      throw new DOMException('Aborted', 'AbortError');
    });
    await expect(
      readApi.search('branch', emptySearch, 1, undefined, c.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
