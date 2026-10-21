import { expect, it } from 'vitest';
import config from '../../../../next.config';
import { publicDocumentContentSecurityPolicy } from './public-document-headers';
it('overrides the global application CSP only at the public document boundary', async () => {
  const rules = await config.headers!();
  const globalIndex = rules.findIndex((rule) => rule.source === '/:path*');
  const publicIndex = rules.findIndex((rule) => rule.source === '/d/:token');
  expect(publicIndex).toBeGreaterThan(globalIndex);
  expect(rules[publicIndex]?.headers).toContainEqual({
    key: 'Content-Security-Policy',
    value: publicDocumentContentSecurityPolicy,
  });
  expect(publicDocumentContentSecurityPolicy).toContain("default-src 'none'");
  expect(publicDocumentContentSecurityPolicy).toContain("form-action 'none'");
  expect(rules[globalIndex]?.headers).toContainEqual({
    key: 'X-Frame-Options',
    value: 'DENY',
  });
  expect(
    rules.find((rule) => rule.source === '/package-generator/:path*')?.headers,
  ).toContainEqual({ key: 'X-Frame-Options', value: 'SAMEORIGIN' });
});
