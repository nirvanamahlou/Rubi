import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedActor } from '@rubi/contracts';
import { describe, expect, it, vi } from 'vitest';
import { HrSelfPerformanceService } from './hr-self-performance.service';

const actor: AuthenticatedActor = {
  userId: 'self',
  sessionId: 'session',
  branchIds: ['allowed'],
  permissions: ['hr.self'],
};
function fixture() {
  const employee = {
    id: 'employee',
    name: 'User',
    personnelCode: '100',
    unit: 'Sales',
    position: 'Salesperson',
  };
  const client = {
    hrEmployee: { findFirst: vi.fn().mockResolvedValue(employee) },
    hrRecord: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(12),
    },
    hrAuditEvent: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const hr = {
    leaveBalances: vi.fn().mockResolvedValue({
      year: 2026,
      items: [{ type: 'annual', granted: '26', used: '2', balance: '24' }],
    }),
  };
  return {
    client,
    hr,
    service: new HrSelfPerformanceService({ client } as never, hr as never),
  };
}
describe('HR self performance public projection', () => {
  it('rejects accounts without HR access before reading a personnel record', async () => {
    const f = fixture();
    await expect(
      f.service.get({ ...actor, permissions: [] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(f.client.hrEmployee.findFirst).not.toHaveBeenCalled();
  });
  it('never expands the subject for HR managers, and excludes deleted/out-of-branch records', async () => {
    const f = fixture();
    await f.service.get({
      ...actor,
      permissions: ['hr.manage', 'hr.sensitive'],
    });
    expect(f.client.hrEmployee.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'self',
          branchId: { in: ['allowed'] },
          deletedAt: null,
        },
      }),
    );
    for (const [query] of f.client.hrRecord.findMany.mock.calls)
      expect(query.where).toMatchObject({
        employeeId: 'employee',
        employee: { userId: 'self', deletedAt: null },
        branchId: { in: ['allowed'] },
        deletedAt: null,
      });
  });
  it('does not substitute another employee when the account is unlinked', async () => {
    const f = fixture();
    f.client.hrEmployee.findFirst.mockResolvedValue(null);
    const result = await f.service.get(actor);
    expect(result.employee).toBeNull();
    expect(f.client.hrRecord.findMany).not.toHaveBeenCalled();
    expect(f.hr.leaveBalances).not.toHaveBeenCalled();
  });
  it('selects only released own payslips and excludes the private workflow payload', async () => {
    const f = fixture();
    f.client.hrRecord.findMany.mockImplementation(async (query) =>
      query.where.section === 'payroll'
        ? [
            {
              id: 'payslip',
              section: 'payroll',
              tab: 'payslips',
              status: 'تأییدشده',
              values: ['User', '1405-06', '100', '20', '80', '2026-09-01'],
              data: { currency: 'IRR', bankSecret: 'private' },
              updatedAt: new Date('2026-09-01'),
            },
          ]
        : [],
    );
    const result = await f.service.get(actor);
    const payrollQuery = f.client.hrRecord.findMany.mock.calls.find(
      ([query]) => query.where.section === 'payroll',
    )![0];
    expect(payrollQuery.where.status.in).not.toContain('پیش‌نویس');
    expect(payrollQuery.where.status.in).not.toContain('ردشده');
    expect(result.latestPayslip?.fields).toContainEqual({
      label: 'خالص پرداختی',
      value: '80',
    });
    expect(result.latestPayslip?.fields).toContainEqual({
      label: 'ارز',
      value: 'IRR',
    });
    expect(JSON.stringify(result)).not.toContain('private');
    expect(f.hr.leaveBalances).toHaveBeenCalledWith(
      { employeeId: 'employee' },
      actor,
    );
  });
  it('does not read salary for HR readers without self/sensitive access', async () => {
    const f = fixture();
    const result = await f.service.get({ ...actor, permissions: ['hr.read'] });
    expect(result.payslipVisible).toBe(false);
    expect(f.client.hrRecord.findMany).toHaveBeenCalledTimes(3);
  });
  it('queries job actions only by the signed-in actor and current branches', async () => {
    const f = fixture();
    await f.service.activity(actor, '2026-09-01', '2026-09-13');
    expect(f.client.hrAuditEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          actorId: 'self',
          branchId: { in: ['allowed'] },
        }),
        select: { id: true, action: true, createdAt: true },
      }),
    );
  });
  it('counts all approved own leave requests without the ten-record display cap', async () => {
    const f = fixture();
    const result = await f.service.get(actor);
    expect(result.approvedLeaveCount).toBe(12);
    expect(f.client.hrRecord.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        employeeId: 'employee',
        employee: { userId: 'self', deletedAt: null },
        branchId: { in: ['allowed'] },
        deletedAt: null,
        status: { in: expect.not.arrayContaining(['پیش‌نویس', 'ردشده']) },
      }),
    });
  });
  it('uses Tehran calendar date and approved correction punches, never the original times', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-13T21:00:00Z'));
    try {
      const f = fixture();
      f.client.hrRecord.findMany.mockImplementation(async (query) =>
        query.where.tab === 'checkins'
          ? [
              {
                parentId: 'correction',
                values: ['User', '2026-09-14', '۱۷:۳۰', 'خروج'],
              },
              {
                parentId: 'correction',
                values: ['User', '2026-09-14', '۰۹:۰۰', 'ورود'],
              },
              {
                parentId: null,
                values: ['User', '2026-09-14', '08:00', 'ورود'],
              },
            ]
          : [],
      );
      const result = await f.service.get(actor);
      expect(result.todayAttendance).toEqual({
        date: '2026-09-14',
        firstIn: '09:00',
        lastOut: '17:30',
      });
      const query = f.client.hrRecord.findMany.mock.calls.find(
        ([item]) => item.where.tab === 'checkins',
      )![0];
      expect(query.where.values).toEqual({ path: ['1'], equals: '2026-09-14' });
      expect(query.where.employeeId).toBe('employee');
      expect(query.where.branchId).toEqual({ in: ['allowed'] });
    } finally {
      vi.useRealTimers();
    }
  });
});
