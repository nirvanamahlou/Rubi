import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'http://trusted-api.test',
}));
vi.mock('@/modules/ticket-catalog/server/issued-pdf', () => ({
  renderIssuedPdf: vi.fn().mockResolvedValue(Buffer.from('%PDF-test')),
}));
import { GET } from './route';
import { renderIssuedPdf } from '@/modules/ticket-catalog/server/issued-pdf';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
describe('Private issued ticket PDF route', () => {
  it.each([401, 403, 404])(
    'does not render unauthorized or absent data (%s)',
    async (status) => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(new Response('{}', { status }));
      vi.stubGlobal('fetch', fetchMock);
      const result = await GET(
        new Request(
          'http://web.test/ticket-catalog/issued/export/pdf?issuedFrom=2026-10-01&issuedTo=2026-10-05&passenger=test',
          {
            headers: { cookie: 'synthetic-session' },
          },
        ),
      );
      expect(result.status).toBe(status);
      expect(result.headers.get('cache-control')).toContain('no-store');
      expect(renderIssuedPdf).not.toHaveBeenCalled();
      expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
        headers: { cookie: 'synthetic-session', accept: 'application/json' },
        redirect: 'error',
      });
    },
  );
  it('returns a private downloadable PDF only after API authorization', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ data: [] })),
    );
    const result = await GET(
      new Request(
        'http://web.test/ticket-catalog/issued/export/pdf?issuedFrom=2026-10-01&issuedTo=2026-10-05&passenger=test',
      ),
    );
    expect(result.status).toBe(200);
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toContain(
      '/reservations/requests/issued-tickets?issuedFrom=2026-10-01&issuedTo=2026-10-05&passenger=test',
    );
    expect(result.headers.get('content-type')).toBe('application/pdf');
    expect(result.headers.get('content-disposition')).toContain(
      'issued-tickets.pdf',
    );
    expect(await result.text()).toBe('%PDF-test');
  });
  it('fails honestly when the server renderer is unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ data: [] })),
    );
    vi.mocked(renderIssuedPdf).mockRejectedValueOnce(
      new Error('browser unavailable'),
    );
    expect(
      (
        await GET(
          new Request('http://web.test/ticket-catalog/issued/export/pdf'),
        )
      ).status,
    ).toBe(503);
  });
});
