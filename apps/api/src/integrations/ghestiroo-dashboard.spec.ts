import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import { GhestirooService } from './ghestiroo.service';
import { GhestirooController } from './ghestiroo.controller';
import * as transport from './ghestiroo.client';
const branch = randomUUID(),
  site = randomUUID();
const actor: AuthenticatedActor = {
  userId: randomUUID(),
  sessionId: randomUUID(),
  branchIds: [branch],
  permissions: ['ui.administrator'],
};
const body = { from: '2026-11-02', to: '2026-11-02' };
let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'ghestiroo-dashboard-'));
  vi.stubEnv('NORA_GHESTIROO_CONFIG_DIR', directory);
  vi.stubEnv('NORA_GHESTIROO_STORAGE_KEY', randomBytes(32).toString('base64'));
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});
function service() {
  const registry = {
    read: vi.fn(async (a: AuthenticatedActor, b: string) => {
      if (!a.branchIds.includes(b)) throw new ForbiddenException();
      return {
        systems: [{ id: site, code: 'ghesti-roo-primary', brandId: 'brand' }],
        brands: [{ id: 'brand', code: 'ghesti-roo' }],
      };
    }),
    canManage: () => true,
  };
  return new GhestirooService(registry as never);
}
describe('Ghestiroo dashboard boundary', () => {
  it('takes the human display name from IAM rather than caller headers', async () => {
    const dashboard = vi.fn(async () => ({}));
    const iam = {
      describeMessagingParticipants: vi.fn(async () => [
        { displayName: 'Nora person' },
      ]),
    };
    const controller = new GhestirooController(
      { dashboard } as never,
      iam as never,
    );
    await controller.dashboard(
      { actor, headers: { 'x-nora-name': 'forged' } } as never,
      branch,
      site,
      body,
    );
    expect(iam.describeMessagingParticipants).toHaveBeenCalledWith([
      actor.userId,
    ]);
    expect(dashboard).toHaveBeenCalledWith(
      actor,
      branch,
      site,
      body,
      'Nora person',
    );
  });
  it('rejects another site, branch and malformed fields before transport', async () => {
    const api = service(),
      run = vi.spyOn(api, 'run');
    await expect(
      api.dashboard(actor, branch, 'another-site', body),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      api.dashboard(actor, randomUUID(), site, body),
    ).rejects.toMatchObject({ status: 403 });
    for (const invalid of [
      null,
      [],
      { ...body, url: 'https://another.example' },
      { ...body, metric: 'secret' },
      { ...body, metric: 'users', queue: 'payments' },
      { ...body, after: '../' },
    ]) {
      await expect(
        api.dashboard(actor, branch, site, invalid),
      ).rejects.toMatchObject({ status: 400 });
    }
    expect(run).not.toHaveBeenCalled();
  });
  it('uses the encrypted Ghestiroo connection and authenticated person, never Niyayesh credentials', async () => {
    const api = service();
    const config = {
      contract: 'ghestiroo.nora.v1' as const,
      origin: 'https://ghestiroo.example',
      noraOrigin: 'https://nora.example',
      connectionId: 'b'.repeat(32),
      apiKey: 's'.repeat(64),
      scopes: ['catalog', 'cases', 'customers'],
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      version: 0,
      allowedUserIds: [],
    };
    await api.store.write(branch, config, 0);
    vi.spyOn(api.renewal, 'ensure').mockResolvedValue(config);
    const request = vi.spyOn(transport, 'ghestirooRequest').mockResolvedValue({
      contract: config.contract,
      schemaVersion: 1,
      ...body,
      metrics: { orders: { value: 0, state: 'AVAILABLE' } },
      visits: { pageViews: 0 },
      activity: [],
    });
    const result = await api.dashboard(actor, branch, site, body);
    expect(result.registrySystemId).toBe(site);
    expect(request.mock.calls[0]?.[1]).toBe('dashboard');
    expect(request.mock.calls[0]?.[4]).toMatchObject({
      actor: { subject: actor.userId, branch },
      payload: body,
    });
    expect(JSON.stringify(result)).not.toContain(config.apiKey);
    await expect(
      api.dashboard({ ...actor, permissions: [] }, branch, site, body),
    ).rejects.toMatchObject({ status: 403 });
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('rejects mismatched periods and drilldown metrics; pins registry identity locally', async () => {
    const api = service(),
      run = vi.spyOn(api, 'run');
    run.mockResolvedValue({
      schemaVersion: 1,
      from: '2026-11-01',
      to: body.to,
      metrics: {},
      visits: {},
      activity: [],
    });
    await expect(
      api.dashboard(actor, branch, site, body),
    ).rejects.toMatchObject({ status: 503 });
    run.mockResolvedValue({
      schemaVersion: 1,
      ...body,
      metric: 'orders',
      items: [],
    });
    await expect(
      api.dashboard(actor, branch, site, { ...body, metric: 'users' }),
    ).rejects.toMatchObject({ status: 503 });
    run.mockResolvedValue({
      schemaVersion: 1,
      ...body,
      metric: 'users',
      items: [],
      registrySystemId: 'forged-site',
    });
    expect(
      (await api.dashboard(actor, branch, site, { ...body, metric: 'users' }))
        .registrySystemId,
    ).toBe(site);
  });
});
