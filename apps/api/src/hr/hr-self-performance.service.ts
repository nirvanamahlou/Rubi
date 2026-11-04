import { attendanceFrom } from './hr-attendance-range';
import { resolveDeviceDirections } from './hr-device-attendance.domain';
import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  getHrResource,
  type AuthenticatedActor,
  type WorkbenchHrPerformanceV1,
  type WorkbenchHrPerformanceRecordV1,
} from '@nora/contracts';
import type { Prisma } from '@nora/database';
import { DatabaseService } from '../database/database.service';
import { HrService } from './hr.service';
import {
  APPROVED,
  digits,
  localClockParts,
  localClockToUtc,
} from './hr.validation';

/** Public HR projection; broad HR permissions never widen the subject beyond self. */
@Injectable()
export class HrSelfPerformanceService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(HrService) private readonly hr: HrService,
  ) {}

  async activity(actor: AuthenticatedActor, from: string, to: string) {
    if (
      !actor.permissions.some((p) =>
        ['hr.self', 'hr.read', 'hr.manage', 'hr.team'].includes(p),
      )
    )
      throw new ForbiddenException('مجوز منابع انسانی وجود ندارد.');
    const rows = await this.database.client.hrAuditEvent.findMany({
      where: {
        actorId: actor.userId,
        branchId: { in: actor.branchIds },
        createdAt: { gte: new Date(from), lte: new Date(to) },
        NOT: { action: { endsWith: '.read' } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 100,
      select: { id: true, action: true, createdAt: true },
    });
    return rows.map((row) => ({
      id: row.id,
      action: `hr.${row.action}`,
      entityType: 'HrRecord',
      entityId: null,
      occurredAt: row.createdAt.toISOString(),
    }));
  }

  async get(
    actor: AuthenticatedActor,
    windowDays?: number,
    allowOwnAttendance = false,
  ): Promise<WorkbenchHrPerformanceV1> {
    const canReadHr = actor.permissions.some((p) =>
      ['hr.self', 'hr.read', 'hr.manage', 'hr.team'].includes(p),
    );
    if (
      !allowOwnAttendance &&
      !actor.permissions.some((p) =>
        ['hr.self', 'hr.read', 'hr.manage', 'hr.team'].includes(p),
      )
    )
      throw new ForbiddenException(
        'مجوز مشاهده اطلاعات منابع انسانی وجود ندارد.',
      );
    const employee = await this.database.client.hrEmployee.findFirst({
      where: {
        userId: actor.userId,
        branchId: { in: actor.branchIds },
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        personnelCode: true,
        unit: true,
        position: true,
      },
    });
    const payslipVisible =
      canReadHr &&
      (actor.permissions.includes('hr.self') ||
        actor.permissions.includes('hr.sensitive'));
    if (!employee)
      return {
        employee: null,
        leaves: [],
        shifts: [],
        leaveBalances: [],
        leaveYear: null,
        payslipVisible,
        latestPayslip: null,
      };
    const scope = {
      employeeId: employee.id,
      employee: { userId: actor.userId, deletedAt: null },
      branchId: { in: actor.branchIds },
      deletedAt: null,
    };
    const today = localClockParts(new Date()).date;
    const monthFormat = new Intl.DateTimeFormat('en-US-u-ca-persian', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: '2-digit',
    });
    const currentMonth = monthFormat.format(new Date());
    // At most 31 calendar days; derive the Gregorian lower bound without a new calendar dependency.
    let monthStart = new Date(`${today}T12:00:00Z`);
    while (
      monthFormat.format(new Date(monthStart.getTime() - 86400000)) ===
      currentMonth
    )
      monthStart = new Date(monthStart.getTime() - 86400000);
    const requestedFromDate =
      windowDays === undefined
        ? monthStart.toISOString().slice(0, 10)
        : new Date(
            new Date(`${today}T12:00:00Z`).getTime() -
              (windowDays - 1) * 86400000,
          )
            .toISOString()
            .slice(0, 10);
    const fromDate = attendanceFrom(requestedFromDate);
    const monthlyRows = await this.database.client.hrRecord.findMany({
      where: {
        ...scope,
        section: 'time',
        tab: 'attendance',
        AND: [
          { values: { path: ['1'], gte: fromDate } },
          { values: { path: ['1'], lte: today } },
        ],
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      take: 1001,
    });
    if (monthlyRows.length > 1000)
      throw new Error('Monthly attendance limit exceeded');
    // One latest reviewed calculation per day; do not double-count superseded rows.
    const days = new Map<string, Record<string, unknown>>();
    for (const row of monthlyRows) {
      const day = (row.values as string[])[1];
      if (day && !days.has(day))
        days.set(
          day,
          ['حاضر', 'غایب', 'مرخصی'].includes(row.status) ||
            (typeof (row.data as Record<string, unknown> | null)?.firstIn ===
              'string' &&
              Number.isFinite(
                Date.parse(
                  String((row.data as Record<string, unknown>).firstIn),
                ),
              ))
            ? ((row.data ?? {}) as Record<string, unknown>)
            : {},
        );
    }
    const total = (key: string) => {
      const values = [...days.values()]
        .map((day) => day[key])
        .filter(
          (value): value is number =>
            typeof value === 'number' &&
            Number.isSafeInteger(value) &&
            value >= 0,
        );
      return values.length
        ? values.reduce((sum, value) => sum + value, 0)
        : null;
    };
    const [leaves, shifts, payslips, balances, approvedLeaveCount, punches] =
      await Promise.all([
        canReadHr
          ? this.database.client.hrRecord.findMany({
              where: {
                ...scope,
                OR: [
                  { section: 'time', tab: 'leave' },
                  { section: 'requests', tab: { in: ['leave', 'radanLeave'] } },
                ],
              },
              orderBy: [
                { effectiveAt: { sort: 'desc', nulls: 'last' } },
                { createdAt: 'desc' },
                { id: 'asc' },
              ],
              take: 10,
            })
          : Promise.resolve([]),
        canReadHr || allowOwnAttendance
          ? this.database.client.hrRecord.findMany({
              where: {
                ...scope,
                OR: [
                  { section: 'time', tab: 'shift' },
                  { section: 'employee', tab: 'shift' },
                  { section: 'time', tab: 'roster' },
                ],
              },
              orderBy: [
                { effectiveAt: { sort: 'desc', nulls: 'last' } },
                { createdAt: 'desc' },
                { id: 'asc' },
              ],
              take: 10,
            })
          : Promise.resolve([]),
        payslipVisible
          ? this.database.client.hrRecord.findMany({
              where: {
                ...scope,
                section: 'payroll',
                tab: 'payslips',
                status: { in: [...APPROVED] },
              },
              orderBy: [
                { effectiveAt: { sort: 'desc', nulls: 'last' } },
                { createdAt: 'desc' },
                { id: 'asc' },
              ],
              take: 1,
            })
          : Promise.resolve([]),
        canReadHr
          ? this.hr.leaveBalances({ employeeId: employee.id }, actor)
          : Promise.resolve({ items: [], year: null }),
        canReadHr
          ? this.database.client.hrRecord.count({
              where: {
                ...scope,
                status: { in: [...APPROVED] },
                AND: [
                  { values: { path: ['2'], lte: today } },
                  { values: { path: ['3'], gte: fromDate } },
                ],
                OR: [
                  { section: 'time', tab: 'leave' },
                  { section: 'requests', tab: { in: ['leave', 'radanLeave'] } },
                ],
              },
            })
          : Promise.resolve(0),
        this.database.client.hrRecord.findMany({
          where: {
            ...scope,
            section: 'time',
            tab: 'checkins',
            values: { path: ['1'], equals: today },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          take: 201,
        }),
      ]);
    if (punches.length > 200)
      throw new Error('Daily attendance limit exceeded');
    // An approved correction replaces the day's original punches, as in HR attendance.
    const correction = punches.find((row) => row.parentId != null);
    const selected = correction
      ? punches.filter((row) => row.parentId === correction.parentId)
      : punches;
    const resolved = resolveDeviceDirections(
      selected.flatMap((row) => {
        const v = row.values as string[];
        if (!/^\d{2}:\d{2}$/.test(digits(v[2] ?? ''))) return [];
        return [{ kind: v[3]!, at: localClockToUtc(today, digits(v[2]!)) }];
      }),
    );
    const times = (kind: string) =>
      resolved
        .filter((e) => e.kind === kind)
        .map((e) => localClockParts(e.at).time)
        .sort();
    return {
      monthlyAttendance: {
        period:
          windowDays === undefined
            ? new Intl.DateTimeFormat('fa-IR', {
                timeZone: 'Asia/Tehran',
                month: 'long',
                year: 'numeric',
              }).format(new Date())
            : `${fromDate} — ${today}`,
        lateMinutes: total('lateMinutes'),
        overtimeMinutes: total('overtimeMinutes'),
        deficitMinutes: total('deficitMinutes'),
      },
      approvedLeaveCount,
      attendanceHistory: [
        ...new Map(
          monthlyRows
            .slice()
            .reverse()
            .map((row) => [(row.values as string[])[1]!, row]),
        ).entries(),
      ]
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([date, row]) => {
          const data = (row.data ?? {}) as Record<string, unknown>;
          const minutes = (key: string) =>
            typeof data[key] === 'number' &&
            Number.isSafeInteger(data[key]) &&
            data[key] >= 0
              ? (data[key] as number)
              : null;
          const clock = (key: string) =>
            typeof data[key] === 'string' &&
            Number.isFinite(Date.parse(data[key]))
              ? localClockParts(new Date(data[key])).time
              : null;
          return {
            date,
            firstIn: clock('firstIn'),
            lastOut: clock('lastOut'),
            registrationType:
              data.registrationType === 'manual' ||
              data.registrationType === 'device'
                ? data.registrationType
                : null,
            lateMinutes: minutes('lateMinutes'),
            overtimeMinutes: minutes('overtimeMinutes'),
            deficitMinutes: minutes('deficitMinutes'),
          };
        }),
      todayAttendance: {
        date: today,
        firstIn: times('ورود')[0] ?? null,
        lastOut: times('خروج').at(-1) ?? null,
      },
      employee: {
        name: employee.name,
        personnelCode: employee.personnelCode,
        unit: employee.unit,
        position: employee.position,
      },
      leaves: leaves.map(projectRecord),
      shifts: shifts.map(projectRecord),
      leaveBalances: balances.items,
      leaveYear: balances.year,
      payslipVisible,
      latestPayslip: payslips[0] ? projectRecord(payslips[0]) : null,
    };
  }
}

function projectRecord(
  row: Prisma.HrRecordGetPayload<null>,
): WorkbenchHrPerformanceRecordV1 {
  const schema = getHrResource(row.section, row.tab);
  const values = row.values as string[];
  const fields = (schema?.columns ?? []).map((label, index) => ({
    label,
    value: values[index] ?? '—',
  }));
  const currency = (row.data as { currency?: string } | null)?.currency;
  if (row.section === 'payroll' && currency)
    fields.push({ label: 'ارز', value: currency });
  // No workflow payload, bank/account details or third-party employee metadata.
  return {
    id: row.id,
    status: row.status,
    fields,
    updatedAt: row.updatedAt.toISOString(),
  };
}
