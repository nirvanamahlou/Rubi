import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import type { IntegrationRegistryService } from './integration-registry.service';
import { SiteConnectionService } from './site-connection.service';
import { NiyayeshService } from './niyayesh.service';
import { jahanRequest } from './jahan-bastan.client';
import { JahanRenewal } from './jahan-bastan.renewal';

let directory: string | undefined;
afterEach(async () => {
  vi.unstubAllEnvs();
  if (directory) await rm(directory, { recursive: true, force: true });
});

/** Run against tests/nora_contract_server.py from the producer checkout, never production. */
describe.skipIf(process.env.NORA_JAHAN_SYNTHETIC_CONTRACT !== '1')(
  'Real Jahan Bastan / Nora HTTP contract',
  () => {
    it('imports and encrypts a real bundle, tests identity, uses native commands, rotates and revokes', async () => {
      directory = await mkdtemp(join(tmpdir(), 'nora-jahan-contract-'));
      vi.stubEnv('NORA_SITE_CONNECTIONS_CONFIG_DIR', directory);
      vi.stubEnv(
        'NORA_SITE_CONNECTIONS_STORAGE_KEY',
        Buffer.alloc(32, 37).toString('base64'),
      );
      vi.stubEnv('NIYAYESH_CONNECTION_FILE', '');
      const branch = '22222222-2222-4222-a222-222222222222';
      const actor: AuthenticatedActor = {
        userId: '11111111-1111-4111-a111-111111111111',
        sessionId: 'synthetic-session',
        branchIds: [branch],
        permissions: ['ui.administrator'],
      };
      const registry = {
        read: async (_actor: AuthenticatedActor, requestedBranch: string) => {
          if (requestedBranch !== branch) throw Error('FORBIDDEN_BRANCH');
          return {
            systems: [
              {
                id: 'bastan',
                code: 'jahan-bastan-primary',
                brandId: 'bastan',
                lifecycle: 'ENABLED',
              },
              {
                id: 'niyayesh',
                code: 'niyayesh-primary',
                brandId: 'niyayesh',
                lifecycle: 'ENABLED',
              },
            ],
            brands: [
              { id: 'bastan', code: 'jahan-bastan', lifecycle: 'ENABLED' },
              { id: 'niyayesh', code: 'niyayesh', lifecycle: 'ENABLED' },
            ],
          };
        },
        canManage: () => true,
      } as unknown as IntegrationRegistryService;
      const native = new NiyayeshService();
      const service = new SiteConnectionService(registry, native);
      const bundle = (await (
        await fetch('http://127.0.0.1:18049/__synthetic__/bundle')
      ).json()) as Record<string, unknown>;
      const input = { bundle: JSON.stringify(bundle), expectedVersion: 0 };
      await expect(
        service.saveBundle(
          actor,
          branch,
          'niyayesh',
          input,
          'https://avinaofficial.ir',
        ),
      ).rejects.toThrow();
      const saved = await service.saveBundle(
        actor,
        branch,
        'bastan',
        input,
        'https://avinaofficial.ir',
      );
      expect(saved).toMatchObject({
        protocol: 'jahan-bastan.nora.v1',
        version: 1,
        lifecycle: 'ACTIVE',
      });
      expect(JSON.stringify(saved)).not.toContain(bundle.apiKey);
      for (const file of (await readdir(directory)).filter((name) =>
        name.endsWith('.json'),
      )) {
        const encrypted = await readFile(join(directory, file), 'utf8');
        expect(encrypted).not.toContain(bundle.apiKey);
        expect(encrypted).not.toContain(bundle.signingKey);
      }
      expect(await service.test(actor, branch, 'bastan')).toMatchObject({
        state: 'CONNECTED',
        registrySystemId: 'bastan',
      });
      const presence = (await native.presence(actor, branch, 'bastan')) as {
        state: string;
        groups: { id: string }[];
        nodes: { id: string; group: string }[];
      };
      expect(presence.state).toBe('ACTIVE');
      expect(presence.groups.length).toBeGreaterThan(0);
      expect(
        presence.nodes.every((node) =>
          node.id === 'home'
            ? node.group === 'home'
            : presence.groups.some((group) => group.id === node.group),
        ),
      ).toBe(true);
      expect(await native.status(actor, branch, 'niyayesh')).toMatchObject({
        state: 'NOT_CONFIGURED',
      });
      await expect(
        native.resources(
          actor,
          randomUUID(),
          'countries',
          '0',
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          'bastan',
        ),
      ).rejects.toThrow();
      const command = randomUUID();
      const value = {
        name: 'Synthetic HTTP country',
        slug: `synthetic-${randomUUID().slice(0, 8)}`,
      };
      const [first, repeated] = await Promise.all([
        native.saveCatalogue(
          actor,
          branch,
          'countries',
          { command, value },
          'bastan',
        ),
        native.saveCatalogue(
          actor,
          branch,
          'countries',
          { command, value },
          'bastan',
        ),
      ]);
      expect(first).toEqual(repeated);
      expect(
        await native.resources(
          actor,
          branch,
          'countries',
          '0',
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          'bastan',
          'Synthetic HTTP',
          'draft',
        ),
      ).toMatchObject({
        items: [expect.objectContaining({ externalId: String(first.id) })],
      });
      await expect(
        native.saveCatalogue(
          actor,
          branch,
          'countries',
          { command, value: { ...value, name: 'Different content' } },
          'bastan',
        ),
      ).rejects.toThrow();
      let config = (await service.store.read(branch, 'bastan'))!;
      const previousKey = config.secret;
      await expect(
        jahanRequest(
          config,
          actor.userId,
          '/api/v1/integration/business/payments',
          { method: 'POST', body: '{}' },
        ),
      ).rejects.toThrow('INVALID_PATH');
      await service.store.write(
        branch,
        'bastan',
        {
          ...config,
          jahan: {
            ...config.jahan!,
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
          },
        },
        config.version,
      );
      await Promise.all([
        new JahanRenewal(service.store).ensure(branch, 'bastan'),
        new JahanRenewal(service.store).ensure(branch, 'bastan'),
      ]);
      config = (await service.store.read(branch, 'bastan'))!;
      expect(config.secret).not.toBe(previousKey);
      expect(config.jahan?.pendingRenewal).toBeUndefined();
      await expect(
        jahanRequest(
          { ...config, secret: previousKey },
          actor.userId,
          '/api/v1/integration/capabilities',
        ),
      ).rejects.toThrow('UPSTREAM_401');
      // A new consumer instance after restart reads the same encrypted, rotated credential.
      expect(
        await new SiteConnectionService(registry, new NiyayeshService()).test(
          actor,
          branch,
          'bastan',
        ),
      ).toMatchObject({ state: 'CONNECTED' });
      const lostCandidate = 'L'.repeat(64);
      await service.store.write(
        branch,
        'bastan',
        {
          ...config,
          jahan: { ...config.jahan!, pendingRenewal: lostCandidate },
        },
        config.version,
      );
      const upstreamCommit = await jahanRequest(
        config,
        actor.userId,
        '/api/v1/integration/renew',
        { method: 'POST', body: JSON.stringify({ nextApiKey: lostCandidate }) },
      );
      // Deliberately discard this reply before local acknowledgment, then restart.
      config = (await new JahanRenewal(service.store).ensure(
        branch,
        'bastan',
      ))!;
      expect(config.secret).toBe(lostCandidate);
      expect(config.jahan?.expiresAt).toBe(upstreamCommit.expiresAt);
      expect(config.jahan?.pendingRenewal).toBeUndefined();
      const sourceOrigin = config.origin;
      await service.store.write(
        branch,
        'bastan',
        { ...config, origin: 'http://127.0.0.1:1' },
        config.version,
      );
      config = (await service.store.read(branch, 'bastan'))!;
      const stopped = await service.lifecycle(actor, branch, 'bastan', {
        action: 'disconnect',
        operationId: randomUUID(),
        expectedVersion: config.version,
      });
      expect(stopped).toMatchObject({
        lifecycle: 'DISCONNECTED',
        remoteControlPending: true,
      });
      await expect(service.test(actor, branch, 'bastan')).rejects.toThrow();
      expect(await native.status(actor, branch, 'bastan')).toMatchObject({
        state: 'NOT_CONFIGURED',
      });
      // Offline revocation was persisted before I/O. A new process retries it.
      config = (await service.store.read(branch, 'bastan'))!;
      expect(config.jahan?.lifecyclePending?.action).toBe('disconnect');
      await service.store.write(
        branch,
        'bastan',
        { ...config, origin: sourceOrigin },
        config.version,
      );
      await new JahanRenewal(service.store).sweep();
      expect(
        (await service.store.read(branch, 'bastan'))?.jahan?.lifecyclePending,
      ).toBeUndefined();
      expect(await service.status(actor, branch, 'bastan')).toMatchObject({
        lifecycle: 'DISCONNECTED',
        remoteControlPending: false,
      });
    }, 60000);
  },
);
