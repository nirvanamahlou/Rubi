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
    findFirst: vi.fn(),
    findMany: vi.fn(),
  };
  employees.findFirst.mockResolvedValue({
    unit: 'synthetic-unit',
    organizationBranchId: 'synthetic-company',
  });
  employees.findMany.mockResolvedValue([
    { userId: actor.userId },
    { userId: 'same-unit' },
  ]);
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
    const { service, employees } = setup([
      { id: actor.userId },
      { id: 'same-unit' },
      { id: 'other-unit' },
    ]);
    await expect(service.leaveOptions(branch, actor)).resolves.toEqual({
      users: [{ id: 'same-unit' }],
    });
    expect(employees.findFirst).toHaveBeenCalledWith({
      where: {
        branchId: branch,
        userId: actor.userId,
        status: 'فعال',
        deletedAt: null,
      },
      select: { unit: true, organizationBranchId: true },
    });
    expect(employees.findMany).toHaveBeenCalledWith({
      where: {
        branchId: branch,
        unit: 'synthetic-unit',
        organizationBranchId: 'synthetic-company',
        status: 'فعال',
        deletedAt: null,
        userId: { not: null },
      },
      select: { userId: true },
    });
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
    const { service, directory, employees } = setup([]);
    await expect(
      service.leaveOptions(branch, { ...actor, permissions: ['hr.manage'] }),
    ).resolves.toEqual({ users: [] });
    directory.leaveSubstituteUsers.mockClear();
    employees.findFirst.mockClear();
    await expect(
      service.leaveOptions(branch, {
        ...actor,
        branchIds: [],
        permissions: ['hr.manage'],
      }),
    ).rejects.toThrow();
    expect(directory.leaveSubstituteUsers).not.toHaveBeenCalled();
    expect(employees.findFirst).not.toHaveBeenCalled();
  });
  it('returns no substitute candidates when the active employee has no matching HR record', async () => {
    const { service, employees } = setup([
      { id: actor.userId },
      { id: 'same-unit' },
    ]);
    employees.findFirst.mockResolvedValue(null);
    await expect(service.leaveOptions(branch, actor)).resolves.toEqual({
      users: [],
    });
    expect(employees.findMany).not.toHaveBeenCalled();
  });
});
