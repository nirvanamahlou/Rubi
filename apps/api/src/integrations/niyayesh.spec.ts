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
import type { AuthenticatedActor } from '@nora/contracts';

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
const actor: AuthenticatedActor = {
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
  it('redacts totals outside personal resources and never treats a denied count as zero', async () => {
    const service = new NiyayeshService();
    vi.spyOn(service, 'binding').mockResolvedValue({
      config,
      user: { ...config.users[0]!, resources: ['hotels'] },
    });
    vi.spyOn(service, 'read').mockResolvedValue({
      metrics: [
        { key: 'hotels', resource: 'hotels', value: 0, state: 'AVAILABLE' },
        {
          key: 'customers',
          resource: 'customer-accounts',
          value: 300,
          state: 'AVAILABLE',
        },
      ],
      imports: [],
    });
    const data = await service.dashboard(actor, 'branch-a');
    expect(data.metrics.map((m) => m.value)).toEqual([0, null]);
    expect(data.metrics[1]!.state).toBe('FORBIDDEN');
  });
  it('checks import permission and branch before any remote mutation', async () => {
    const service = new NiyayeshService();
    vi.spyOn(service, 'canImport').mockReturnValue(false);
    const read = vi.spyOn(service, 'read');
    await expect(
      service.workbook(
        actor,
        'branch-a',
        'hotels',
        { buffer: Buffer.from('x'), originalname: 'a.xlsx' },
        true,
        undefined,
        'proof',
        'a'.repeat(32),
      ),
    ).rejects.toThrow();
    expect(read).not.toHaveBeenCalled();
  });
  it('binds write bytes and stable command to the signature with a fresh nonce for retry', () => {
    const path = '/api/v1/integration/workbooks/hotels';
    const options = {
      method: 'POST',
      body: '{"apply":true}',
      command: 'a'.repeat(32),
    };
    const a = signingHeaders(config, 'person-a', path, options);
    const b = signingHeaders(config, 'person-a', path, options);
    expect(a['Idempotency-Key']).toBe(options.command);
    expect(a['X-ERP-Nonce']).not.toBe(b['X-ERP-Nonce']);
    expect(a['Content-Type']).toBe('application/json');
  });
});

describe('Niyayesh native editor and period reports', () => {
  it('passes only the fixed native route, stable command, personal actor and version', async () => {
    const service = new NiyayeshService();
    vi.spyOn(service, 'binding').mockResolvedValue({
      config,
      user: { ...config.users![0]!, resources: ['tours'] },
    });
    const read = vi.spyOn(service, 'read').mockResolvedValue({ id: 1 });
    await service.saveCatalogue(actor, 'branch-a', 'tours', {
      id: '1',
      version: '8',
      command: 'stable-command-12345',
      value: { title: 'New' },
    });
    expect(read).toHaveBeenCalledWith(
      config,
      'person-a',
      '/api/v1/admin/tours/1',
      {
        method: 'PATCH',
        command: 'stable-command-12345',
        version: '8',
        body: '{"title":"New"}',
      },
    );
    await expect(
      service.saveCatalogue(
        { ...actor, permissions: [] },
        'branch-a',
        'tours',
        { command: 'stable-command-12345', value: { title: 'New' } },
      ),
    ).rejects.toThrow();
    expect(read).toHaveBeenCalledTimes(1);
    await expect(
      service.saveCatalogue(actor, 'branch-a', 'tours', {
        id: '1',
        command: 'stable-command-12345',
        value: { title: 'New' },
      }),
    ).rejects.toThrow();
  });
  it('redacts report facts and activities outside personal source grants', async () => {
    const service = new NiyayeshService();
    vi.spyOn(service, 'binding').mockResolvedValue({
      config: { ...config, registrySystemId: 'registered-site' },
      user: { ...config.users![0]!, resources: ['site-analytics', 'hotels'] },
    });
    vi.spyOn(service, 'read').mockResolvedValue({
      metrics: {
        users: { value: 3 },
        orders: { value: 4 },
        sales: { value: 5 },
        pending: { value: 1 },
      },
      totals: { tours: 8, hotels: 9 },
      trends: { users: [1], sales: [2] },
      salesByCurrency: [{ currency: 'USD', amount: '5' }],
      activity: [{ resource: 'customer-orders' }],
    });
    const report = await service.report(
      actor,
      'branch-a',
      '2026-10-01',
      '2026-10-27',
    );
    expect(report.metrics.users).toEqual({ value: null, state: 'FORBIDDEN' });
    expect(report.salesByCurrency).toBeNull();
    expect(report.totals).toEqual({ tours: null, hotels: 9 });
    expect(report.activity).toEqual([]);
    expect(report.trends.users).toBeUndefined();
    expect(report.registrySystemId).toBe('registered-site');
  });
});

describe('Independent site reporting connections', () => {
  it('resolves each exact registry ID with its own origin and personal scope, with no fallback', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'nora-site-reports-'));
    const file = join(dir, 'connection.json');
    const primary = {
      ...config,
      registrySystemId: 'site-a',
      users: [
        {
          ...config.users[0]!,
          resources: ['site-analytics', 'customer-accounts'],
        },
      ],
    };
    const second = {
      ...config,
      registrySystemId: 'site-b',
      origin: 'https://second.example',
      secret: 'another-private-key'.repeat(3),
      users: [
        {
          ...config.users[0]!,
          subject: 'person-b',
          resources: ['site-analytics', 'customer-accounts'],
        },
      ],
    };
    await writeFile(
      file,
      JSON.stringify({ ...primary, reportConnections: [second] }),
    );
    vi.stubEnv('NIYAYESH_CONNECTION_FILE', file);
    const service = new NiyayeshService();
    const read = vi.spyOn(service, 'read').mockImplementation(async (c) => ({
      from: '2026-10-01',
      to: '2026-10-31',
      metrics: { users: { value: c.registrySystemId === 'site-a' ? 2 : 7 } },
      totals: {},
      trends: {},
      activity: [],
      activityAvailable: true,
    }));
    try {
      const a = await service.report(
        actor,
        'branch-a',
        '2026-10-01',
        '2026-10-31',
        'site-a',
      );
      const b = await service.report(
        actor,
        'branch-a',
        '2026-10-01',
        '2026-10-31',
        'site-b',
      );
      expect(a.registrySystemId).toBe('site-a');
      expect(a.metrics.users!.value).toBe(2);
      expect(b.registrySystemId).toBe('site-b');
      expect(b.metrics.users!.value).toBe(7);
      expect(read.mock.calls[1]![0].origin).toBe('https://second.example');
      expect(read.mock.calls[1]![1]).toBe('person-b');
      await service.resources(
        actor,
        'branch-a',
        'customer-accounts',
        '0',
        undefined,
        undefined,
        'users',
        '2026-10-01',
        '2026-10-31',
        'site-b',
      );
      expect(read.mock.calls[2]![0].registrySystemId).toBe('site-b');
      await expect(
        service.report(
          actor,
          'branch-a',
          '2026-10-01',
          '2026-10-31',
          'unknown',
        ),
      ).rejects.toThrow('اتصال گزارش این سایت تنظیم نشده است.');
      await expect(
        service.report(
          actor,
          'branch-other',
          '2026-10-01',
          '2026-10-31',
          'site-b',
        ),
      ).rejects.toThrow();
      await expect(
        service.report(
          { ...actor, userId: 'other-user' },
          'branch-a',
          '2026-10-01',
          '2026-10-31',
          'site-b',
        ),
      ).rejects.toThrow();
      expect(read).toHaveBeenCalledTimes(3);
      expect((await service.configuration())?.registrySystemId).toBe('site-a');
      await writeFile(
        file,
        JSON.stringify({
          ...primary,
          reportConnections: [{ ...second, registrySystemId: 'site-a' }],
        }),
      );
      await expect(
        service.report(actor, 'branch-a', '2026-10-01', '2026-10-31', 'site-a'),
      ).rejects.toThrow('تنظیمات امن اتصال کامل نیست.');
      expect(read).toHaveBeenCalledTimes(3);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('Per-site live presence reader', () => {
  it('uses the exact registered site binding and analytics permission without write grants', async () => {
    const service = new NiyayeshService();
    const binding = vi.spyOn(service, 'binding').mockResolvedValue({
      config: { ...config, registrySystemId: 'site-b' },
      user: { ...config.users[0]!, resources: ['site-analytics'] },
    });
    const read = vi.spyOn(service, 'read').mockResolvedValue({
      schemaVersion: 1,
      state: 'ACTIVE',
      total: 0,
      nodes: [],
      edges: [],
    });
    const result = await service.presence(actor, 'branch-a', 'site-b');
    expect(result.registrySystemId).toBe('site-b');
    expect(result.total).toBe(0);
    expect(binding).toHaveBeenCalledWith(actor, 'branch-a', 'brands', 'site-b');
    expect(read.mock.calls[0]![2]).toBe('/api/v1/integration/presence');
    await expect(
      service.presence({ ...actor, permissions: [] }, 'branch-a', 'site-b'),
    ).rejects.toThrow();
    expect(read).toHaveBeenCalledTimes(1);
  });
});
