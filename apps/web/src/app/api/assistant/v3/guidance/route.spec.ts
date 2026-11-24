import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

vi.mock('@nora/contracts', () => ({
  canViewRoute: (permissions: string[], href: string) =>
    permissions.includes(href),
}));

const url = 'http://localhost:3340/api/assistant/v3/guidance';
const request = (
  question: string,
  options: { origin?: string; cookie?: string; panel?: string } = {},
) =>
  new Request(url, {
    method: 'POST',
    headers: {
      origin: options.origin ?? new URL(url).origin,
      cookie: options.cookie ?? 'nora_access=synthetic; other=private',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      version: 3,
      question,
      panel: options.panel ?? '/reservations',
    }),
  });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('authenticated guidance transport', () => {
  it('rejects missing cookies and cross-origin requests before IAM', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    expect(
      (await POST(request('صدور بلیت چطور است؟', { cookie: '' }))).status,
    ).toBe(401);
    expect(
      (
        await POST(
          request('صدور بلیت چطور است؟', { origin: 'https://other.invalid' }),
        )
      ).status,
    ).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('returns only authorized sections and forwards only the session cookie', async () => {
    vi.stubEnv('ERP_AUTH_API_BASE_URL', 'http://localhost:4301/api/v1');
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ permissions: ['/reservations'] }));
    vi.stubGlobal('fetch', fetcher);
    const response = await POST(request('بلیت پرواز رو چطور صادر کنم؟'));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(fetcher).toHaveBeenCalledWith(
      'http://localhost:4301/api/v1/iam/auth/access',
      expect.objectContaining({ headers: { cookie: 'nora_access=synthetic' } }),
    );
    expect(
      (await response.json()).sections.map(
        (section: { ref: string }) => section.ref,
      ),
    ).toEqual(['travel-issuance/ticket']);
  });

  it('never returns evidence for rejected sessions or unavailable IAM', async () => {
    vi.stubEnv('ERP_AUTH_API_BASE_URL', 'http://localhost:4301/api/v1');
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockRejectedValueOnce(new Error('offline'));
    vi.stubGlobal('fetch', fetcher);
    expect((await POST(request('نحوه صدور واچر هتل'))).status).toBe(401);
    expect((await POST(request('نحوه صدور واچر هتل'))).status).toBe(503);
  });
});
