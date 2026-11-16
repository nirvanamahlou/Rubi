import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import { HrService } from './hr.service';
const branch = '11111111-1111-4111-8111-111111111111';
const actor: AuthenticatedActor = {
  userId: 'user',
  sessionId: 'session',
  branchIds: [branch],
  permissions: [],
};
function setup(users: Array<{ id: string }>) {
  const directory = { leaveSubstituteUsers: vi.fn().mockResolvedValue(users) };
  const documents = { uploadLeaveEvidence: vi.fn() };
  const employees = {
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
  };
  return {
    service: new HrService(
      { client: { hrEmployee: employees } } as never,
      directory as never,
      documents as never,
      {} as never,
    ),
    directory,
    documents,
    employees,
  };
}
describe('leave self-service account boundary', () => {
  it('allows an active internal branch account without HR administration grants', async () => {
    const { service } = setup([{ id: actor.userId }]);
    await expect(service.leaveOptions(branch, actor)).resolves.toEqual({
      users: [],
    });
  });
  it('offers only internal colleagues from the same unit and organization branch', async () => {
    const { service, employees } = setup([
      { id: actor.userId },
      { id: 'colleague' },
      { id: 'other-unit' },
    ]);
    employees.findFirst.mockResolvedValue({
      unit: 'Sales',
      organizationBranchId: 'organization-branch',
    });
    employees.findMany.mockResolvedValue([
      { userId: actor.userId },
      { userId: 'colleague' },
    ]);
    await expect(service.leaveOptions(branch, actor)).resolves.toEqual({
      users: [{ id: 'colleague' }],
    });
    expect(employees.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          branchId: branch,
          unit: 'Sales',
          organizationBranchId: 'organization-branch',
          status: 'فعال',
          deletedAt: null,
        }),
      }),
    );
  });
  it('denies directory and evidence upload to an account outside the internal directory', async () => {
    const { service, documents } = setup([]);
    await expect(service.leaveOptions(branch, actor)).rejects.toThrow();
    await expect(
      service.uploadLeaveEvidence(branch, '2026-11-06', undefined, actor),
    ).rejects.toThrow();
    expect(documents.uploadLeaveEvidence).not.toHaveBeenCalled();
  });
  it('retains HR-managed entry but never bypasses branch scope', async () => {
    const { service, directory } = setup([]);
    await expect(
      service.leaveOptions(branch, { ...actor, permissions: ['hr.manage'] }),
    ).resolves.toEqual({ users: [] });
    directory.leaveSubstituteUsers.mockClear();
    await expect(
      service.leaveOptions(branch, {
        ...actor,
        branchIds: [],
        permissions: ['hr.manage'],
      }),
    ).rejects.toThrow();
    expect(directory.leaveSubstituteUsers).not.toHaveBeenCalled();
  });
});
