import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { AuthenticatedActor } from '@nora/contracts';
import { GhestirooStore, type GhestirooConfig } from './ghestiroo.store';
import { GhestirooService } from './ghestiroo.service';
import { ghestirooOrigin, ghestirooRequest } from './ghestiroo.client';
import * as client from './ghestiroo.client';

const branch = randomUUID();
const actor: AuthenticatedActor = {
  userId: randomUUID(),
  sessionId: randomUUID(),
  branchIds: [branch],
  permissions: ['ui.administrator', 'system.settings.manage'],
};
const bundle = {
  contract: 'ghestiroo.nora.v1' as const,
  origin: 'https://ghestiroo.example',
  noraOrigin: 'https://nora.example',
  connectionId: 'b'.repeat(32),
  apiKey: 's'.repeat(64),
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  scopes: ['catalog', 'admin'],
};
const config: GhestirooConfig = {
  ...bundle,
  allowedUserIds: [actor.userId],
  version: 0,
};
let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'nora-ghestiroo-test-'));
  vi.stubEnv('NORA_GHESTIROO_CONFIG_DIR', directory);
  vi.stubEnv('NORA_GHESTIROO_STORAGE_KEY', randomBytes(32).toString('base64'));
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});

describe('Encrypted connection storage', () => {
  it('never persists plaintext, retains CAS and binds ciphertext to branch', async () => {
    const store = new GhestirooStore();
    await store.write(branch, config, 0);
    expect((await store.read(branch))?.apiKey).toBe(config.apiKey);
    expect(
      await readFile(join(directory, `${branch}.json`), 'utf8'),
    ).not.toContain(config.apiKey);
    await expect(store.write(branch, config, 0)).rejects.toMatchObject({
      status: 409,
    });
    const other = randomUUID();
    await copyFile(
      join(directory, `${branch}.json`),
      join(directory, `${other}.json`),
    );
    await expect(store.read(other)).rejects.toMatchObject({ status: 503 });
    vi.stubEnv(
      'NORA_GHESTIROO_STORAGE_KEY',
      randomBytes(32).toString('base64'),
    );
    await expect(store.read(branch)).rejects.toMatchObject({ status: 503 });
  });
  it('allows only one concurrent writer for a version', async () => {
    const store = new GhestirooStore();
    const results = await Promise.allSettled([
      store.write(branch, config, 0),
      store.write(branch, config, 0),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await store.read(branch))?.version).toBe(1);
  });
});

describe('Nora module boundary', () => {
  function service(manage = true) {
    const registry = {
      read: vi.fn(async (a: AuthenticatedActor, b: string) => {
        if (!a.branchIds.includes(b))
          throw Object.assign(Error(), { status: 403 });
      }),
      canManage: vi.fn(() => manage),
    };
    return { registry, service: new GhestirooService(registry as never) };
  }
  it('saves a scoped bundle without returning its key and rejects extra fields', async () => {
    const { service: api } = service();
    const result = await api.save(
      actor,
      branch,
      {
        bundle: JSON.stringify(bundle),
        allowedUserIds: [actor.userId],
        expectedVersion: 0,
      },
      bundle.noraOrigin,
    );
    expect(result.configured).toBe(true);
    expect(JSON.stringify(result)).not.toContain(bundle.apiKey);
    await expect(
      api.save(
        actor,
        branch,
        {
          bundle: JSON.stringify({ ...bundle, secret: 'bad' }),
          allowedUserIds: [actor.userId],
          expectedVersion: 1,
        },
        bundle.noraOrigin,
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(api.status(actor, randomUUID())).rejects.toMatchObject({
      status: 403,
    });
  });
  it('enforces allowed users, scopes, connection settings permission and key expiry before networking', async () => {
    const { service: api } = service();
    await api.store.write(branch, config, 0);
    const read = vi.spyOn(client, 'ghestirooRequest').mockResolvedValue({
      contract: bundle.contract,
      connectionId: bundle.connectionId,
    });
    await expect(
      api.run({ ...actor, userId: randomUUID() }, branch, 'catalog'),
    ).rejects.toMatchObject({ status: 403 });
    await expect(api.run(actor, branch, 'customers')).rejects.toMatchObject({
      status: 403,
    });
    const readonly = service(false).service;
    await expect(
      readonly.run(actor, branch, 'admin-grants'),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      readonly.save(actor, branch, {}, bundle.noraOrigin),
    ).rejects.toMatchObject({
      status: 403,
    });
    expect(read).not.toHaveBeenCalled();
    await api.run(actor, branch, 'capabilities');
    await api.store.write(
      branch,
      { ...config, expiresAt: '2000-01-01T00:00:00Z' },
      1,
    );
    await expect(api.run(actor, branch, 'catalog')).rejects.toMatchObject({
      status: 503,
    });
    expect(read).toHaveBeenCalledTimes(1);
  });
});

describe('Bounded server transport', () => {
  it('rejects credentials in URLs, HTTP production targets, paths, private DNS and invalid cursors', async () => {
    for (const origin of [
      'http://ghestiroo.example',
      'https://user:secret@ghestiroo.example',
      'https://ghestiroo.example/path',
      'https://ghestiroo.example?key=x',
    ])
      expect(() => ghestirooOrigin(origin)).toThrow();
    await expect(
      ghestirooRequest(
        { ...config, origin: 'https://127.0.0.1' },
        'capabilities',
      ),
    ).rejects.toThrow('UNSAFE_DESTINATION');
    await expect(ghestirooRequest(config, 'admin')).rejects.toThrow(
      'INVALID_OPERATION',
    );
    await expect(ghestirooRequest(config, 'catalog', '../')).rejects.toThrow(
      'INVALID_OPERATION',
    );
  });
  it('sends keys only as headers, refuses redirects and validates the contract', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('NORA_GHESTIROO_ALLOW_LOCAL', 'true');
    let mode = 'ok';
    const server = createServer((request, response) => {
      expect(request.headers.authorization).toBe(`Bearer ${config.apiKey}`);
      expect(request.url).not.toContain(config.apiKey);
      if (mode === 'redirect') {
        response.writeHead(302, { location: 'http://127.0.0.1:1' }).end();
        return;
      }
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          contract: mode === 'bad' ? 'wrong' : config.contract,
        }),
      );
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    const local = {
      ...config,
      origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    };
    try {
      expect(await ghestirooRequest(local, 'capabilities')).toMatchObject({
        contract: config.contract,
      });
      mode = 'redirect';
      await expect(ghestirooRequest(local, 'capabilities')).rejects.toThrow(
        'UPSTREAM_302',
      );
      mode = 'bad';
      await expect(ghestirooRequest(local, 'capabilities')).rejects.toThrow(
        'INVALID_CONTRACT',
      );
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
