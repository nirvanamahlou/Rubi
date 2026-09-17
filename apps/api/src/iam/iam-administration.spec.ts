import { ConflictException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { IamService } from './iam.service';

const actor = {
  userId: '00000000-0000-4000-8000-000000000001',
  sessionId: '00000000-0000-4000-8000-000000000002',
  permissions: ['iam.roles.manage'] as never[],
  branchIds: [],
};

describe('IAM administration safety', () => {
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
            { id: '00000000-0000-4000-8000-000000000003', code: 'system.backup.request' },
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
