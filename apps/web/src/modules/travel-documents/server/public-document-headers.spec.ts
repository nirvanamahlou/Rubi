import { expect, it } from 'vitest';
import config from '../../../../next.config';
import { publicDocumentContentSecurityPolicy } from './public-document-headers';
import { spawnSync } from 'node:child_process';
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
it('loads the policy through the actual standalone production Next configuration loader', () => {
  const script = `require('next/dist/server/config').default('phase-production-server', process.cwd()).then(async config => {
    const rules = await config.headers();
    if (!rules.find(rule => rule.source === '/d/:token')?.headers.some(item => item.key === 'Content-Security-Policy' && item.value.includes("default-src 'none'"))) throw Error('Missing public policy');
    console.log('public-policy-ready');
  }).catch(error => {console.error(error.message);process.exitCode=1});`;
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: process.cwd(),
    encoding: 'utf8',
    windowsHide: true,
    timeout: 15000,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
  });
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).toContain('public-policy-ready');
});
