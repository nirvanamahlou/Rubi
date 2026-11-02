import { afterEach, describe, expect, it, vi } from 'vitest';
import { ghestirooRequest } from './ghestiroo.client';
import type { GhestirooConfig } from './ghestiroo.store';

// Opt-in only against tests/nora/server.py's disposable loopback fixture.
describe.skipIf(process.env.GHESTIROO_SYNTHETIC_CONTRACT !== '1')(
  'Real Python/Node connector contract',
  () => {
    afterEach(() => vi.unstubAllEnvs());
    it('authenticates, reads exact prices and creates a one-use grant across both codebases', async () => {
      vi.stubEnv('NODE_ENV', 'test');
      vi.stubEnv('NORA_GHESTIROO_ALLOW_LOCAL', 'true');
      const config: GhestirooConfig = {
        contract: 'ghestiroo.nora.v1',
        origin: 'http://127.0.0.1:18048',
        noraOrigin: 'http://127.0.0.1:18050',
        connectionId: 'b'.repeat(32),
        apiKey: 's'.repeat(64),
        scopes: ['catalog', 'admin'],
        allowedUserIds: [],
        version: 1,
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      };
      const capabilities = await ghestirooRequest(config, 'capabilities');
      expect(capabilities.connectionId).toBe(config.connectionId);
      const catalogue = await ghestirooRequest(config, 'catalog');
      expect(catalogue.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ price: '1200000', currency: 'IRT' }),
        ]),
      );
      const grant = await ghestirooRequest(config, 'admin-grants');
      const redeem = () =>
        fetch(`${config.origin}/admin/nora-sso`, {
          method: 'POST',
          headers: {
            origin: config.noraOrigin,
            'content-type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ token: String(grant.token) }),
          redirect: 'manual',
        });
      const first = await redeem();
      expect(first.status).toBe(200);
      expect(await first.text()).toContain('/admin/static/nora-sso.js');
      expect((await redeem()).headers.get('location')).toBe('/admin/login');
      const candidate = 'n'.repeat(64);
      const renewed = await ghestirooRequest(config, 'renew', '', candidate);
      expect(renewed).toMatchObject({
        renewal: 'rotate.v1',
        connectionId: config.connectionId,
        noraOrigin: config.noraOrigin,
      });
      await expect(ghestirooRequest(config, 'capabilities')).rejects.toThrow(
        'UPSTREAM_401',
      );
      const replacement = { ...config, apiKey: candidate };
      const acknowledged = await ghestirooRequest(
        replacement,
        'renew',
        '',
        candidate,
      );
      expect(Date.parse(String(acknowledged.expiresAt))).toBe(
        Date.parse(String(renewed.expiresAt)),
      );
      expect(
        (await ghestirooRequest(replacement, 'capabilities')).connectionId,
      ).toBe(config.connectionId);
    });
  },
);
