import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import type { IntegrationRegistryService } from './integration-registry.service';
import { JahanConnectionService } from './jahan-bastan.service';
import { jahanRequest } from './jahan-bastan.client';
import { SiteConnectionStore } from './site-connection.store';

let directory: string | undefined;
afterEach(async () => {
  vi.unstubAllEnvs();
  if (directory) await rm(directory, { recursive: true, force: true });
});
const branch = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const actor: AuthenticatedActor = {
  userId: '11111111-1111-4111-a111-111111111111',
  sessionId: 'synthetic',
  branchIds: [branch],
  permissions: ['ui.administrator'],
};
const bundle = {
  contract: 'jahan-bastan.nora.v1',
  siteId: 'jahan-bastan',
  organizationId: branch,
  environment: 'production',
  connectionId: 'a'.repeat(32),
  noraOrigin: 'https://nora.example',
  resources: ['countries'],
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  version: 1,
  state: 'ACTIVE',
  origin: 'https://site.example',
  apiBase: '/api/v1/integration/nora/v1',
  apiKey: 'A'.repeat(64),
  signingKey: 'B'.repeat(64),
};
function service() {
  const registry = {
    read: async () => ({
      systems: [{ id: 'bastan', brandId: 'bastan', lifecycle: 'ENABLED' }],
      brands: [{ id: 'bastan', code: 'jahan-bastan', lifecycle: 'ENABLED' }],
    }),
    canManage: () => true,
  };
  return new JahanConnectionService(
    registry as unknown as IntegrationRegistryService,
  );
}
describe('Dedicated Jahan contract security', () => {
  it.each([
    { siteId: 'niyayesh' },
    { contract: 'ghestiroo.nora.v1' },
    { noraOrigin: 'https://hostile.example' },
    { origin: 'https://127.0.0.1' },
    { origin: 'http://site.example' },
    { origin: 'https://site.example/path' },
    { expiresAt: 'invalid' },
    { expiresAt: new Date(0).toISOString() },
    { resources: ['payments'] },
    { state: 'DISCONNECTED' },
    { apiKey: 'short' },
    { signingKey: 'short' },
    { actorId: 'browser-spoof' },
  ])('rejects unsupported bundle context %j', async (change) => {
    await expect(
      service().save(
        actor,
        branch,
        'bastan',
        {
          bundle: JSON.stringify({ ...bundle, ...change }),
          expectedVersion: 0,
        },
        'https://nora.example',
      ),
    ).rejects.toThrow();
  });
  it('uses the existing encrypted CAS storage and keeps another site/branch isolated', async () => {
    directory = await mkdtemp(join(tmpdir(), 'nora-jahan-unit-'));
    vi.stubEnv('NORA_SITE_CONNECTIONS_CONFIG_DIR', directory);
    vi.stubEnv(
      'NORA_SITE_CONNECTIONS_STORAGE_KEY',
      Buffer.alloc(32, 9).toString('base64'),
    );
    const current = service();
    await current.save(
      actor,
      branch,
      'bastan',
      { bundle: JSON.stringify(bundle), expectedVersion: 0 },
      'https://nora.example',
    );
    await expect(
      current.save(
        actor,
        branch,
        'bastan',
        { bundle: JSON.stringify(bundle), expectedVersion: 0 },
        'https://nora.example',
      ),
    ).rejects.toThrow();
    expect(await current.store.read(branch, 'other-site')).toBeNull();
    const otherBranch = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
    await expect(
      current.save(
        { ...actor, branchIds: [branch, otherBranch] },
        otherBranch,
        'bastan',
        { bundle: JSON.stringify(bundle), expectedVersion: 0 },
        'https://nora.example',
      ),
    ).rejects.toThrow('برای هر شعبه');
    expect(
      await new SiteConnectionStore().read(
        'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
        'bastan',
      ),
    ).toBeNull();
    const saved = (await current.store.read(branch, 'bastan'))!;
    await expect(
      jahanRequest(saved, actor.userId, '/api/v1/integration/business/orders', {
        method: 'POST',
      }),
    ).rejects.toThrow('INVALID_PATH');
    await expect(
      jahanRequest(
        { ...saved, origin: 'https://127.0.0.1' },
        actor.userId,
        '/api/v1/integration/capabilities',
      ),
    ).rejects.toThrow('UNSAFE_DESTINATION');
    vi.stubEnv('NODE_ENV', 'production');
    await expect(
      jahanRequest(
        { ...saved, local: true, origin: 'http://127.0.0.1:18049' },
        actor.userId,
        '/api/v1/integration/capabilities',
      ),
    ).rejects.toThrow('HTTPS_REQUIRED');
  });
  it('atomically selects one coordinator when different branches import the same credential concurrently', async () => {
    directory = await mkdtemp(join(tmpdir(), 'nora-jahan-claim-'));
    vi.stubEnv('NORA_SITE_CONNECTIONS_CONFIG_DIR', directory);
    vi.stubEnv(
      'NORA_SITE_CONNECTIONS_STORAGE_KEY',
      Buffer.alloc(32, 9).toString('base64'),
    );
    const store = new SiteConnectionStore();
    const results = await Promise.allSettled([
      store.claimJahanConnection(
        'synthetic-remote-connection',
        branch,
        'bastan',
      ),
      store.claimJahanConnection(
        'synthetic-remote-connection',
        'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
        'bastan',
      ),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
  });
});
