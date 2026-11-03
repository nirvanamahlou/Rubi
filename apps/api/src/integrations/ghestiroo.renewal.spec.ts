import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GhestirooStore, type GhestirooConfig } from './ghestiroo.store';
import { GhestirooRenewal } from './ghestiroo.renewal';
import * as transport from './ghestiroo.client';

const branch = randomUUID();
const day = 86400000;
let directory: string;
let store: GhestirooStore;
let initial: GhestirooConfig;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'ghestiroo-rotation-'));
  vi.stubEnv('NORA_GHESTIROO_CONFIG_DIR', directory);
  vi.stubEnv('NORA_GHESTIROO_STORAGE_KEY', randomBytes(32).toString('base64'));
  store = new GhestirooStore();
  initial = {
    contract: 'ghestiroo.nora.v1',
    origin: 'https://ghestiroo.example',
    noraOrigin: 'https://nora.example',
    connectionId: 'b'.repeat(32),
    apiKey: 's'.repeat(64),
    scopes: ['catalog', 'admin'],
    allowedUserIds: [randomUUID()],
    version: 0,
    expiresAt: new Date(Date.now() + 90 * day).toISOString(),
  };
  await store.write(branch, initial, 0);
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});

function site() {
  let active = initial.apiKey;
  let expiry = initial.expiresAt;
  let rotations = 0;
  const call = vi
    .spyOn(transport, 'ghestirooRequest')
    .mockImplementation(async (config, operation, after, candidate) => {
      expect(operation).toBe('renew');
      expect(after).toBe('');
      if (config.apiKey !== active) throw Error('UPSTREAM_401');
      if (candidate !== active) {
        active = candidate!;
        expiry = new Date(Date.now() + 90 * day).toISOString();
        rotations++;
      }
      return {
        contract: initial.contract,
        renewal: 'rotate.v1',
        connectionId: initial.connectionId,
        noraOrigin: initial.noraOrigin,
        scopes: initial.scopes,
        expiresAt: expiry,
      };
    });
  return { call, rotations: () => rotations, key: () => active };
}

describe('Durable automatic credential renewal', () => {
  it('never sends a candidate before its encrypted journal is durable', async () => {
    const remote = site();
    vi.spyOn(store, 'write').mockRejectedValueOnce(Error('DISK_UNAVAILABLE'));
    await expect(new GhestirooRenewal(store).ensure(branch)).rejects.toThrow(
      'DISK_UNAVAILABLE',
    );
    expect(remote.call).not.toHaveBeenCalled();
  });
  it('enrolls existing bundles without reissue, then waits until the renewal window', async () => {
    const remote = site();
    const renewal = new GhestirooRenewal(store);
    const result = await renewal.ensure(branch);
    expect(result?.apiKey).toBe(remote.key());
    expect(result?.apiKey).not.toBe(initial.apiKey);
    expect(result?.allowedUserIds).toEqual(initial.allowedUserIds);
    expect(result?.pendingRenewal).toBeUndefined();
    await renewal.ensure(branch);
    expect(remote.rotations()).toBe(1);
    expect(remote.call).toHaveBeenCalledTimes(1);
    await store.write(
      branch,
      { ...result!, expiresAt: new Date(Date.now() + 13 * day).toISOString() },
      result!.version,
    );
    await renewal.ensure(branch);
    expect(remote.rotations()).toBe(2);
  });
  it('keeps the same encrypted candidate across a lost response and a restarted service', async () => {
    const remote = site();
    const implementation = remote.call.getMockImplementation()!;
    remote.call.mockImplementationOnce(async (...args) => {
      await implementation(...args);
      throw Error('CONNECTION_FAILED');
    });
    const failed = await new GhestirooRenewal(store).ensure(branch);
    expect(failed?.apiKey).toBe(initial.apiKey);
    expect(failed?.pendingRenewal?.apiKey).toBe(remote.key());
    const recovered = await new GhestirooRenewal(new GhestirooStore()).ensure(
      branch,
      true,
    );
    expect(recovered?.apiKey).toBe(remote.key());
    expect(recovered?.pendingRenewal).toBeUndefined();
    expect(remote.rotations()).toBe(1);
    for (const file of await readdir(directory))
      expect(await readFile(join(directory, file), 'utf8')).not.toContain(
        remote.key(),
      );
  });
  it('coalesces concurrent processes onto one durable candidate without leaving a lock', async () => {
    const remote = site();
    await Promise.all([
      new GhestirooRenewal(store).ensure(branch),
      new GhestirooRenewal(new GhestirooStore()).ensure(branch),
    ]);
    expect(remote.rotations()).toBe(1);
    expect((await store.read(branch))?.apiKey).toBe(remote.key());
    expect((await readdir(directory)).some((n) => n.endsWith('.lock'))).toBe(
      false,
    );
  });
  it('does not revive expired or revoked credentials, backs off failures and never replaces the pending candidate', async () => {
    const remote = vi
      .spyOn(transport, 'ghestirooRequest')
      .mockRejectedValue(Error('UPSTREAM_401'));
    const renewal = new GhestirooRenewal(store);
    const first = await renewal.ensure(branch);
    const count = remote.mock.calls.length;
    await renewal.ensure(branch);
    expect(remote).toHaveBeenCalledTimes(count);
    const second = await renewal.ensure(branch, true);
    expect(second?.pendingRenewal).toEqual(first?.pendingRenewal);
    await store.write(
      branch,
      { ...initial, expiresAt: '2000-01-01T00:00:00Z' },
      second!.version,
    );
    remote.mockClear();
    await renewal.ensure(branch);
    expect(remote).not.toHaveBeenCalled();
  });
  it('rejects response identity changes or expanded scopes without publishing a new active key', async () => {
    const remote = site();
    const implementation = remote.call.getMockImplementation()!;
    remote.call.mockImplementation(async (...args) => ({
      ...(await implementation(...args)),
      scopes: ['catalog', 'customers'],
    }));
    const result = await new GhestirooRenewal(store).ensure(branch);
    expect(result?.apiKey).toBe(initial.apiKey);
    expect(result?.pendingRenewal).toBeDefined();
  });
  it('ignores crash leftovers and preserves CAS with fully published version files', async () => {
    await writeFile(
      join(directory, branch + '.json.lock'),
      'stale legacy lock',
    );
    await writeFile(
      join(directory, branch + '.json.crashed.tmp'),
      'incomplete ciphertext',
    );
    const remote = site();
    const result = await new GhestirooRenewal(store).ensure(branch);
    expect(result?.apiKey).toBe(remote.key());
    expect(await store.branches()).toEqual([branch]);
    await expect(store.write(branch, initial, 1)).rejects.toMatchObject({
      status: 409,
    });
  });
  it('renews idle branches through the background sweep without any UI request', async () => {
    const remote = site();
    const renewal = new GhestirooRenewal(store);
    await renewal.sweep();
    expect(remote.rotations()).toBe(1);
    expect((await store.read(branch))?.lastRenewedAt).toBeDefined();
  });
});
