import { createHash, createHmac } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  destination,
  signingHeaders,
  type NiyayeshConnection,
} from './niyayesh.client';
import { NiyayeshService } from './niyayesh.service';

const config: NiyayeshConnection = {
  origin: 'http://127.0.0.1:18025',
  local: true,
  client: 'rubi',
  system: 'niyayesh-seir',
  organization: 'local-org',
  environment: 'development',
  keyId: 'local',
  secret: 'test-only-'.repeat(5),
  users: [
    {
      userId: 'user-a',
      branchId: 'branch-a',
      subject: 'person-a',
      resources: ['countries'],
    },
  ],
};
const actor = {
  userId: 'user-a',
  sessionId: 'session-a',
  branchIds: ['branch-a'],
  permissions: ['ui.administrator'],
};
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
describe('Niyayesh personal read connector', () => {
  it('signs the exact protocol, actor, scope, path and fresh nonce', () => {
    const path = '/api/v1/integration/resources/countries?after_id=0&limit=25';
    const h = signingHeaders(config, 'person-a', path);
    const canonical = [
      'erp.v1',
      'rubi',
      'niyayesh-seir',
      'local-org',
      'development',
      'local',
      'GET',
      path,
      h['X-ERP-Timestamp'],
      h['X-ERP-Nonce'],
      'person-a',
      '',
      '',
      '',
      createHash('sha256').update('').digest('hex'),
    ].join('\n');
    expect(h['X-ERP-Signature']).toBe(
      createHmac('sha256', config.secret).update(canonical).digest('hex'),
    );
    expect(signingHeaders(config, 'person-a', path)['X-ERP-Nonce']).not.toBe(
      h['X-ERP-Nonce'],
    );
  });
  it('blocks local HTTP in production, URL secrets and arbitrary destinations', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    await expect(destination(config)).rejects.toThrow('HTTPS_REQUIRED');
    await expect(
      destination({ ...config, origin: 'https://user:pass@example.com' }),
    ).rejects.toThrow('INVALID_ORIGIN');
    await expect(
      destination({ ...config, local: false, origin: 'https://127.0.0.1' }),
    ).rejects.toThrow('UNSAFE_DESTINATION');
  });
  it('checks branch, personal binding and resource before sending requests', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'nora-niyayesh-'));
    const path = join(dir, 'connection.json');
    await writeFile(path, JSON.stringify(config));
    vi.stubEnv('NIYAYESH_CONNECTION_FILE', path);
    const service = new NiyayeshService();
    const read = vi
      .spyOn(service, 'read')
      .mockResolvedValue({ schemaVersion: 1, items: [] });
    try {
      await expect(
        service.resources(actor, 'branch-b', 'countries'),
      ).rejects.toThrow();
      await expect(
        service.resources(
          { ...actor, userId: 'other' },
          'branch-a',
          'countries',
        ),
      ).rejects.toThrow();
      await expect(
        service.resources(actor, 'branch-a', 'customer-orders'),
      ).rejects.toThrow();
      await expect(
        service.resources(actor, 'branch-a', 'countries', '0', '../auth'),
      ).rejects.toThrow();
      expect(read).not.toHaveBeenCalled();
      await service.resources(actor, 'branch-a', 'countries');
      expect(read).toHaveBeenCalledWith(
        config,
        'person-a',
        '/api/v1/integration/resources/countries?after_id=0&limit=25',
      );
      await writeFile(path, JSON.stringify({ ...config, users: [] }));
      await expect(
        service.resources(actor, 'branch-a', 'countries'),
      ).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it('reports only intersection of local and site grants without leaking secrets', async () => {
    const service = new NiyayeshService();
    vi.spyOn(service, 'binding').mockResolvedValue({
      config,
      user: config.users[0]!,
    });
    vi.spyOn(service, 'read').mockResolvedValue({
      grants: ['countries.read', 'customer-orders.read'],
    });
    const status = await service.status(actor, 'branch-a');
    expect(status.resources).toEqual([{ code: 'countries', title: 'کشورها' }]);
    expect(JSON.stringify(status)).not.toContain(config.secret);
    expect(JSON.stringify(status)).not.toContain('person-a');
  });
});
