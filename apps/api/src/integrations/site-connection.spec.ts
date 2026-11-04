import { mkdtemp, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import type {
  AuthenticatedActor,
  SiteConnectionInputV1,
} from '@nora/contracts';
import { SiteConnectionService } from './site-connection.service';
import { siteConnectionInput } from './site-connection.validation';
import { NiyayeshService } from './niyayesh.service';
import { NiyayeshSsoService } from './niyayesh-sso.service';
import type { IntegrationRegistryService } from './integration-registry.service';
import type { IamService } from '../iam/iam.service';

const branch = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const otherBranch = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const actor: AuthenticatedActor = {
  userId: 'user',
  sessionId: 'session',
  branchIds: [branch],
  permissions: ['ui.administrator'],
};
const input: SiteConnectionInputV1 = {
  expectedVersion: 0,
  origin: 'https://site.example',
  client: 'nora',
  system: 'website',
  organization: 'org',
  environment: 'production',
  keyId: 'key-1',
  secret: 'synthetic-secret-only-'.repeat(3),
};
const ids = ['bastan', 'niyayesh', 'academy'];
let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'nora-sites-'));
  vi.stubEnv('NORA_SITE_CONNECTIONS_CONFIG_DIR', dir);
  vi.stubEnv(
    'NORA_SITE_CONNECTIONS_STORAGE_KEY',
    Buffer.alloc(32, 5).toString('base64'),
  );
  vi.stubEnv('NIYAYESH_CONNECTION_FILE', '');
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});
function fixture() {
  const registry = {
    read: vi.fn(async () => ({
      systems: ids.map((id) => ({
        id,
        code: id,
        brandId: id,
        lifecycle: 'ENABLED',
      })),
      brands: ids.map((id) => ({ id, code: id, lifecycle: 'ENABLED' })),
    })),
    canManage: vi.fn(() => true),
  };
  const site = new NiyayeshService();
  return {
    registry,
    site,
    service: new SiteConnectionService(
      registry as unknown as IntegrationRegistryService,
      site,
    ),
  };
}
describe('Site API setup security and routing', () => {
  it.each(ids)(
    'saves %s as encrypted, write-only, site-scoped configuration',
    async (id) => {
      const { service } = fixture();
      const result = await service.save(actor, branch, id, input);
      expect(result).toMatchObject({
        systemId: id,
        configured: true,
        version: 1,
        source: 'PANEL',
        secretConfigured: true,
      });
      expect(JSON.stringify(result)).not.toContain(input.secret);
      expect(result).not.toHaveProperty('secret');
      const raw = await readFile(join(dir, (await readdir(dir))[0]!), 'utf8');
      expect(raw).not.toContain(input.secret);
      expect(raw).not.toContain(input.origin);
      expect(await service.store.read(branch, id)).toMatchObject({
        secret: input.secret,
        registrySystemId: id,
        version: 1,
      });
      expect(
        await service.store.read(
          branch,
          ids.find((other) => other !== id)!,
        ),
      ).toBeNull();
      expect(await service.store.read(otherBranch, id)).toBeNull();
    },
  );
  it('authorizes branch, management and known active site before touching credentials', async () => {
    const { registry, service } = fixture();
    const read = vi.spyOn(service.store, 'read');
    const write = vi.spyOn(service.store, 'write');
    registry.canManage.mockReturnValue(false);
    await expect(service.save(actor, branch, 'bastan', input)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(
      service.save(actor, branch, 'unknown', input),
    ).rejects.toThrow();
    registry.read.mockRejectedValueOnce(new ForbiddenException());
    await expect(service.status(actor, otherBranch, 'bastan')).rejects.toThrow(
      ForbiddenException,
    );
    expect(read).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });
  it('retains blank secret only for the same identity and rejects stale writers', async () => {
    const { service } = fixture();
    await service.save(actor, branch, 'bastan', input);
    for (const change of [
      { origin: 'https://other.example' },
      { keyId: 'new' },
    ])
      await expect(
        service.save(actor, branch, 'bastan', {
          ...input,
          ...change,
          expectedVersion: 1,
          secret: '',
        }),
      ).rejects.toThrow('کلید');
    expect(
      (
        await service.save(actor, branch, 'bastan', {
          ...input,
          expectedVersion: 1,
          secret: '',
        })
      ).version,
    ).toBe(2);
    expect((await service.store.read(branch, 'bastan'))?.secret).toBe(
      input.secret,
    );
    await expect(
      service.save(actor, branch, 'bastan', { ...input, expectedVersion: 1 }),
    ).rejects.toThrow('تغییر');
  });
  it('publishes one complete version under concurrency and rejects encrypted-file tampering', async () => {
    const { service } = fixture();
    await service.save(actor, branch, 'bastan', input);
    const saved = (await service.store.read(branch, 'bastan'))!;
    const writes = await Promise.allSettled([
      service.store.write(branch, 'bastan', saved, 1),
      service.store.write(branch, 'bastan', saved, 1),
    ]);
    expect(writes.filter((row) => row.status === 'fulfilled')).toHaveLength(1);
    const file = (await readdir(dir)).find((name) =>
      name.endsWith('.v2.json'),
    )!;
    const envelope = JSON.parse(await readFile(join(dir, file), 'utf8')) as {
      data: string;
    };
    envelope.data = Buffer.alloc(
      Buffer.from(envelope.data, 'base64').length,
      0,
    ).toString('base64');
    await writeFile(join(dir, file), JSON.stringify(envelope));
    await expect(service.store.read(branch, 'bastan')).rejects.toThrow('رمز');
  });
  it.each([
    'http://site.example',
    'https://127.0.0.1',
    'https://site.local',
    'https://user:secret@site.example',
    'https://site.example/path',
    'https://site.example?token=secret',
  ])('rejects unsafe configuration %s', (origin) => {
    expect(() => siteConnectionInput({ ...input, origin })).toThrow();
  });
  it('uses persistent fallback without reading or replacing Ghestiroo files', async () => {
    vi.stubEnv('NORA_SITE_CONNECTIONS_CONFIG_DIR', '');
    vi.stubEnv('NORA_SITE_CONNECTIONS_STORAGE_KEY', undefined);
    vi.stubEnv('NORA_GHESTIROO_CONFIG_DIR', dir);
    vi.stubEnv(
      'NORA_GHESTIROO_STORAGE_KEY',
      Buffer.alloc(32, 2).toString('base64'),
    );
    const { service } = fixture();
    await service.save(actor, branch, 'bastan', input);
    expect(await readdir(dir)).toEqual(['sites']);
  });
  it('routes native operations to each selected source with the signed current actor', async () => {
    const { service, site } = fixture();
    for (const id of ids)
      await service.save(actor, branch, id, {
        ...input,
        origin: `https://${id}.example`,
        system: id,
      });
    const read = vi.spyOn(site, 'read').mockResolvedValue({
      grants: ['countries.read'],
      metrics: [],
      imports: [],
    });
    for (const id of ids) {
      expect(await site.status(actor, branch, id)).toMatchObject({
        state: 'CONNECTED',
        registrySystemId: id,
      });
      await site.resources(
        actor,
        branch,
        'countries',
        '0',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        id,
      );
      await site.dashboard(actor, branch, id);
      await site.editor(actor, branch, 'hotels', undefined, id);
      await site.hotelExport(actor, branch, 'city', id);
      await site.workbook(
        actor,
        branch,
        'hotels',
        undefined,
        false,
        undefined,
        undefined,
        undefined,
        id,
      );
      const calls = read.mock.calls.splice(0);
      expect(calls).toHaveLength(6);
      for (const call of calls) {
        expect(call[0].system).toBe(id);
        expect(call[0].origin).toBe(`https://${id}.example`);
        expect(call[1]).toBe(actor.userId);
      }
    }
    await expect(
      site.resources(
        actor,
        branch,
        'countries',
        '0',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'missing',
      ),
    ).rejects.toThrow();
    expect(read).not.toHaveBeenCalled();
  });
  it('never offers primary SSO for another website', async () => {
    const site = new NiyayeshService();
    vi.spyOn(site, 'configuration').mockResolvedValue({
      registrySystemId: 'niyayesh',
    } as never);
    const sso = new NiyayeshSsoService({} as IamService, site);
    const claims = vi.spyOn(sso, 'claims');
    expect(await sso.access(actor, branch, 'bastan')).toEqual({
      enabled: false,
    });
    expect(claims).not.toHaveBeenCalled();
  });
});
