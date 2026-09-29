import { USER_ACCESS_SCREENS } from '@nora/contracts';
import { describe, expect, it, vi } from 'vitest';
import { IamService } from './iam.service';

const actor = {
  userId: 'operator',
  sessionId: 'session',
  branchIds: [],
  permissions: ['iam.users.manage', 'customers.read'] as never[],
};

function service(isAdministrator: boolean) {
  const permission = {
    findMany: vi.fn().mockResolvedValue([{ id: 'customers', code: 'customers.read' }]),
  };
  const client = {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        roles: isAdministrator
          ? [{ role: { code: 'administrator' } }]
          : [{ role: { code: 'sales_staff' } }],
      }),
    },
    permission,
    branch: { findMany: vi.fn().mockResolvedValue([]) },
  };
  return {
    client,
    permission,
    instance: new IamService({ client } as never, {} as never, {} as never),
  };
}

describe('managed user access options', () => {
  it('returns the full permission and screen catalogs only to active system administrators', async () => {
    const admin = service(true);
    const options = await admin.instance.listUserAccessOptions(actor);
    expect(options.canAssignAll).toBe(true);
    expect(options.assignableScreenIds).toEqual(
      USER_ACCESS_SCREENS.map(({ id }) => id),
    );
    expect(admin.permission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { NOT: { code: { startsWith: 'ui.' } } },
      }),
    );

    const operator = service(false);
    const restricted = await operator.instance.listUserAccessOptions(actor);
    expect(restricted.canAssignAll).toBe(false);
    expect(restricted.permissions).toEqual([
      { id: 'customers', code: 'customers.read' },
    ]);
    expect(restricted.assignableScreenIds.length).toBeLessThan(
      USER_ACCESS_SCREENS.length,
    );
    expect(operator.permission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { code: { in: actor.permissions } },
      }),
    );
  });
});
