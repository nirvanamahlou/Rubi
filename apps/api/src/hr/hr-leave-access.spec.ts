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
  const employee = {
    findFirst: vi
      .fn()
      .mockResolvedValue({
        unit: 'SYNTHETIC UNIT',
        organizationBranchId: branch,
      }),
    findMany: vi
      .fn()
      .mockResolvedValue([{ userId: actor.userId }, { userId: 'colleague' }]),
  };
  return {
    service: new HrService(
      { client: { hrEmployee: employee } } as never,
      directory as never,
      documents as never,
      {} as never,
    ),
    directory,
    documents,
    employee,
  };
}
describe('leave self-service account boundary', () => {
  it('allows an active internal branch account without HR administration grants', async () => {
    const { service, employee } = setup([
      { id: actor.userId },
      { id: 'colleague' },
      { id: 'other-department' },
    ]);
    await expect(service.leaveOptions(branch, actor)).resolves.toEqual({
      users: [{ id: 'colleague' }],
    });
    expect(employee.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          branchId: branch,
          userId: actor.userId,
          status: 'فعال',
          deletedAt: null,
        }),
      }),
    );
    expect(employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          branchId: branch,
          unit: 'SYNTHETIC UNIT',
          organizationBranchId: branch,
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
