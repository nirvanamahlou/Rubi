import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import { HrWorkbenchRequestUnits } from '../hr/hr-workbench-request-units';
import { IamWorkbenchRequestDirectory } from '../iam/iam-workbench-request-directory';
import { CallCenterReadService } from './call-center-read.service';
const actor = {
  userId: 'employee',
  branchIds: ['academy', 'office'],
  permissions: ['customer_affairs.call_center.read'],
} as AuthenticatedActor;
function fixture(
  employeeBranches: string[],
  visible: Record<string, Date | null> = {},
) {
  const query = vi.fn(
    ({ where }: { where: { contact: { branchId: string } } }) =>
      Promise.resolve(
        visible[where.contact.branchId]
          ? { occurredAt: visible[where.contact.branchId] }
          : null,
      ),
  );
  const access = {
    where: vi.fn(async (_actor: unknown, id: string) => ({ branchId: id })),
  };
  const db = { client: { callCenterCall: { findFirst: query } } };
  const workflow = { scope: vi.fn() };
  const directory = {
    callCenterBranches: vi.fn(async () => [
      { id: 'academy', name: 'Academy' },
      { id: 'office', name: 'Office' },
    ]),
    callCenterEmployeeBranches: vi.fn(async () => employeeBranches),
  };
  const service = new CallCenterReadService(
    db as never,
    workflow as never,
    { access } as never,
    null as never,
    directory as never,
  );
  return { service, access, query, directory };
}
describe('authoritative Call Center branch context', () => {
  it('uses employee branch before arbitrary first login branch, including no-call employees', async () => {
    const f = fixture(['office']);
    expect((await f.service.branches(actor)).meta.defaultBranchId).toBe(
      'office',
    );
    expect(f.query).not.toHaveBeenCalled();
  });
  it('never chooses an HR branch outside the authenticated list', async () => {
    const f = fixture(['foreign']);
    expect((await f.service.branches(actor)).meta.defaultBranchId).toBe(
      'academy',
    );
    expect(f.access.where.mock.calls.map((c) => c[1])).toEqual([
      'academy',
      'office',
    ]);
  });
  it('uses only visible history for managers without an employee route', async () => {
    const f = fixture([], { office: new Date('2026-11-02T00:00:00Z') });
    expect((await f.service.branches(actor)).meta.defaultBranchId).toBe(
      'office',
    );
    expect(f.access.where).toHaveBeenCalledWith(actor, 'office');
  });
  it('does not use inaccessible branch history or swallow database failures', async () => {
    const f = fixture([], { office: new Date() });
    f.access.where.mockImplementation(async (_a, id) => {
      if (id === 'office') throw new ForbiddenException();
      return { branchId: id };
    });
    expect((await f.service.branches(actor)).meta.defaultBranchId).toBe(
      'academy',
    );
    f.access.where.mockRejectedValue(new Error('database unavailable'));
    await expect(f.service.branches(actor)).rejects.toThrow(
      'database unavailable',
    );
  });
  it('returns no default when there are no active authorized branches', async () => {
    const f = fixture([]);
    f.directory.callCenterBranches.mockResolvedValue([]);
    expect(await f.service.branches(actor)).toEqual({
      data: [],
      meta: { defaultBranchId: null },
    });
  });
  it('intersects the HR producer lookup with IAM active branches', async () => {
    const findMany = vi.fn(async () => [{ id: 'office', name: 'Office' }]);
    const employeeBranches = vi.fn(async () => ['office']);
    const directory = new IamWorkbenchRequestDirectory(
      { client: { branch: { findMany } } } as never,
      { employeeBranches } as never,
    );
    expect(await directory.callCenterEmployeeBranches(actor)).toEqual([
      'office',
    ]);
    expect(employeeBranches).toHaveBeenCalledWith('employee', ['office']);
    const denied = { ...actor, permissions: [] } as AuthenticatedActor;
    await expect(directory.callCenterEmployeeBranches(denied)).rejects.toThrow(
      ForbiddenException,
    );
  });
  it('HR selects only active linked employees of the requested account and allowed branches', async () => {
    const findMany = vi.fn(async () => [{ branchId: 'office' }]);
    const units = new HrWorkbenchRequestUnits({
      client: { hrEmployee: { findMany } },
    } as never);
    expect(await units.employeeBranches('employee', ['office'])).toEqual([
      'office',
    ]);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        userId: 'employee',
        branchId: { in: ['office'] },
        status: 'فعال',
        deletedAt: null,
      },
      select: { branchId: true },
      distinct: ['branchId'],
    });
  });
});
