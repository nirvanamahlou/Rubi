import { ConflictException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { IamService } from './iam.service';
import { CALL_CENTER_SALES_EXPERT } from '@nora/contracts';

const actor = {
  userId: '00000000-0000-4000-8000-000000000001',
  sessionId: '00000000-0000-4000-8000-000000000002',
  permissions: ['iam.roles.manage'] as never[],
  branchIds: [],
};

describe('IAM administration safety', () => {
  it('completes the same checked views during new manual-user creation', async () => {
    const database = {
      client: {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            roles: [{ role: { code: 'administrator' } }],
          }),
        },
        permission: { findMany: vi.fn().mockResolvedValue([]) },
      },
    };
    const service = new IamService(database as never, {} as never, {} as never);
    const managed = service as unknown as {
      managedAccess(
        dto: unknown,
        actor: unknown,
      ): Promise<{ permissionCodes: string[]; screenIds: string[] }>;
    };
    const result = await managed.managedAccess(
      {
        manualAccessV3: true,
        accessTitle: 'Arbitrary',
        permissionIds: [],
        screenIds: [
          'customer-affairs.call-center',
          'integrations.section.connections',
        ],
        deniedControlIds: [],
      },
      actor,
    );
    expect(result.permissionCodes.sort()).toEqual([
      'customer_affairs.call_center.contacts.read.own',
      'customer_affairs.call_center.read',
      'customer_affairs.call_center.reports.read.own',
    ]);
    expect(result.screenIds).toEqual(
      expect.arrayContaining([
        'integrations.home',
        'integrations.section.connections',
        'customer-affairs.call-center',
      ]),
    );
  });
  it('rejects derived new-user view prerequisites beyond the delegator authority', async () => {
    const database = {
      client: {
        user: { findUnique: vi.fn().mockResolvedValue({ roles: [] }) },
        permission: { findMany: vi.fn().mockResolvedValue([]) },
      },
    };
    const service = new IamService(database as never, {} as never, {} as never);
    const managed = service as unknown as {
      managedAccess(dto: unknown, actor: unknown): Promise<unknown>;
    };
    await expect(
      managed.managedAccess(
        {
          manualAccessV3: true,
          accessTitle: 'Arbitrary',
          permissionIds: [],
          screenIds: ['customer-affairs.call-center'],
          deniedControlIds: [],
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('cannot delegate legacy broad Call Center authority from a scoped expert grant', async () => {
    const database = {
      client: {
        permission: {
          findMany: vi
            .fn()
            .mockResolvedValue([
              { id: 'read', code: 'customer_affairs.call_center.read' },
            ]),
        },
        role: { create: vi.fn() },
      },
    };
    const service = new IamService(database as never, {} as never, {} as never);
    await expect(
      service.createRole(
        {
          code: 'scoped-cannot-escape',
          name: 'Arbitrary title',
          permissionIds: ['read'],
        },
        {
          ...actor,
          permissions: [...actor.permissions, ...CALL_CENTER_SALES_EXPERT],
        },
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(database.client.role.create).not.toHaveBeenCalled();
  });
  it('makes newly created native Call Center roles scoped without rewriting an existing role', async () => {
    const database = {
      client: {
        permission: {
          findMany: vi
            .fn()
            .mockResolvedValue([
              { id: 'read', code: 'customer_affairs.call_center.read' },
            ]),
          upsert: vi.fn().mockResolvedValue({ id: 'policy' }),
        },
        role: { create: vi.fn().mockResolvedValue({ id: 'new-role' }) },
        auditEvent: { create: vi.fn().mockResolvedValue({}) },
      },
    };
    const service = new IamService(database as never, {} as never, {} as never);
    await service.createRole(
      {
        code: 'new-native-cc',
        name: 'Arbitrary title',
        permissionIds: ['read'],
      },
      {
        ...actor,
        permissions: [
          ...actor.permissions,
          'customer_affairs.call_center.read',
        ],
      },
      {},
    );
    expect(database.client.role.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          permissions: {
            create: [{ permissionId: 'read' }, { permissionId: 'policy' }],
          },
        }),
      }),
    );
  });
  it('requires explicit confirmation before revoking the current session', async () => {
    const service = new IamService({} as never, {} as never, {} as never);
    await expect(
      service.revokeAdministrativeSession(
        actor.sessionId,
        actor,
        'investigation requested',
        false,
        {},
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('prevents an operator from creating a role with permissions they lack', async () => {
    const database = {
      client: {
        permission: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: '00000000-0000-4000-8000-000000000003',
              code: 'system.backup.request',
            },
          ]),
        },
        role: { create: vi.fn() },
      },
    };
    const service = new IamService(database as never, {} as never, {} as never);
    await expect(
      service.createRole(
        {
          code: 'unsafe-role',
          name: 'Unsafe role',
          permissionIds: ['00000000-0000-4000-8000-000000000003'],
        },
        actor,
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(database.client.role.create).not.toHaveBeenCalled();
  });
});
