import { describe, expect, it, vi } from 'vitest';
import {
  proxyExecutiveSnapshot,
  proxyAssistantAction,
  proxyAssistantV2Action,
} from './proxy';
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
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json(
        { version: 1 },
        {
          headers: { 'x-request-id': '01010101-0202-0303-0404-050505050505' },
        },
      ),
    );
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
    expect(response.headers.get('x-request-id')).toBe(
      '01010101-0202-0303-0404-050505050505',
    );
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

describe('fixed assistant action transport', () => {
  it('allows only three fixed read routes and forwards no user text or scope', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ version: 1 }));
    const response = await proxyAssistantAction(
      request(),
      'http://127.0.0.1:4300',
      'daily-summary',
      fetcher,
    );
    expect(response.status).toBe(200);
    expect(String(fetcher.mock.calls[0]![0])).toBe(
      'http://127.0.0.1:4300/v1/assistant/actions/daily-summary',
    );
    expect(fetcher.mock.calls[0]![1]).toMatchObject({
      method: 'GET',
      headers: { cookie: 'nora_access=synthetic' },
    });
    expect(fetcher.mock.calls[0]![1]).not.toHaveProperty('body');
  });
  it('rejects unknown tools, write requests and caller-selected scope before fetching', async () => {
    const fetcher = vi.fn();
    expect(
      (
        await proxyAssistantAction(
          request(),
          'http://127.0.0.1:4300',
          '../sql',
          fetcher,
        )
      ).status,
    ).toBe(404);
    const scoped = new Request(
      'http://localhost/api/assistant/actions/daily-summary?company=other',
      { headers: { cookie: 'nora_access=x' } },
    );
    expect(
      (
        await proxyAssistantAction(
          scoped,
          'http://127.0.0.1:4300',
          'daily-summary',
          fetcher,
        )
      ).status,
    ).toBe(400);
    const write = new Request(
      'http://localhost/api/assistant/actions/daily-summary',
      { method: 'POST', headers: { cookie: 'nora_access=x' } },
    );
    expect(
      (
        await proxyAssistantAction(
          write,
          'http://127.0.0.1:4300',
          'daily-summary',
          fetcher,
        )
      ).status,
    ).toBe(405);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

it('forwards only allowlisted v2 filters and keeps v1 query-free', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ version: 2 }));
  const make = (query: string) =>
    new Request(
      'http://localhost/api/assistant/v2/actions/sales-analysis?' + query,
      { headers: { cookie: 'nora_access=synthetic' } },
    );
  expect(
    (
      await proxyAssistantV2Action(
        make('startDate=2026-10-01&endDate=2026-10-12'),
        'http://127.0.0.1:4300',
        'sales-analysis',
        fetcher,
      )
    ).status,
  ).toBe(200);
  expect(String(fetcher.mock.calls[0]![0])).toBe(
    'http://127.0.0.1:4300/v2/assistant/actions/sales-analysis?startDate=2026-10-01&endDate=2026-10-12',
  );
  fetcher.mockClear();
  for (const query of [
    'userId=other',
    'branchId=a&branchId=b',
    'url=https://example.com',
  ])
    expect(
      (
        await proxyAssistantV2Action(
          make(query),
          'http://127.0.0.1:4300',
          'sales-analysis',
          fetcher,
        )
      ).status,
    ).toBe(400);
  expect(
    (
      await proxyAssistantAction(
        make('startDate=2026-10-01'),
        'http://127.0.0.1:4300',
        'sales-analysis',
        fetcher,
      )
    ).status,
  ).toBe(400);
  expect(fetcher).not.toHaveBeenCalled();
});
