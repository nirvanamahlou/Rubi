import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@nora/database';
import type { AuthenticatedActor } from '@nora/contracts';
import { HrService } from './hr.service';
import type { DatabaseService } from '../database/database.service';
import type { IamService } from '../iam/iam.service';
import type { DocumentsService } from '../documents/documents.service';
import type { HrDirectoryService } from './hr-directory.service';
function setup(employee: unknown) {
  const findFirst = vi.fn().mockResolvedValue(employee);
  const service = new HrService(
    { client: { hrEmployee: { findFirst } } } as unknown as DatabaseService,
    {} as IamService,
    {} as DocumentsService,
    {} as HrDirectoryService,
  );
  const validate = vi
    .spyOn(
      service as unknown as {
        validateLeaveSubmission: (...args: unknown[]) => Promise<void>;
      },
      'validateLeaveSubmission',
    )
    .mockResolvedValue(undefined);
  const tx = {
    hrEmployee: { findFirst },
  } as unknown as Prisma.TransactionClient;
  return { service, validate, findFirst, tx };
}
const actor: AuthenticatedActor = {
  userId: 'sender',
  sessionId: 'session',
  branchIds: [
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
  ],
  permissions: ['hr.self'],
};
const leave = {
  from: '2026-11-10',
  to: '2026-11-10',
  mode: 'روزانه' as const,
  reason: 'Synthetic',
  substituteUserId: 'deputy',
};
describe('workbench leave requester identity', () => {
  it('resolves the linked sender record in its authorized branch independently of destination and substitute', async () => {
    const employee = {
      id: 'employee-id',
      branchId: '22222222-2222-4222-8222-222222222222',
      userId: 'sender',
    };
    const s = setup(employee);
    await s.service.validateWorkbenchLeaveSubmission(
      s.tx,
      '11111111-1111-4111-8111-111111111111',
      'sender',
      leave,
      actor,
    );
    expect(s.findFirst).toHaveBeenCalledWith({
      where: { userId: 'sender', deletedAt: null, status: 'فعال' },
    });
    expect(s.validate).toHaveBeenCalledWith(s.tx, employee, leave, actor);
  });
  it('reconciles attendance in the employee branch after the request commits', async () => {
    const s = setup({
      id: 'employee-id',
      branchId: '22222222-2222-4222-8222-222222222222',
      userId: 'sender',
    });
    const process = vi
      .spyOn(s.service, 'processAttendance')
      .mockResolvedValue(
        {} as Awaited<ReturnType<HrService['processAttendance']>>,
      );
    await s.service.reconcileWorkbenchLeave(
      '11111111-1111-4111-8111-111111111111',
      { ...leave, from: '2026-01-01', to: '2026-01-01' },
      actor,
      'sender',
    );
    expect(process).toHaveBeenCalledWith(
      { branchId: '22222222-2222-4222-8222-222222222222', date: '2026-01-01' },
      expect.any(String),
      actor,
      true,
    );
  });
  it('rejects missing profiles without guessing a name or using the substitute', async () => {
    const s = setup(null);
    await expect(
      s.service.validateWorkbenchLeaveSubmission(
        s.tx,
        '11111111-1111-4111-8111-111111111111',
        'sender',
        leave,
        actor,
      ),
    ).rejects.toThrow('پرونده فعال');
    expect(s.validate).not.toHaveBeenCalled();
  });
  it('preserves branch access checks for the actual employee', async () => {
    const s = setup({
      id: 'employee-id',
      branchId: '33333333-3333-4333-8333-333333333333',
      userId: 'sender',
    });
    await expect(
      s.service.validateWorkbenchLeaveSubmission(
        s.tx,
        '11111111-1111-4111-8111-111111111111',
        'sender',
        leave,
        actor,
      ),
    ).rejects.toThrow();
    expect(s.validate).not.toHaveBeenCalled();
  });
});
