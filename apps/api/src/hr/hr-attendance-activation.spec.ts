import { randomUUID } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import {
  attendanceForUse,
  inactiveAttendance,
} from './hr-attendance-activation';
import { HrService } from './hr.service';
import type { AuthenticatedActor } from '@nora/contracts';
const employeeId = randomUUID(),
  branchId = randomUUID();
const actor: AuthenticatedActor = {
  userId: randomUUID(),
  sessionId: 'session',
  branchIds: [branchId],
  permissions: ['hr.manage'],
};
function fixture(username = 'demo', closed = false) {
  const row = {
    id: randomUUID(),
    branchId,
    employeeId,
    section: 'time',
    tab: 'attendance',
    status: 'حاضر',
    values: ['Employee', '2026-11-08'],
    data: { workedMinutes: 480, firstIn: '2026-11-08T05:30:00Z' },
    version: 1,
  };
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    hrEmployee: {
      findFirst: vi
        .fn()
        .mockResolvedValue({ id: employeeId, branchId, name: 'Employee' }),
    },
    hrRecord: {
      findMany: vi.fn(async ({ where }) =>
        where.tab === 'periods'
          ? closed
            ? [{ values: ['', '2026-11-08', '2026-11-09'] }]
            : []
          : [row],
      ),
      update: vi.fn(async ({ data }) =>
        Object.assign(row, data, { version: row.version + 1 }),
      ),
      create: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(row),
    },
    hrCommand: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
    hrAuditEvent: { create: vi.fn() },
    hrNotification: { create: vi.fn() },
  };
  const service = new HrService(
    {
      client: {
        $transaction: async (work: (tx: unknown) => unknown) => work(tx),
      },
    } as never,
    {
      describeMessagingParticipants: async () => [
        { id: actor.userId, username },
      ],
    } as never,
    {} as never,
    {} as never,
  );
  const change = (active: boolean, extra = {}) =>
    service.setAttendanceActivation(
      {
        employeeIds: [employeeId],
        from: '2026-11-08',
        to: '2026-11-08',
        active,
        ...extra,
      },
      randomUUID(),
      actor,
    );
  return { row, tx, change, service };
}
it('retains raw metrics while disabling and restoring the day, with audit', async () => {
  const f = fixture();
  await f.change(false);
  expect(inactiveAttendance(f.row)).toBe(true);
  expect(f.row.data.workedMinutes).toBe(480);
  await f.change(true);
  expect(f.row.status).toBe('حاضر');
  expect(inactiveAttendance(f.row)).toBe(false);
  expect(f.tx.hrAuditEvent.create).toHaveBeenCalledTimes(2);
  expect(
    f.tx.hrRecord.update.mock.calls.every(([q]) => q.where.id === f.row.id),
  ).toBe(true);
});
it('denies ordinary accounts before touching attendance', async () => {
  const f = fixture('other');
  await expect(f.change(false)).rejects.toThrow('ویرایش دستی');
  expect(f.tx.hrRecord.update).not.toHaveBeenCalled();
});
it('denies closed periods and stale versions', async () => {
  const closed = fixture('nima', true);
  await expect(closed.change(false)).rejects.toThrow('بسته');
  const f = fixture();
  await expect(
    f.change(false, { recordId: f.row.id, version: 2 }),
  ).rejects.toThrow('نسخه');
  expect(f.tx.hrRecord.update).not.toHaveBeenCalled();
});
it('validates ranges and does not admit employees outside the authorized scope', async () => {
  const f = fixture();
  await expect(f.change(false, { to: '2026-11-07' })).rejects.toThrow('بازه');
  f.tx.hrEmployee.findFirst.mockResolvedValue(null as never);
  await expect(f.change(false)).rejects.toThrow();
  expect(f.tx.hrRecord.update).not.toHaveBeenCalled();
});
it('excludes only matching employee/date punches and attendance from consumers', () => {
  const row = fixture().row;
  const rows = [
    { ...row, status: 'غیرفعال' },
    { ...row, id: 'punch', tab: 'checkins' },
    { ...row, id: 'other-person', employeeId: randomUUID() },
    { ...row, id: 'other-date', values: ['', '2026-11-09'] },
  ];
  expect(attendanceForUse(rows).map((r) => r.id)).toEqual([
    'other-person',
    'other-date',
  ]);
  expect(rows).toHaveLength(4);
});
it('never charges a daily penalty for an excluded record', async () => {
  const f = fixture();
  await expect(
    (
      f.service as unknown as { dailyPenalty: (r: unknown) => Promise<unknown> }
    ).dailyPenalty({ ...f.row, status: 'غیرفعال' }),
  ).resolves.toBeNull();
});
