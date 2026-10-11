import { describe, expect, it, vi } from 'vitest';
import { proxyExecutiveSnapshot } from './proxy';
const request = (cookie = 'nora_access=synthetic; nora_refresh=private') =>
  new Request('http://localhost/api/assistant/executive', {
    headers: { cookie },
  });
describe('assistant transport boundary', () => {
  it('fails closed without a cookie or configuration', async () => {
    const fetcher = vi.fn();
    expect(
      (
        await proxyExecutiveSnapshot(
          request(''),
          'http://127.0.0.1:4300',
          fetcher,
        )
      ).status,
    ).toBe(401);
    expect(
      (await proxyExecutiveSnapshot(request(), undefined, fetcher)).status,
    ).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('forwards only the access cookie to one fixed read endpoint', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ version: 1 }));
    const response = await proxyExecutiveSnapshot(
      request(),
      'http://127.0.0.1:4300',
      fetcher,
    );
    expect(response.status).toBe(200);
    expect(String(fetcher.mock.calls[0]![0])).toBe(
      'http://127.0.0.1:4300/v1/executive/snapshot',
    );
    expect(fetcher.mock.calls[0]![1]).toMatchObject({
      method: 'GET',
      redirect: 'error',
      cache: 'no-store',
      headers: { cookie: 'nora_access=synthetic' },
    });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
  it('rejects insecure remote configuration, credentials and redirects', async () => {
    const fetcher = vi.fn();
    for (const url of [
      'http://remote.example',
      'https://user:pass@host.example',
      'https://host.example/?url=other',
    ])
      expect(
        (await proxyExecutiveSnapshot(request(), url, fetcher)).status,
      ).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('does not expose raw errors or accept user-selected scope', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('private data', { status: 500 }));
    const response = await proxyExecutiveSnapshot(
      request(),
      'http://127.0.0.1:4300',
      fetcher,
    );
    expect(await response.text()).not.toContain('private data');
    const forged = new Request(
      'http://localhost/api/assistant/executive?userId=other',
      { headers: { cookie: 'nora_access=x' } },
    );
    expect(
      (await proxyExecutiveSnapshot(forged, 'http://127.0.0.1:4300', fetcher))
        .status,
    ).toBe(400);
  });
});
