import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import type { DatabaseService } from '../database/database.service';
import type { IamService } from '../iam/iam.service';
import type { MasterHrDirectory } from '../master-data/master-hr-directory';
import { HrDirectoryService } from './hr-directory.service';

describe('HR employee account directory', () => {
  const actor = {
    permissions: ['hr.manage'],
    branchIds: ['a', 'b'],
  } as AuthenticatedActor;
  function setup() {
    const users = Array.from({ length: 12 }, (_, i) => ({
      id: `user-${i}`,
      username: `login-${i}`,
      displayName: `Person ${i}`,
      status: i === 1 ? 'INACTIVE' : 'ACTIVE',
      branches: [
        { branch: { id: i === 11 ? 'outside' : i === 10 ? 'b' : 'a' } },
      ],
    }));
    const listUsers = vi.fn().mockResolvedValue(users);
    const findMany = vi.fn().mockResolvedValue([{ userId: 'user-2' }]);
    const service = new HrDirectoryService(
      {
        client: {
          hrEmployee: {
            findMany,
            findFirst: vi.fn().mockResolvedValue({ id: 'employee' }),
          },
        },
      } as unknown as DatabaseService,
      { listUsers } as unknown as IamService,
      {
        currencies: vi.fn().mockResolvedValue([]),
      } as unknown as MasterHrDirectory,
    );
    return { service, listUsers, findMany };
  }
  it('returns every scoped IAM account without truncating or hiding unavailable accounts', async () => {
    const { service, listUsers } = setup();
    const result = await service.formReferences(actor);
    expect(listUsers).toHaveBeenCalledOnce();
    expect(result.users).toHaveLength(11);
    expect(result.users.find((u) => u.id === 'user-1')?.unavailableReason).toBe(
      'INACTIVE',
    );
    expect(result.users.find((u) => u.id === 'user-2')?.unavailableReason).toBe(
      'LINKED',
    );
    expect(result.users.find((u) => u.id === 'user-10')).toMatchObject({
      branchIds: ['b'],
    });
    expect(result.users.some((u) => u.id === 'user-11')).toBe(false);
    expect(result.users[0]).toEqual({
      id: 'user-0',
      label: 'Person 0 · login-0',
      branchIds: ['a'],
    });
  });
  it('does not disclose accounts to readers without employee management', async () => {
    const { service, listUsers, findMany } = setup();
    expect(
      (await service.formReferences({ ...actor, permissions: ['hr.read'] }))
        .users,
    ).toEqual([]);
    expect(listUsers).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });
  it('keeps the current employee account selectable while editing', async () => {
    const { service, findMany } = setup();
    findMany.mockResolvedValue([]);
    const employeeId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const result = await service.formReferences(actor, employeeId);
    expect(findMany).toHaveBeenCalledWith({
      where: { userId: { not: null }, id: { not: employeeId } },
      select: { userId: true },
    });
    expect(
      result.users.find((u) => u.id === 'user-2')?.unavailableReason,
    ).toBeUndefined();
  });
});
