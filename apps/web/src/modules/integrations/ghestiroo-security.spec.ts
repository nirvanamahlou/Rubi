import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import config from '../../../next.config';

const { pathToRegexp } = createRequire(import.meta.url)(
  'next/dist/compiled/path-to-regexp',
) as { pathToRegexp: (path: string) => RegExp };
describe('Integration-only browser policy exception', () => {
  it('preserves all other CRM policies and lets only the launch route supply dynamic CSP', async () => {
    const rules = await config.headers!();
    function headers(path: string) {
      return Object.fromEntries(
        rules
          .filter((r) => pathToRegexp(r.source).test(path))
          .flatMap((r) => r.headers.map((h) => [h.key, h.value])),
      );
    }
    for (const path of [
      '/',
      '/sales',
      '/customers',
      '/finance',
      '/integrations',
      '/integrations/other',
    ]) {
      expect(headers(path)['Content-Security-Policy']).toBe(
        "object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
      );
      expect(headers(path)['Referrer-Policy']).toBe('no-referrer');
    }
    const launch = headers('/integrations/ghestiroo-launch');
    expect(launch['Content-Security-Policy']).toBeUndefined();
    expect(launch['Referrer-Policy']).toBeUndefined();
    expect(launch['X-Frame-Options']).toBe('DENY');
    expect(headers('/procurement-optimized.html')['X-Frame-Options']).toBe(
      'SAMEORIGIN',
    );
  });
});
