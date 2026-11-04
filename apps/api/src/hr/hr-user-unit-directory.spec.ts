import { describe, expect, it, vi } from 'vitest';
import { HrUserUnitDirectory } from './hr-user-unit-directory';

const actor = {
  userId: 'operator',
  permissions: ['iam.users.manage'],
  branchIds: ['allowed'],
} as never;
describe('HR public directory for user units', () => {
  it('validates request units and projects only linked staff job identity', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'unit' });
    const findMany = vi.fn().mockResolvedValue([]);
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      hrRecord: { findFirst },
      hrEmployee: { findMany },
    };
    const service = new HrUserUnitDirectory({ client: tx } as never);
    expect(await service.callCenterUnit('allowed', 'unit', tx as never)).toBe(
      true,
    );
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        id: 'unit',
        branchId: 'allowed',
        section: 'organization',
        tab: 'units',
        status: 'فعال',
        deletedAt: null,
      },
      select: { id: true },
    });
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    await service.callCenterStaff('allowed', ['user'], tx as never);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        branchId: 'allowed',
        userId: { in: ['user'] },
        status: 'فعال',
        deletedAt: null,
      },
      select: { userId: true, name: true, position: true },
    });
  });
  it('lists only scoped active organizational units and exposes no personnel data', async () => {
    const findMany = vi.fn(async () => [
      {
        id: 'unit',
        branchId: 'allowed',
        values: [' Sales ', 'private metadata'],
      },
      { id: 'invalid', branchId: 'allowed', values: [] },
    ]);
    const service = new HrUserUnitDirectory({
      client: { hrRecord: { findMany } },
    } as never);
    expect(await service.list(actor)).toEqual([
      { id: 'unit', branchId: 'allowed', name: 'Sales' },
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          section: 'organization',
          tab: 'units',
          status: 'فعال',
          deletedAt: null,
          branchId: { in: ['allowed'] },
        },
        select: { id: true, branchId: true, values: true },
      }),
    );
  });
  it('rejects directory reads without account management permission', async () => {
    const findMany = vi.fn();
    const service = new HrUserUnitDirectory({
      client: { hrRecord: { findMany } },
    } as never);
    await expect(
      service.list({ permissions: [], branchIds: ['allowed'] } as never),
    ).rejects.toMatchObject({ status: 403 });
    expect(findMany).not.toHaveBeenCalled();
  });
  it('locks and resolves only the intersection of operator and target branches', async () => {
    const tx = {
      $queryRaw: vi.fn(async () => []),
      hrRecord: {
        findFirst: vi.fn(async () => ({ id: 'unit', branchId: 'allowed' })),
      },
    };
    const service = new HrUserUnitDirectory({} as never);
    await service.assertAssignable(tx as never, 'unit', actor, [
      'allowed',
      'other',
    ]);
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(tx.hrRecord.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          branchId: { in: ['allowed'] },
          deletedAt: null,
          status: 'فعال',
          tab: 'units',
        }),
      }),
    );
  });
  it('rejects inactive, deleted, non-unit or cross-branch choices', async () => {
    const tx = {
      $queryRaw: vi.fn(async () => []),
      hrRecord: { findFirst: vi.fn(async () => null) },
    };
    await expect(
      new HrUserUnitDirectory({} as never).assertAssignable(
        tx as never,
        'unit',
        actor,
        ['other'],
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(tx.hrRecord.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ branchId: { in: [] } }),
      }),
    );
  });
  it('prevents removing the assigned unit branch without first clearing/reassigning the unit', async () => {
    const tx = {
      hrRecord: { findUnique: vi.fn(async () => ({ branchId: 'allowed' })) },
    };
    const service = new HrUserUnitDirectory({} as never);
    await expect(
      service.assertRetainedBranch(tx as never, 'unit', ['other']),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.assertRetainedBranch(tx as never, 'unit', ['allowed']),
    ).resolves.toBeUndefined();
  });
});
