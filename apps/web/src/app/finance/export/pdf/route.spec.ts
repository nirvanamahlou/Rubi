import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'http://trusted-api.test',
}));
vi.mock('@/modules/finance/server/finance-pdf', () => ({
  renderFinancePdf: vi.fn().mockResolvedValue(Buffer.from('%PDF-test')),
}));
import { GET } from './route';
import { renderFinancePdf } from '@/modules/finance/server/finance-pdf';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
describe('Private Finance PDF route', () => {
  it('forwards only the frozen fiscal constraints and authenticated cookies to the trusted API', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ scope: 'INBOX' }));
    vi.stubGlobal('fetch', fetchMock);
    await GET(
      new Request('http://web.test/finance/export/pdf', {
        headers: {
          cookie: 'synthetic-session',
          'x-finance-company': 'A',
          'x-finance-actor-id': 'actor',
          'x-finance-period-id': 'year',
          'x-finance-period-version': '2',
          'x-finance-period-mode': 'temporary',
          authorization: 'not-forwarded',
          'x-unrelated-header': 'not-forwarded',
        },
      }),
    );
    const headers = new Headers(fetchMock.mock.calls[0]?.[1].headers);
    expect(headers.get('x-finance-period-id')).toBe('year');
    expect(headers.get('x-finance-period-mode')).toBe('temporary');
    expect(headers.get('cookie')).toBe('synthetic-session');
    expect(headers.has('authorization')).toBe(false);
    expect(headers.has('x-unrelated-header')).toBe(false);
  });
  it.each([401, 403, 404])(
    'does not render unauthorized or absent data (%s)',
    async (status) => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(new Response('{}', { status }));
      vi.stubGlobal('fetch', fetchMock);
      const result = await GET(
        new Request('http://web.test/finance/export/pdf?scope=RECEIPT', {
          headers: { cookie: 'synthetic-session' },
        }),
      );
      expect(result.status).toBe(status);
      expect(result.headers.get('cache-control')).toContain('no-store');
      expect(renderFinancePdf).not.toHaveBeenCalled();
      expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
        headers: { cookie: 'synthetic-session', accept: 'application/json' },
        redirect: 'error',
      });
    },
  );
  it('returns a private downloadable PDF only after API authorization', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ scope: 'RECEIPT' })),
    );
    const result = await GET(
      new Request('http://web.test/finance/export/pdf?scope=RECEIPT'),
    );
    expect(result.status).toBe(200);
    expect(result.headers.get('content-type')).toBe('application/pdf');
    expect(result.headers.get('content-disposition')).toContain(
      'finance-receipt.pdf',
    );
    expect(await result.text()).toBe('%PDF-test');
  });
  it('fails honestly when the server renderer is unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ scope: 'RECEIPT' })),
    );
    vi.mocked(renderFinancePdf).mockRejectedValueOnce(
      new Error('browser unavailable'),
    );
    expect(
      (await GET(new Request('http://web.test/finance/export/pdf'))).status,
    ).toBe(503);
  });
});
