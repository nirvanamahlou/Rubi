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

  it('serves the requested catalogue from another panel only with its topic permission', async () => {
    vi.stubEnv('ERP_AUTH_API_BASE_URL', 'http://localhost:4301/api/v1');
    const access = (permissions: string[]) => Response.json({ permissions });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(access(['/system', 'system.audit.read']))
        .mockResolvedValueOnce(access(['/system'])),
    );
    const question = 'راهنمای مدیریت سیستم، تاریخچه فعالیت';
    const ok = await (await POST(request(question))).json();
    expect(ok.sections.map((s: { ref: string }) => s.ref)).toEqual([
      'system-management/history',
    ]);
    const forbidden = await (await POST(request(question))).json();
    expect(forbidden.sections).toEqual([]);
  });

  it('returns the approved campaign steps for a natural question from reservations', async () => {
    vi.stubEnv('ERP_AUTH_API_BASE_URL', 'http://localhost:4301/api/v1');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({ permissions: ['/marketing?section=campaigns'] }),
        )
        .mockResolvedValueOnce(Response.json({ permissions: [] })),
    );
    const question = 'ساخت کمپین رو از کجا شروع کنم؟';
    const answer = await (await POST(request(question))).json();
    expect(answer.sections).toHaveLength(1);
    expect(answer.sections[0].ref).toBe('marketing/campaign');
    expect(answer.sections[0].steps[0]).toContain('فرم کمپین');
    expect((await (await POST(request(question))).json()).sections).toEqual([]);
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
