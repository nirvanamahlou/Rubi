import { describe, expect, it } from 'vitest';
import { POST } from '../../app/(crm)/integrations/ghestiroo-launch/route';

describe('Scoped SSO navigation document', () => {
  const body = new URLSearchParams({
    action: 'https://ghestiroo.example/admin/nora-sso',
    token: 's'.repeat(64),
  });
  function request(value = body, origin = 'https://nora.example') {
    return new Request('https://nora.example/integrations/ghestiroo-launch', {
      method: 'POST',
      headers: { origin, 'content-type': 'application/x-www-form-urlencoded' },
      body: value,
    });
  }
  it('uses a nonce and exact external form origin without putting the grant into a URL', async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get('content-security-policy')).toMatch(
      /form-action https:\/\/ghestiroo.example; script-src 'nonce-/,
    );
    expect(response.headers.get('cache-control')).toContain('no-store');
    const html = await response.text();
    expect(html).toContain('type="hidden" name="token"');
    expect(html).not.toContain('?token=');
  });
  it('rejects foreign origins, arbitrary destinations, insecure URLs and oversized bodies', async () => {
    expect((await POST(request(body, 'https://evil.example'))).status).toBe(
      403,
    );
    for (const action of [
      'https://evil.example/other',
      'http://ghestiroo.example/admin/nora-sso',
      'https://u:p@ghestiroo.example/admin/nora-sso',
    ])
      expect(
        (
          await POST(
            request(new URLSearchParams({ action, token: 's'.repeat(64) })),
          )
        ).status,
      ).toBe(400);
    expect(
      (await POST(request(new URLSearchParams({ token: 's'.repeat(3000) }))))
        .status,
    ).toBe(413);
  });
  it('allows opaque origins only for browser-attested same-origin navigation', async () => {
    const safe = new Request(
      'https://nora.example/integrations/ghestiroo-launch',
      {
        method: 'POST',
        headers: {
          origin: 'null',
          'sec-fetch-site': 'same-origin',
          'sec-fetch-mode': 'navigate',
          'sec-fetch-dest': 'document',
          'content-type': 'application/x-www-form-urlencoded',
        },
        body,
      },
    );
    expect((await POST(safe)).status).toBe(200);
    expect((await POST(request(body, 'null'))).status).toBe(403);
  });
});
