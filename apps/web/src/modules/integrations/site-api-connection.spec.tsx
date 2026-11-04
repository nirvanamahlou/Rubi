import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { IntegrationSystemConfigV1 } from '@nora/contracts';
import { SiteApiConnection } from './components/site-api-connection';
import { integrationsApi, siteConnectionApi } from './api/client';
vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'https://nora.example/api/v1',
}));
vi.mock('@/lib/auth-session', () => ({ refreshAuthenticatedSession: vi.fn() }));
vi.mock('@/i18n/localized-fetch', () => ({
  localizedFetch: (...args: Parameters<typeof fetch>) => fetch(...args),
}));
afterEach(() => vi.unstubAllGlobals());
describe('Editable site API settings and selected-site transport', () => {
  it.each(['جهان باستان', 'نیایش سیر', 'جهان آکادمی'])(
    'renders write-only setup fields for %s even before a connection exists',
    (name) => {
      const html = renderToStaticMarkup(
        <SiteApiConnection
          branchId="branch"
          system={{ id: 'site', name } as IntegrationSystemConfigV1}
          onSaved={() => {}}
        />,
      );
      expect(html).toContain('نشانی HTTPS سایت');
      expect(html).toContain('شناسه کلید API');
      expect(html).toContain('type="password"');
      expect(html).toContain('ذخیره امن اطلاعات اتصال');
      expect(html).toContain('آزمون اتصال همین سایت');
      expect(html).not.toContain('localStorage');
    },
  );
  it('keeps credential writes in the protected body and carries site/branch on every native request', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        return new Response('{}', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );
    await siteConnectionApi.save('branch', 'academy', {
      origin: 'https://academy.example',
      client: 'nora',
      system: 'academy',
      organization: 'org',
      environment: 'production',
      keyId: 'key',
      secret: 'write-only-secret',
      expectedVersion: 0,
    });
    expect(calls[0]!.url).not.toContain('write-only-secret');
    expect(calls[0]!.init?.body).toContain('write-only-secret');
    expect(calls[0]!.init?.headers).toMatchObject({
      'X-Nora-Site-Connection': '1',
    });
    await integrationsApi.niyayeshStatus('branch', undefined, 'academy');
    await integrationsApi.niyayeshDashboard('branch', undefined, 'academy');
    await integrationsApi.niyayeshEditor(
      'branch',
      'hotels',
      undefined,
      undefined,
      'academy',
    );
    await integrationsApi.niyayeshSave(
      'branch',
      'hotels',
      {},
      'command',
      undefined,
      'academy',
    );
    await integrationsApi.niyayeshTemplate('branch', 'hotels', 'academy');
    await integrationsApi.niyayeshHotelExport('branch', 'city', 'academy');
    await integrationsApi.niyayeshResources(
      'branch',
      'hotels',
      0,
      undefined,
      undefined,
      undefined,
      'academy',
    );
    await integrationsApi.ssoAccess('branch', undefined, 'academy');
    for (const call of calls.slice(1)) {
      const query = new URL(call.url).searchParams;
      expect(query.get('branchId')).toBe('branch');
      expect(query.getAll('systemId')).toEqual(['academy']);
    }
  });
});
