import { describe, expect, it, vi } from 'vitest';
import {
  migrateHrCompanyStructure,
  orderedCompanyUnits,
} from './hr-company-migration';
const actor = {
  userId: 'admin',
  sessionId: 'session',
  branchIds: ['owner'],
  permissions: [],
};
function setup(applied = false) {
  const employee = {
    id: 'employee',
    branchId: 'owner',
    organizationBranchId: 'old-branch',
  };
  const unit = {
    id: 'unit',
    branchId: 'owner',
    tab: 'units',
    parentId: null,
    sharedSourceId: null,
    data: { organizationBranchId: 'old-branch' },
  };
  const subsidiary = {
    id: 'old-branch',
    branchId: 'owner',
    tab: 'branches',
    status: 'فعال',
  };
  const tx = {
    hrAuditEvent: {
      findFirst: vi.fn().mockResolvedValue(applied ? { id: 'done' } : null),
      create: vi.fn(),
    },
    hrEmployee: {
      findMany: vi.fn().mockResolvedValue([employee]),
      update: vi.fn(),
    },
    hrRecord: {
      findMany: vi.fn().mockResolvedValue([unit, subsidiary]),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi
        .fn()
        .mockImplementation(({ where, data }) =>
          Promise.resolve({ ...unit, id: where.id, ...data }),
        ),
    },
  };
  return { tx, sync: vi.fn().mockResolvedValue(undefined) };
}
describe('company scope historical transfer', () => {
  it('previews counts without writing or synchronizing anything', async () => {
    const { tx, sync } = setup();
    expect(
      await migrateHrCompanyStructure(tx as never, actor, true, sync),
    ).toEqual({
      alreadyApplied: false,
      employees: 1,
      units: 1,
      subsidiaries: 1,
    });
    expect(tx.hrEmployee.update).not.toHaveBeenCalled();
    expect(tx.hrRecord.update).not.toHaveBeenCalled();
    expect(tx.hrRecord.create).not.toHaveBeenCalled();
    expect(tx.hrAuditEvent.create).not.toHaveBeenCalled();
    expect(sync).not.toHaveBeenCalled();
  });
  it('preserves physical owners and record IDs, archives subsidiaries and audits previous links', async () => {
    const { tx, sync } = setup();
    await migrateHrCompanyStructure(tx as never, actor, false, sync);
    expect(tx.hrEmployee.update).toHaveBeenCalledWith({
      where: { id: 'employee' },
      data: { organizationBranchId: null, version: { increment: 1 } },
    });
    expect(tx.hrRecord.update).toHaveBeenCalledWith({
      where: { id: 'old-branch' },
      data: { deletedAt: expect.any(Date), version: { increment: 1 } },
    });
    expect(sync).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'unit',
        branchId: 'owner',
        data: { allBranches: true },
      }),
    );
    expect(tx.hrAuditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        employeeId: 'employee',
        changes: {
          organizationBranchId: 'old-branch',
          companyScopeValues: null,
        },
      }),
    });
  });
  it('does not reset employee membership edited after the one-time transfer', async () => {
    const { tx, sync } = setup(true);
    expect(
      await migrateHrCompanyStructure(tx as never, actor, false, sync),
    ).toMatchObject({ alreadyApplied: true });
    expect(tx.hrEmployee.findMany).not.toHaveBeenCalled();
    expect(sync).not.toHaveBeenCalled();
  });
  it('shares parents before children and rejects cyclic organization units', () => {
    const parent = { id: 'parent', parentId: null };
    const child = { id: 'child', parentId: 'parent' };
    expect(orderedCompanyUnits([child, parent])).toEqual([parent, child]);
    const linkedChild = { ...child, parentId: 'parent-copy' };
    expect(
      orderedCompanyUnits(
        [linkedChild, parent],
        new Map([['parent-copy', 'parent']]),
      ),
    ).toEqual([parent, linkedChild]);
    expect(() =>
      orderedCompanyUnits([
        { id: 'a', parentId: 'b' },
        { id: 'b', parentId: 'a' },
      ]),
    ).toThrow();
  });
});
