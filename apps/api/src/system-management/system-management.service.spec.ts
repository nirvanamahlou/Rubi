import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { SystemManagementService } from './system-management.service';

const actor = {
  userId: '00000000-0000-4000-8000-000000000001',
  sessionId: '00000000-0000-4000-8000-000000000002',
  permissions: ['system.settings.manage'] as never[],
  branchIds: ['00000000-0000-4000-8000-000000000003'],
};

const setting = (scopeKey: string, value: string) => ({
  id: `setting-${scopeKey}`,
  namespace: 'ui',
  key: 'system.name',
  valueType: 'STRING',
  scope: scopeKey.split(':')[0],
  scopeId: scopeKey.includes(':') ? scopeKey.split(':')[1] : null,
  scopeKey,
  activeVersion: 1,
  status: 'ACTIVE',
  updatedAt: new Date('2026-09-17T00:00:00.000Z'),
  versions: [
    {
      value,
      reason: 'initial configuration',
      createdByUserId: actor.userId,
      createdAt: new Date('2026-09-17T00:00:00.000Z'),
    },
  ],
});

describe('SystemManagementService', () => {
  it('resolves USER before BRANCH, LEGAL_ENTITY, and GLOBAL', async () => {
    const rows = [
      setting('GLOBAL', 'global'),
      setting('BRANCH:00000000-0000-4000-8000-000000000003', 'branch'),
      setting('USER:00000000-0000-4000-8000-000000000004', 'user'),
    ];
    const database = {
      client: { systemSetting: { findMany: vi.fn().mockResolvedValue(rows) } },
    };
    const service = new SystemManagementService(database as never, {} as never);
    const result = await service.resolveSetting({
      namespace: 'ui',
      key: 'system.name',
      userId: '00000000-0000-4000-8000-000000000004',
      branchId: '00000000-0000-4000-8000-000000000003',
    });
    expect(result?.value).toBe('user');
  });

  it('rejects a stale optimistic version before writing', async () => {
    const transaction = {
      $queryRaw: vi.fn(),
      systemSetting: {
        findUnique: vi.fn().mockResolvedValue({
          ...setting('GLOBAL', 'old'),
          activeVersion: 2,
        }),
      },
    };
    const database = {
      client: {
        $transaction: vi.fn((run) => run(transaction)),
      },
    };
    const service = new SystemManagementService(database as never, {} as never);
    await expect(
      service.writeSetting(
        {
          namespace: 'ui',
          key: 'system.name',
          valueType: 'STRING',
          value: 'new',
          scope: 'GLOBAL',
          reason: 'approved update',
          expectedVersion: 1,
        },
        actor,
        {},
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns an already-issued number for a repeated idempotency key', async () => {
    const issued = {
      issuedValue: 'SC-1405-000001',
      sequenceValue: 1n,
      periodKey: '1405',
    };
    const transaction = {
      systemIssuedNumber: { findUnique: vi.fn().mockResolvedValue(issued) },
    };
    const database = {
      client: { $transaction: vi.fn((run) => run(transaction)) },
    };
    const service = new SystemManagementService(database as never, {} as never);
    const result = await service.issueNumber(
      '00000000-0000-4000-8000-000000000005',
      { idempotencyKey: 'request-0001' },
      actor,
      {},
    );
    expect(result.value).toBe('SC-1405-000001');
    expect(result.sequence).toBe('1');
  });

  it('reports a published but unreachable Worker port as UNAVAILABLE', async () => {
    const database = {
      client: { $queryRaw: vi.fn().mockResolvedValue([{ healthy: 1 }]) },
    };
    const service = new SystemManagementService(database as never, {} as never);
    const result = await service.health();
    expect(
      result.find(({ component }) => component === 'POSTGRESQL')?.status,
    ).toBe('HEALTHY');
    expect(result.find(({ component }) => component === 'REDIS')?.status).toBe(
      'UNAVAILABLE',
    );
  });

  it('uses the published Worker and Documents owner probes when available', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        components: [
          {
            component: 'REDIS',
            status: 'HEALTHY',
            checkedAt: '2026-09-19T00:00:00.000Z',
            latencyMs: 4,
            detail: 'Redis confirmed by Worker.',
          },
          {
            component: 'WORKER',
            status: 'HEALTHY',
            checkedAt: '2026-09-19T00:00:00.000Z',
            latencyMs: 0,
            detail: 'Worker is running.',
          },
          {
            component: 'QUEUE',
            status: 'HEALTHY',
            checkedAt: '2026-09-19T00:00:00.000Z',
            latencyMs: 3,
            detail: 'Queue confirmed by Worker.',
          },
        ],
      }),
      ok: true,
    });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const database = {
        client: { $queryRaw: vi.fn().mockResolvedValue([{ healthy: 1 }]) },
      };
      const storageHealth = vi.fn().mockResolvedValue(undefined);
      const service = new SystemManagementService(
        database as never,
        {} as never,
        { storageHealth } as never,
      );

      const result = await service.health();

      expect(
        result.find(({ component }) => component === 'STORAGE'),
      ).toMatchObject({ status: 'HEALTHY' });
      expect(
        result.find(({ component }) => component === 'REDIS'),
      ).toMatchObject({ status: 'HEALTHY', latencyMs: 4 });
      expect(
        result.find(({ component }) => component === 'QUEUE'),
      ).toMatchObject({ status: 'HEALTHY', latencyMs: 3 });
      expect(storageHealth).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('routes an export retry to Reporting and audits the control-plane action', async () => {
    const retryExport = vi.fn().mockResolvedValue({ id: 'new-export' });
    const create = vi.fn().mockResolvedValue({});
    const database = { client: { systemAuditEvent: { create } } };
    const service = new SystemManagementService(
      database as never,
      {} as never,
      undefined,
      { retryExport } as never,
    );

    await expect(
      service.retryReportingExport(
        '00000000-0000-4000-8000-000000000005',
        { reason: 'رفع خطای موقت خروجی' },
        actor,
        { requestId: 'request-1' },
      ),
    ).resolves.toEqual({ id: 'new-export' });

    expect(retryExport).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000005',
      actor,
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'REPORTING_EXPORT_RETRY_REQUESTED',
          entityType: 'REPORTING_EXPORT',
          reason: 'رفع خطای موقت خروجی',
        }),
      }),
    );
  });
});
