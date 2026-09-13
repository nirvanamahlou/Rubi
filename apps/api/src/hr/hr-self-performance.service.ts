import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  getHrResource,
  type AuthenticatedActor,
  type WorkbenchHrPerformanceV1,
  type WorkbenchHrPerformanceRecordV1,
} from '@rubi/contracts';
import type { Prisma } from '@rubi/database';
import { DatabaseService } from '../database/database.service';
import { HrService } from './hr.service';
import { APPROVED } from './hr.validation';

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
    const [leaves, shifts, payslips, balances] = await Promise.all([
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
    ]);
    return {
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
