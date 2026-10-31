import { describe, expect, it, vi } from 'vitest';
import {
  buildDashboardCharts,
  dashboardPeriods,
  type DashboardEmployee,
  type DashboardRecord,
} from './hr-dashboard.domain';
import { HrService } from './hr.service';
import type { AuthenticatedActor } from '@nora/contracts';

const now = new Date('2026-10-25T12:00:00Z');
const employee: DashboardEmployee = {
  id: 'e',
  name: 'همکار',
  unit: 'مالی',
  branchId: 'a',
  organizationBranchId: null,
  company: 'الف',
};
function row(
  tab: string,
  values: string[],
  data: object = {},
  extra: Partial<DashboardRecord> = {},
): DashboardRecord {
  return {
    id: 'r',
    employeeId: 'e',
    section: 'time',
    tab,
    values,
    data,
    status: 'تأییدشده',
    createdAt: new Date('2026-10-25T08:00:00Z'),
    ...extra,
  };
}
const chart = (
  records: DashboardRecord[],
  id: string,
  employees = [employee],
) =>
  buildDashboardCharts(employees, records, [], now).charts.find(
    (c) => c.id === id,
  )!;
describe('HR dashboard calendar and actual aggregates', () => {
  it('uses Tehran day and complete previous Persian season, month and year', () => {
    expect(dashboardPeriods(now)).toMatchObject({
      today: '2026-10-25',
      month: '2026-10-23',
      year: '2026-03-21',
      jalaliYear: 1405,
      quarterFrom: '2026-06-22',
      quarterTo: '2026-09-22',
      week: '2026-10-19',
    });
    expect(dashboardPeriods(new Date('2026-10-24T21:00:00Z')).today).toBe(
      '2026-10-25',
    );
    expect(dashboardPeriods(new Date('2026-03-21T12:00:00Z'))).toMatchObject({
      quarterFrom: '2025-12-22',
      quarterTo: '2026-03-20',
      year: '2026-03-21',
    });
  });
  it('deduplicates attendance per employee/day and prefers the newest calculation', () => {
    const records = [
      row(
        'attendance',
        ['', '2026-10-25', '', '08:30', '9'],
        {},
        { id: 'old', createdAt: new Date('2026-10-24') },
      ),
      row('attendance', ['', '2026-10-25'], {
        workedMinutes: 120,
        lateMinutes: 7,
        overtimeMinutes: 90,
      }),
      row(
        'attendance',
        ['', '2026-10-25'],
        { workedMinutes: 500 },
        { employeeId: 'outside' },
      ),
    ];
    expect(chart(records, 'present').points.at(-1)?.value).toBe(1);
    expect(chart(records, 'weeklyAttendance').points[0]?.value).toBe(2);
    expect(chart(records, 'overtime').points[0]?.value).toBe(1.5);
    expect(chart(records, 'departmentLate').points[0]?.value).toBe(7);
  });
  it('uses the most recently updated calculation when legacy duplicate rows exist', () => {
    const rows = [
      row(
        'attendance',
        ['', '2026-10-25'],
        { workedMinutes: 60 },
        { id: 'new', createdAt: new Date('2026-10-25T01:00:00Z') },
      ),
      row(
        'attendance',
        ['', '2026-10-25'],
        { workedMinutes: 180 },
        {
          id: 'old',
          createdAt: new Date('2026-10-24'),
          updatedAt: new Date('2026-10-25T02:00:00Z'),
        },
      ),
    ];
    expect(chart(rows, 'weeklyAttendance').points[0]?.value).toBe(3);
    expect(chart(rows, 'present').points.at(-1)?.value).toBe(1);
  });
  it('uses legacy HH:mm and keeps uncomputed or malformed metrics finite', () => {
    const records = [
      row('attendance', ['', '2026-10-25', '', '08:30', '—'], {
        overtimeMinutes: 'NaN',
      }),
    ];
    expect(chart(records, 'weeklyAttendance').points[0]?.value).toBe(8.5);
    expect(chart(records, 'departmentLate').points[0]?.value).toBe(0);
    expect(chart(records, 'overtime').points[0]?.value).toBe(0);
  });
  it('limits weekly/month/season metrics to business dates, including exact boundaries', () => {
    const records = [
      '2026-06-21',
      '2026-06-22',
      '2026-09-22',
      '2026-09-23',
      '2026-10-18',
      '2026-10-19',
      '2026-10-22',
      '2026-10-23',
      '2026-10-26',
    ].map((d, i) =>
      row(
        'attendance',
        ['', d],
        { workedMinutes: 60, lateMinutes: 10, overtimeMinutes: 60 },
        { id: String(i) },
      ),
    );
    expect(
      chart(records, 'quarterLate').points.reduce((s, x) => s + x.value, 0),
    ).toBe(20);
    expect(chart(records, 'weeklyAttendance').points[0]?.value).toBe(3);
    expect(chart(records, 'overtime').points[0]?.value).toBe(1);
  });
  it('counts approved overlapping leaves once and excludes canceled/outside requests', () => {
    const records = [
      row('leave', ['', '', '2026-06-20', '2026-06-22']),
      row(
        'radanLeave',
        ['', '', '2026-09-22', '2026-09-23'],
        {},
        { id: 'b', section: 'requests', status: 'تاییدشده' },
      ),
      row(
        'leave',
        ['', '', '2026-07-01', '2026-07-02'],
        {},
        { id: 'c', status: 'لغوشده' },
      ),
      row('leave', ['', '', '2026-09-23', '2026-09-23'], {}, { id: 'd' }),
    ];
    expect(chart(records, 'leave').points[0]?.value).toBe(2);
  });
  it('retains negative/reversed minute balances, excludes future grants and separates native day units', () => {
    const records = [
      row('minuteLedger', ['', '1405', '1', '', 'سهمیه', '600']),
      row('minuteLedger', ['', '1405', '8', '', 'مصرف', '-120']),
      row('minuteLedger', ['', '1405', '9', '', 'سهمیه', '600']),
      row('minuteLedger', ['', '1404', '12', '', 'سهمیه', '600']),
    ];
    const balance = buildDashboardCharts(
      [employee],
      records,
      [
        {
          employeeId: 'e',
          year: 2026,
          days: { toString: () => '2.5' },
          createdAt: now,
        },
      ],
      now,
    ).charts.at(-1)!;
    expect(balance.points.map((p) => [p.value, p.unit])).toEqual([
      [8, 'ساعت'],
      [2.5, 'روز'],
    ]);
    expect(
      chart(
        [row('minuteLedger', ['', '1405', '1', '', 'مصرف', '-60'])],
        'leaveBalance',
      ).points[0]?.value,
    ).toBe(-1);
  });
  it('keeps identically named departments in separate companies distinct', () => {
    const result = chart([], 'overtime', [
      employee,
      { ...employee, id: 'f', branchId: 'b', company: 'ب' },
    ]);
    expect(result.points.map((p) => p.label)).toEqual([
      'مالی / الف',
      'مالی / ب',
    ]);
    expect(result.points[0]?.key).not.toBe(result.points[1]?.key);
  });
  it('returns seven charts and real zero/empty states without invented attendance', () => {
    const result = buildDashboardCharts([], [], [], now);
    expect(result.charts).toHaveLength(7);
    expect(result.charts[0]?.points).toHaveLength(30);
    expect(
      result.charts.every((c) => c.points.every((p) => p.value === 0)),
    ).toBe(true);
  });
});
describe('HR dashboard read scope and completeness', () => {
  const actor = {
    userId: 'u',
    branchIds: ['a'],
    permissions: ['hr.self'],
  } as unknown as AuthenticatedActor;
  function setup(employeeRows: DashboardEmployee[] = [employee]) {
    const client = {
      hrEmployee: { findMany: vi.fn().mockResolvedValue(employeeRows) },
      hrRecord: { findMany: vi.fn().mockResolvedValue([]) },
      hrLeaveEntry: { findMany: vi.fn().mockResolvedValue([]) },
      $transaction: vi.fn(),
    };
    client.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
      fn(client),
    );
    const service = new HrService(
      { client } as never,
      {
        listRolesAndBranches: vi
          .fn()
          .mockResolvedValue({ branches: [{ id: 'a', name: 'الف' }] }),
      } as never,
      {} as never,
      {} as never,
    );
    // Native permission/scope is retained; only audit persistence is isolated in this unit test.
    vi.spyOn(
      service as unknown as { auditRead: () => Promise<void> },
      'auditRead',
    ).mockResolvedValue(undefined);
    return { service, client };
  }
  it('intersects employee scope with record scope and never uses bootstrap limits', async () => {
    const { service, client } = setup([
      { ...employee, branch: { name: 'الف' } } as DashboardEmployee,
    ]);
    await service.dashboardCharts({}, actor);
    expect(JSON.stringify(client.hrEmployee.findMany.mock.calls)).toContain(
      'u',
    );
    expect(JSON.stringify(client.hrRecord.findMany.mock.calls)).toContain(
      'employeeId',
    );
    expect(
      client.hrRecord.findMany.mock.calls[0]?.[0].where.AND[1].employeeId.in,
    ).toEqual(['e']);
    expect(client.hrRecord.findMany.mock.calls[0]?.[0].take).toBe(100001);
    expect(client.$transaction.mock.calls[0]?.[1].isolationLevel).toBe(
      'RepeatableRead',
    );
  });
  it('rejects malformed filters and explicit overflow instead of showing partial totals', async () => {
    const { service } = setup(Array.from({ length: 10001 }, () => employee));
    await expect(service.dashboardCharts({}, actor)).rejects.toThrow(
      'حجم گزارش',
    );
    await expect(
      service.dashboardCharts({ organizationBranchId: 'invalid' }, actor),
    ).rejects.toThrow();
    await expect(
      service.dashboardCharts({ from: '2026-01-01' }, actor),
    ).rejects.toThrow();
  });
  it('denies an actor with no HR permission', async () => {
    const { service } = setup();
    await expect(
      service.dashboardCharts({}, { ...actor, permissions: [] }),
    ).rejects.toThrow();
  });
});
