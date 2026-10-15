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
import { APPROVED, digits, localClockParts } from './hr.validation';

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

  async get(actor: AuthenticatedActor): Promise<WorkbenchHrPerformanceV1> {
    if (
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
      actor.permissions.includes('hr.self') ||
      actor.permissions.includes('hr.sensitive');
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
    const fromDate = monthStart.toISOString().slice(0, 10);
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
          row.status === 'حاضر'
            ? ((row.data ?? {}) as Record<string, unknown>)
            : {},
        );
    }
    const total = (key: string) => {
      const values = [...days.values()].map((day) => day[key]);
      return values.length &&
        values.every(
          (value) =>
            typeof value === 'number' &&
            Number.isSafeInteger(value) &&
            value >= 0,
        )
        ? (values as number[]).reduce((sum, value) => sum + value, 0)
        : null;
    };
    const [leaves, shifts, payslips, balances, approvedLeaveCount, punches] =
      await Promise.all([
        this.database.client.hrRecord.findMany({
          where: {
            ...scope,
            OR: [
              { section: 'time', tab: 'leave' },
              { section: 'requests', tab: 'leave' },
            ],
          },
          orderBy: [
            { effectiveAt: { sort: 'desc', nulls: 'last' } },
            { createdAt: 'desc' },
            { id: 'asc' },
          ],
          take: 10,
        }),
        this.database.client.hrRecord.findMany({
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
        }),
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
        this.hr.leaveBalances({ employeeId: employee.id }, actor),
        this.database.client.hrRecord.count({
          where: {
            ...scope,
            status: { in: [...APPROVED] },
            OR: [
              { section: 'time', tab: 'leave' },
              { section: 'requests', tab: 'leave' },
            ],
          },
        }),
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
    const times = (kind: string) =>
      selected
        .map((row) => row.values as string[])
        .filter(
          (values) =>
            values[3] === kind && /^\d{2}:\d{2}$/.test(digits(values[2] ?? '')),
        )
        .map((values) => digits(values[2]!))
        .sort();
    return {
      monthlyAttendance: {
        period: new Intl.DateTimeFormat('fa-IR', {
          timeZone: 'Asia/Tehran',
          month: 'long',
          year: 'numeric',
        }).format(new Date()),
        lateMinutes: total('lateMinutes'),
        overtimeMinutes: total('overtimeMinutes'),
      },
      approvedLeaveCount,
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
