import { isHrSharedResource, hrBranchKey } from '@nora/contracts';
import { buildDashboardCharts, dashboardPeriods } from './hr-dashboard.domain';
import { configuredAttendance } from './hr-attendance-settings';
import { readPayslipWorkbook } from './hr-payslip-import';
import {
  privateHrResource,
  privateCommandFingerprint,
  protectHrValues,
  revealHrValues,
  publicHrData,
} from './hr-private-values';
import {
  assertTemplateIntervals,
  durationMinutes,
  jalaliYear,
  selection,
  transferSplit,
  validateCompletionValues,
} from './hr-radan-completion.domain';
import { HR_RADAN_REQUEST_TYPES } from '@nora/contracts';
import { isOptionalOperationReason } from '@nora/contracts';
import { createHash, randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  HR_RESOURCE_KEYS,
  getHrResource,
  type AuthenticatedActor,
  type HrBootstrapDto,
  type HrEmployeeDto,
  type HrRecordDto,
  type HrResourceDefinition,
  type HrWorkflowData,
  type IamPermissionCode,
} from '@nora/contracts';
import { Prisma } from '@nora/database';

import { DatabaseService } from '../database/database.service';
import { DocumentsService } from '../documents/documents.service';
import { IamService } from '../iam/iam.service';
import * as validate from './hr.validation';
import { HrDirectoryService } from './hr-directory.service';

type Tx = Prisma.TransactionClient;
type Employee = Prisma.HrEmployeeGetPayload<null>;
type RecordRow = Prisma.HrRecordGetPayload<null>;
type AssignmentLabels = {
  ownEmployeeId?: string | undefined;
  branches: Map<string, string>;
  managers: Map<string, string>;
};
const employeeExtensionProjection = {
  where: { section: 'employee', tab: 'internalContact', deletedAt: null },
  select: { values: true },
  take: 1,
} as const;
const employeeKeys = [
  'jobTitleId',
  'extension',
  'identityValues',
  'contactValues',
  'firstName',
  'lastName',
  'groupId',
  'branchId',
  'userId',
  'photoDocumentId',
  'organizationBranchId',
  'personnelCode',
  'name',
  'kind',
  'unit',
  'position',
  'grade',
  'managerId',
  'startedAtValue',
  'status',
];
const recordKeys = [
  'privateData',
  'branchId',
  'section',
  'tab',
  'employeeId',
  'parentId',
  'values',
  'status',
  'effectiveAt',
  'data',
];
const systemResources = new Set([
  'time.periods',
  'time.leaveGrants',
  'time.minuteLedger',
  'payroll.importedPayslips',
]);
const missionExpenseResources = new Set([
  'expenses.travel',
  'expenses.advances',
  'expenses.claims',
]);
const jobResources = new Set([
  'lifecycle.promotion',
  'lifecycle.transfer',
  'lifecycle.separation',
]);
const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

@Injectable()
export class HrService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(IamService) private readonly iam: IamService,
    @Inject(DocumentsService) private readonly documents: DocumentsService,
    @Inject(HrDirectoryService) private readonly directory: HrDirectoryService,
  ) {}

  private expenseMission(
    parent: RecordRow | null,
    employee: Employee | null,
    data: HrWorkflowData,
  ) {
    if (!parent) return;
    if (
      !employee ||
      parent.employeeId !== employee.id ||
      parent.branchId !== employee.branchId ||
      !['time', 'expenses'].includes(parent.section) ||
      parent.tab !== 'mission'
    )
      throw new BadRequestException(
        'مأموریت مرجع باید متعلق به همین کارمند باشد.',
      );
    const missionCompany =
      (parent.data as HrWorkflowData).organizationBranchId ??
      employee.organizationBranchId;
    const expenseCompany =
      data.organizationBranchId ?? employee.organizationBranchId;
    if (missionCompany !== expenseCompany)
      throw new BadRequestException(
        'مأموریت مرجع باید متعلق به همین شرکت باشد.',
      );
  }

  private has(actor: AuthenticatedActor, permission: IamPermissionCode) {
    return actor.permissions.includes(permission);
  }
  private require(actor: AuthenticatedActor, permission: IamPermissionCode) {
    if (!this.has(actor, permission))
      throw new ForbiddenException(
        'مجوز منابع انسانی برای این عملیات وجود ندارد.',
      );
  }
  private readable(actor: AuthenticatedActor) {
    if (
      !['hr.read', 'hr.manage', 'hr.self', 'hr.team'].some((p) =>
        actor.permissions.includes(p as IamPermissionCode),
      )
    )
      throw new ForbiddenException('دسترسی منابع انسانی وجود ندارد.');
  }
  private branch(actor: AuthenticatedActor, requested?: unknown) {
    const id =
      requested === undefined
        ? actor.branchIds[0]
        : validate.uuid(requested, 'شعبه');
    if (!id || !actor.branchIds.includes(id))
      throw new ForbiddenException('شعبه در محدوده دسترسی شما نیست.');
    return id;
  }
  private employeeScope(
    actor: AuthenticatedActor,
  ): Prisma.HrEmployeeWhereInput {
    this.readable(actor);
    const base = { branchId: { in: actor.branchIds }, deletedAt: null };
    if (this.has(actor, 'hr.read') || this.has(actor, 'hr.manage')) return base;
    return {
      ...base,
      OR: [
        { userId: actor.userId },
        ...(this.has(actor, 'hr.team')
          ? [{ manager: { userId: actor.userId } }]
          : []),
      ],
    };
  }
  private recordScope(actor: AuthenticatedActor): Prisma.HrRecordWhereInput {
    this.readable(actor);
    return {
      section: { notIn: ['connections', 'payrollWorksheets'] },
      branchId: { in: actor.branchIds },
      deletedAt: null,
      ...(this.has(actor, 'hr.read') || this.has(actor, 'hr.manage')
        ? {}
        : {
            OR: [
              { employee: this.employeeScope(actor) },
              ...(this.has(actor, 'hr.approve')
                ? [
                    {
                      children: {
                        some: {
                          section: 'requests',
                          tab: 'approvalAssignments',
                          status: 'فعال',
                          deletedAt: null,
                          OR: [
                            {
                              employee: {
                                userId: actor.userId,
                                status: 'فعال',
                                deletedAt: null,
                              },
                            },
                            {
                              AND: [
                                { data: { path: ['senior'], equals: true } },
                                {
                                  employee: {
                                    manager: { userId: actor.userId },
                                    status: 'فعال',
                                    deletedAt: null,
                                  },
                                },
                              ],
                            },
                          ],
                        },
                      },
                    },
                  ]
                : []),
            ],
          }),
    };
  }
  private async employee(tx: Tx, id: string, actor: AuthenticatedActor) {
    const result = await tx.hrEmployee.findFirst({
      where: { AND: [this.employeeScope(actor), { id: validate.uuid(id) }] },
      include: {
        manager: { select: { name: true } },
        organizationBranch: true,
        records: employeeExtensionProjection,
      },
    });
    if (!result)
      throw new NotFoundException('کارمند در محدوده دسترسی پیدا نشد.');
    return result;
  }
  private async syncSharedReference(
    tx: Tx,
    row: RecordRow,
    actor: AuthenticatedActor,
  ) {
    const metadata = row.data as HrWorkflowData;
    if (!metadata.allBranches && !row.sharedSourceId) return;
    if (
      !isHrSharedResource(row.section, row.tab) ||
      row.employeeId ||
      privateHrResource(`${row.section}.${row.tab}`)
    )
      throw new BadRequestException('دامنه شعبه معتبر نیست.');
    const sourceId = row.sharedSourceId ?? row.id;
    if (row.parentId) {
      const parent = await tx.hrRecord.findUniqueOrThrow({
        where: { id: row.parentId },
      });
      if (
        (parent.data as HrWorkflowData).allBranches ||
        parent.sharedSourceId
      ) {
        const parentRoot = parent.sharedSourceId ?? parent.id;
        const parentMembers = await tx.hrRecord.findMany({
          where: {
            OR: [{ id: parentRoot }, { sharedSourceId: parentRoot }],
            deletedAt: null,
          },
        });
        if (parentMembers.some((m) => !actor.branchIds.includes(m.branchId)))
          throw new ForbiddenException(
            'ویرایش اطلاعات مشترک نیازمند دسترسی همه شعبه‌ها است.',
          );
      }
    }
    const members = await tx.hrRecord.findMany({
      where: {
        OR: [{ id: sourceId }, { sharedSourceId: sourceId }],
        deletedAt: null,
      },
    });
    if (members.some((m) => !actor.branchIds.includes(m.branchId)))
      throw new ForbiddenException(
        'ویرایش اطلاعات مشترک نیازمند دسترسی همه شعبه‌ها است.',
      );
    if (!metadata.allBranches)
      throw new ConflictException('دامنه اطلاعات مشترک تغییرپذیر نیست.');
    const branches = new Set([
      ...actor.branchIds,
      ...members.map((m) => m.branchId),
    ]);
    for (const branchId of branches) {
      if (branchId === row.branchId) continue;
      let parentId: string | null = null;
      if (row.parentId) {
        const parent = await tx.hrRecord.findUniqueOrThrow({
          where: { id: row.parentId },
        });
        const parentRoot = parent.sharedSourceId ?? parent.id;
        const local = await tx.hrRecord.findFirst({
          where: {
            branchId,
            deletedAt: null,
            OR: [{ id: parentRoot }, { sharedSourceId: parentRoot }],
          },
        });
        if (!local)
          throw new BadRequestException(
            'والد اطلاعات مشترک باید برای همه شعبه‌ها تعریف شده باشد.',
          );
        parentId = local.id;
      }
      const existing = members.find((m) => m.branchId === branchId);
      const content = {
        values: json(row.values),
        searchText: row.searchText,
        data: json(row.data),
        status: row.status,
        parentId,
        effectiveAt: row.effectiveAt,
        expiresAt: row.expiresAt,
      };
      const copy = existing
        ? await tx.hrRecord.update({
            where: { id: existing.id },
            data: { ...content, version: { increment: 1 } },
          })
        : await tx.hrRecord.create({
            data: {
              ...content,
              branchId,
              sharedSourceId: sourceId,
              section: row.section,
              tab: row.tab,
              code: `HRS-${randomUUID()}`,
            },
          });
      await this.audit(
        tx,
        actor,
        { branchId, recordId: copy.id },
        'reference.shared.sync',
        { sourceId },
        copy.version,
      );
    }
  }
  private async record(tx: Tx, id: string, actor: AuthenticatedActor) {
    const result = await tx.hrRecord.findFirst({
      where: { AND: [this.recordScope(actor), { id: validate.uuid(id) }] },
    });
    if (!result)
      throw new NotFoundException('رکورد در محدوده دسترسی پیدا نشد.');
    return result;
  }
  private employeeDto(
    row: Employee & {
      manager?: { name: string } | null;
      organizationBranch?: RecordRow | null;
      records?: { values: Prisma.JsonValue }[];
    },
  ): HrEmployeeDto {
    return {
      id: row.id,
      personnelCode: row.personnelCode,
      jobTitleId: row.jobTitleId,
      extension: String(
        (row.records?.[0]?.values as string[] | undefined)?.[0] ?? '',
      ),
      branchId: row.branchId,
      userId: row.userId,
      photoDocumentId: row.photoDocumentId,
      organizationBranchId: row.organizationBranchId,
      companyName: row.organizationBranch
        ? ((row.organizationBranch.values as string[])[0] ?? '')
        : '',
      name: row.name,
      kind: row.kind,
      unit: row.unit,
      position: row.position,
      grade: row.grade,
      managerId: row.managerId,
      manager: row.manager?.name ?? '',
      startedAtValue: row.startedAt.toISOString().slice(0, 10),
      status: row.status,
      version: row.version,
    };
  }
  private async assignmentLabels(
    rows: RecordRow[],
    actor: AuthenticatedActor,
  ): Promise<AssignmentLabels> {
    const ownEmployeeId = rows.some(
      (r) => r.section === 'payroll' && r.tab === 'importedPayslips',
    )
      ? (
          await this.database.client.hrEmployee.findFirst({
            where: {
              userId: actor.userId,
              branchId: { in: actor.branchIds },
              deletedAt: null,
            },
            select: { id: true },
          })
        )?.id
      : undefined;
    const assignments = rows.filter(
      (row) => row.section === 'employee' && row.tab === 'assignment',
    );
    if (!assignments.length)
      return { branches: new Map(), managers: new Map(), ownEmployeeId };
    const ids = assignments
      .map((row) => (row.values as string[])[3]!)
      .filter((id) => /^[a-f0-9-]{36}$/i.test(id));
    const [options, managers] = await Promise.all([
      this.iam.listRolesAndBranches(),
      this.database.client.hrEmployee.findMany({
        where: { id: { in: ids }, branchId: { in: actor.branchIds } },
        select: { id: true, name: true },
      }),
    ]);
    return {
      ownEmployeeId,
      branches: new Map(options.branches.map((item) => [item.id, item.name])),
      managers: new Map(managers.map((item) => [item.id, item.name])),
    };
  }
  private async recordDtos(rows: RecordRow[], actor: AuthenticatedActor) {
    const labels = await this.assignmentLabels(rows, actor);
    return Promise.all(rows.map((row) => this.recordDto(row, actor, labels)));
  }
  private async recordDto(
    row: RecordRow,
    actor: AuthenticatedActor,
    display?: AssignmentLabels,
  ): Promise<HrRecordDto> {
    const schema = validate.resource(row.section, row.tab);
    const ownSlip =
      schema.key === 'payroll.importedPayslips' &&
      row.employeeId ===
        (display ?? (await this.assignmentLabels([row], actor))).ownEmployeeId;
    const sensitive =
      schema.sensitive && !this.has(actor, 'hr.sensitive') && !ownSlip;
    const values = schema.columns.map(
      (_, index) => (row.values as string[])[index] ?? '',
    );
    if (privateHrResource(schema.key) && !sensitive) {
      values.splice(
        0,
        values.length,
        ...revealHrValues(
          row.data,
          `${row.branchId}:${row.employeeId ?? row.parentId}:${schema.key}`,
        ),
      );
    }
    if (schema.key === 'employee.assignment') {
      const labels = display ?? (await this.assignmentLabels([row], actor));
      values[0] = labels.branches.get(values[0]!) ?? values[0]!;
      const managerId = values[3];
      if (managerId && /^[a-f0-9-]{36}$/i.test(managerId)) {
        values[3] = labels.managers.get(managerId) ?? 'مدیر پیشین';
      }
    }
    if ((row.data as HrWorkflowData).allBranches)
      schema.columns.forEach((label, index) => {
        if (['شعبه', 'شرکت'].includes(label)) values[index] = 'دفتر مرکزی';
      });
    return {
      id: row.id,
      code: row.code,
      branchId: row.branchId,
      section: row.section,
      tab: row.tab,
      employeeId: row.employeeId,
      parentId: row.parentId,
      jobTitleId: row.jobTitleId,
      columns: [...schema.columns],
      values: sensitive ? schema.columns.map(() => '••••') : values,
      status: row.status,
      version: row.version,
      effectiveAt: row.effectiveAt?.toISOString().slice(0, 10) ?? null,
      appliedAt: row.appliedAt?.toISOString() ?? null,
      deletedAt: row.deletedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      data: sensitive ? {} : (publicHrData(row.data) as HrWorkflowData),
    };
  }
  async dashboardCharts(
    input: Record<string, unknown>,
    actor: AuthenticatedActor,
  ) {
    this.readable(actor);
    validate.object(input, ['organizationBranchId', 'unit']);
    const organizationBranchId = input.organizationBranchId
      ? validate.uuid(input.organizationBranchId)
      : undefined;
    const unit = input.unit
      ? validate.text(input.unit, 'واحد', 200)
      : undefined;
    const branchNames = new Map(
      (await this.iam.listRolesAndBranches()).branches.map((branch) => [
        branch.id,
        branch.name,
      ]),
    );
    const now = new Date();
    const periods = dashboardPeriods(now);
    const result = await this.database.client.$transaction(
      async (tx) => {
        const employees = await tx.hrEmployee.findMany({
          where: {
            AND: [
              this.employeeScope(actor),
              {
                ...(organizationBranchId ? { organizationBranchId } : {}),
                ...(unit ? { unit } : {}),
              },
            ],
          },
          select: {
            id: true,
            name: true,
            unit: true,
            branchId: true,
            organizationBranchId: true,
            organizationBranch: { select: { values: true } },
          },
          orderBy: { id: 'asc' },
          take: 10001,
        });
        if (employees.length > 10000)
          throw new ConflictException('حجم گزارش بیش از حد مجاز است.');
        const ids = employees.map((e) => e.id);
        const [records, entries] = await Promise.all([
          tx.hrRecord.findMany({
            where: {
              AND: [
                this.recordScope(actor),
                {
                  employeeId: { in: ids },
                  OR: [
                    {
                      section: 'time',
                      tab: 'attendance',
                      OR: [
                        {
                          effectiveAt: {
                            gte: validate.isoDate(periods.quarterFrom),
                            lte: validate.isoDate(periods.today),
                          },
                        },
                        { effectiveAt: null },
                      ],
                    },
                    {
                      section: { in: ['time', 'requests'] },
                      tab: { in: ['leave', 'radanLeave'] },
                    },
                    { section: 'time', tab: 'minuteLedger' },
                  ],
                },
              ],
            },
            select: {
              id: true,
              employeeId: true,
              section: true,
              tab: true,
              values: true,
              data: true,
              status: true,
              createdAt: true,
              updatedAt: true,
            },
            take: 100001,
          }),
          tx.hrLeaveEntry.findMany({
            where: {
              employeeId: { in: ids },
              year: Number(periods.today.slice(0, 4)),
              createdAt: { lte: now },
            },
            select: {
              employeeId: true,
              year: true,
              days: true,
              createdAt: true,
            },
            take: 100001,
          }),
        ]);
        if (records.length > 100000 || entries.length > 100000)
          throw new ConflictException('حجم گزارش بیش از حد مجاز است.');
        return buildDashboardCharts(
          employees.map((e) => ({
            ...e,
            company:
              (e.organizationBranch?.values as string[] | undefined)?.[0] ||
              branchNames.get(e.branchId) ||
              'شعبه',
          })),
          records,
          entries,
          now,
        );
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 30000,
      },
    );
    await this.auditRead(
      actor,
      'dashboard.charts',
      result.charts.reduce((sum, chart) => sum + chart.points.length, 0),
    );
    return result;
  }
  async bootstrap(actor: AuthenticatedActor): Promise<HrBootstrapDto> {
    this.readable(actor);
    // An authorized HR read advances already approved, due changes transactionally.
    // No new decision is made here; appliedAt prevents replay on refresh.
    const workflowWarnings =
      this.has(actor, 'hr.manage') && this.has(actor, 'hr.approve')
        ? await this.applyDue(actor)
        : [];
    const [employees, records, recordCount, options, jobTitles] =
      await Promise.all([
        this.database.client.hrEmployee.findMany({
          where: this.employeeScope(actor),
          include: {
            manager: { select: { name: true } },
            organizationBranch: true,
            records: employeeExtensionProjection,
          },
          orderBy: { name: 'asc' },
          take: 2000,
        }),
        this.database.client.hrRecord.findMany({
          where: this.recordScope(actor),
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          take: 500,
        }),
        this.database.client.hrRecord.count({ where: this.recordScope(actor) }),
        this.iam.listRolesAndBranches(),
        this.database.client.hrRecord.findMany({
          where: {
            section: 'organization',
            tab: 'positions',
            employeeId: null,
            deletedAt: null,
          },
          select: { id: true, values: true, status: true },
          orderBy: { id: 'asc' },
        }),
      ]);
    await this.auditRead(actor, 'bootstrap', records.length);
    return {
      jobTitles: jobTitles.map((row) => ({
        id: row.id,
        name: (row.values as string[])[1] || (row.values as string[])[0] || '',
        status: row.status,
      })),
      employees: employees.map((row) => this.employeeDto(row)),
      records: await this.recordDtos(records, actor),
      recordCount,
      recordsTruncated: recordCount > records.length,
      workflowWarnings,
      branchIds: actor.branchIds,
      branches: options.branches
        .filter((b) => actor.branchIds.includes(b.id))
        .map(({ id, name, code }) => ({ id, name, code })),
      capabilities: {
        read: true,
        write: this.has(actor, 'hr.manage'),
        approve: this.has(actor, 'hr.approve'),
        sensitive: this.has(actor, 'hr.sensitive'),
        audit: this.has(actor, 'hr.audit'),
        scope:
          this.has(actor, 'hr.read') || this.has(actor, 'hr.manage')
            ? 'branch'
            : this.has(actor, 'hr.team')
              ? 'team'
              : 'self',
      },
      integrations: {
        finance: 'UNAVAILABLE',
        documents: 'PUBLIC_API',
        notifications: 'HR_PERSISTENT',
        biometric: 'UNAVAILABLE',
      },
    };
  }
  async listRecords(input: Record<string, unknown>, actor: AuthenticatedActor) {
    validate.object(input, [
      'section',
      'tab',
      'employeeId',
      'parentId',
      'search',
      'status',
      'page',
      'pageSize',
      'branchId',
      'organizationBranchId',
      'from',
      'to',
      'expiresWithin',
      'expired',
      'dateField',
      'sortBy',
    ]);
    const page = input.page === undefined ? 1 : Number(input.page);
    const pageSize = input.pageSize === undefined ? 50 : Number(input.pageSize);
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      page > 10000 ||
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > 200
    )
      throw new BadRequestException('صفحه‌بندی معتبر نیست.');
    const filters: Prisma.HrRecordWhereInput = {};
    if (input.branchId) filters.branchId = this.branch(actor, input.branchId);
    if (input.organizationBranchId) {
      const company = await this.record(
        this.database.client,
        validate.uuid(input.organizationBranchId, 'شعبه سازمانی'),
        actor,
      );
      if (company.section !== 'organization' || company.tab !== 'branches')
        throw new BadRequestException('فیلتر شعبه سازمانی معتبر نیست.');
      // Explicit classification takes precedence over today's employee assignment.
      // The enclosing IAM scope remains mandatory for every branch of this filter.
      filters.AND = [
        {
          OR: [
            { id: company.id },
            { data: { path: ['organizationBranchId'], equals: company.id } },
            {
              AND: [
                {
                  data: {
                    path: ['organizationBranchId'],
                    equals: Prisma.DbNull,
                  },
                },
                { employee: { organizationBranchId: company.id } },
              ],
            },
          ],
        },
      ];
    }
    if (input.section)
      filters.section = validate.text(input.section, 'بخش', 40);
    if (input.tab) filters.tab = validate.text(input.tab, 'نوع', 40);
    if (input.employeeId) filters.employeeId = validate.uuid(input.employeeId);
    if (input.parentId) filters.parentId = validate.uuid(input.parentId);
    if (input.status) filters.status = validate.text(input.status, 'وضعیت', 80);
    if (input.from || input.to) {
      const from = input.from ? validate.isoDate(input.from) : undefined,
        to = input.to ? validate.isoDate(input.to) : undefined;
      if (from && to && from > to)
        throw new BadRequestException('بازه تاریخ معتبر نیست.');
      // All resources get a normalized searchable business date at creation/update.
      if (input.dateField === 'createdAt')
        filters.createdAt = {
          ...(from ? { gte: from } : {}),
          ...(to ? { lt: new Date(to.getTime() + 86400000) } : {}),
        };
      else
        filters.effectiveAt = {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {}),
        };
    }
    if (input.expiresWithin !== undefined || input.expired !== undefined) {
      const now = new Date(new Date().toISOString().slice(0, 10));
      if (
        input.expired !== undefined &&
        !['true', 'false'].includes(String(input.expired))
      )
        throw new BadRequestException('فیلتر انقضا معتبر نیست.');
      if (input.expired === 'true') filters.expiresAt = { lt: now };
      else if (input.expiresWithin !== undefined) {
        const days = Number(input.expiresWithin);
        if (!Number.isInteger(days) || days < 0 || days > 366)
          throw new BadRequestException('بازه انقضا معتبر نیست.');
        filters.expiresAt = {
          gte: now,
          lte: new Date(now.getTime() + days * 86400000),
        };
      }
    }
    if (input.search) {
      const search = validate.text(input.search, 'جست‌وجو', 100);
      const sensitiveKeys = HR_RESOURCE_KEYS.filter((key) => {
        const [section, tab] = key.split('.');
        return getHrResource(section!, tab!)?.sensitive;
      }).map((key) => {
        const [section, tab] = key.split('.');
        return { section: section!, tab: tab! };
      });
      filters.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { employee: { name: { contains: search, mode: 'insensitive' } } },
        {
          AND: [
            { searchText: { contains: search, mode: 'insensitive' } },
            ...(this.has(actor, 'hr.sensitive')
              ? []
              : [{ NOT: { OR: sensitiveKeys } }]),
          ],
        },
      ];
    }
    if (
      input.dateField !== undefined &&
      !['createdAt', 'effectiveAt'].includes(String(input.dateField))
    )
      throw new BadRequestException('فیلتر تاریخ معتبر نیست.');
    if (
      input.sortBy !== undefined &&
      !['name', 'personnelCode', 'createdAt'].includes(String(input.sortBy))
    )
      throw new BadRequestException('مرتب‌سازی معتبر نیست.');
    const orderBy: Prisma.HrRecordOrderByWithRelationInput[] =
      input.sortBy === 'name'
        ? [{ employee: { name: 'asc' } }, { id: 'asc' }]
        : input.sortBy === 'personnelCode'
          ? [{ employee: { personnelCode: 'asc' } }, { id: 'asc' }]
          : [{ createdAt: 'desc' }, { id: 'asc' }];
    const where = { AND: [this.recordScope(actor), filters] };
    const [rows, total] = await Promise.all([
      this.database.client.hrRecord.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy,
      }),
      this.database.client.hrRecord.count({ where }),
    ]);
    await this.auditRead(actor, 'records.list', rows.length);
    return {
      items: await this.recordDtos(rows, actor),
      total,
      page,
      pageSize,
    };
  }
  private async transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.database.client.$transaction(work, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 10000,
          timeout: 20000,
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (['P2034', 'P2002'].includes(error.code) && attempt < 2) continue;
          if (['P2002', 'P2034'].includes(error.code))
            throw new ConflictException(
              'رکورد هم‌زمان تغییر کرده یا شناسه تکراری است؛ داده را تازه کنید.',
            );
          if (error.code === 'P2003')
            throw new BadRequestException('مرجع مرتبط معتبر نیست.');
        }
        throw error;
      }
    }
    throw new ConflictException('تلاش هم‌زمان ناموفق بود.');
  }
  private async command<T>(
    actor: AuthenticatedActor,
    keyInput: unknown,
    body: unknown,
    work: (tx: Tx) => Promise<T>,
  ): Promise<T> {
    const key = validate.text(keyInput, 'کلید یکتای درخواست', 120);
    if (!/^[A-Za-z0-9._:-]{8,120}$/.test(key))
      throw new BadRequestException('Idempotency-Key معتبر الزامی است.');
    const hash = createHash('sha256')
      .update(JSON.stringify(body))
      .digest('hex');
    return this.transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${actor.userId + ':' + key}, 0))::text`;
      const existing = await tx.hrCommand.findUnique({
        where: { actorId_key: { actorId: actor.userId, key } },
      });
      if (existing) {
        if (existing.hash !== hash)
          throw new ConflictException(
            'این کلید قبلاً با محتوای متفاوت استفاده شده است.',
          );
        return existing.result as T;
      }
      const result = await work(tx);
      await tx.hrCommand.create({
        data: { actorId: actor.userId, key, hash, result: json(result) },
      });
      return result;
    });
  }
  private async audit(
    tx: Tx,
    actor: AuthenticatedActor,
    entity: {
      branchId: string;
      employeeId?: string | null;
      recordId?: string | null;
    },
    action: string,
    changes: unknown,
    version?: number,
    fromStatus?: string,
    toStatus?: string,
  ) {
    await tx.hrAuditEvent.create({
      data: {
        ...entity,
        actorId: actor.userId,
        action,
        changes: json(changes),
        version: version ?? null,
        fromStatus: fromStatus ?? null,
        toStatus: toStatus ?? null,
      },
    });
    if (!action.endsWith('.read'))
      await tx.hrNotification.create({
        data: {
          ...entity,
          action,
          title: action.endsWith('.delete')
            ? 'رکورد منابع انسانی بایگانی شد'
            : action.includes('approve')
              ? 'درخواست منابع انسانی تأیید شد'
              : 'تغییر منابع انسانی ثبت شد',
        },
      });
  }
  private async auditRead(
    actor: AuthenticatedActor,
    source: string,
    count: number,
  ) {
    if (actor.branchIds.length)
      await this.database.client.hrAuditEvent.createMany({
        data: actor.branchIds.map((branchId) => ({
          branchId,
          actorId: actor.userId,
          action: 'record.read',
          changes: {
            source,
            count,
            sensitive: this.has(actor, 'hr.sensitive'),
          },
        })),
      });
  }
  private async documentReference(
    id: unknown,
    actor: AuthenticatedActor,
    branchId?: string,
  ) {
    const documentId = validate.uuid(id, 'سند');
    this.require(actor, 'documents.metadata.read');
    const result = await this.documents.detail(documentId, actor, {
      sensitiveReason: 'اتصال مرجع به پرونده منابع انسانی',
    });
    if (result.data.type.domain !== 'HUMAN_RESOURCES')
      throw new BadRequestException('سند باید در دامنه منابع انسانی باشد.');
    if (branchId && result.data.branchId !== branchId)
      throw new BadRequestException('سند باید متعلق به همان شعبه دسترسی باشد.');
    return documentId;
  }
  private async manager(
    tx: Tx,
    id: unknown,
    branchId: string,
    actor: AuthenticatedActor,
    employeeId?: string,
  ) {
    if (id === null || id === undefined || id === '') return null;
    const manager = await this.employee(tx, validate.uuid(id, 'مدیر'), actor);
    if (manager.branchId !== branchId || manager.id === employeeId)
      throw new BadRequestException(
        'مدیر باید در همان شعبه و متفاوت از کارمند باشد.',
      );
    let current: Employee | null = manager;
    const visited = new Set<string>();
    while (current?.managerId) {
      if (current.managerId === employeeId || visited.has(current.id))
        throw new BadRequestException('چرخه مدیریت مجاز نیست.');
      visited.add(current.id);
      current = await tx.hrEmployee.findUnique({
        where: { id: current.managerId },
      });
    }
    return manager.id;
  }
  private async userReference(id: unknown, branchId: string) {
    if (!id) return null;
    const userId = validate.uuid(id, 'حساب کاربری');
    const users = await this.iam.listUsers();
    if (
      !users.some(
        (user) =>
          user.id === userId &&
          user.status === 'ACTIVE' &&
          user.branches.some((b) => b.branch.id === branchId),
      )
    )
      throw new BadRequestException('حساب کاربری فعال در شعبه پیدا نشد.');
    return userId;
  }
  private async setEmployeeExtension(
    tx: Tx,
    employee: Employee,
    value: unknown,
    actor: AuthenticatedActor,
  ) {
    if (value === undefined) return;
    const extension = validate.digits(
      validate.text(value, 'شماره داخلی', 20, true),
    );
    if (extension && !/^\d{1,20}$/.test(extension))
      throw new BadRequestException('شماره داخلی باید فقط شامل رقم باشد.');
    const row = await tx.hrRecord.findFirst({
      where: {
        employeeId: employee.id,
        branchId: employee.branchId,
        section: 'employee',
        tab: 'internalContact',
        deletedAt: null,
      },
    });
    if (
      (row?.values as string[] | undefined)?.[0] === extension ||
      (!row && !extension)
    )
      return;
    const saved = row
      ? await tx.hrRecord.update({
          where: { id: row.id },
          data: {
            values: [extension],
            searchText: extension,
            version: { increment: 1 },
            ...(extension ? {} : { deletedAt: new Date() }),
          },
        })
      : await tx.hrRecord.create({
          data: {
            employeeId: employee.id,
            branchId: employee.branchId,
            section: 'employee',
            tab: 'internalContact',
            code: `HR-EXT-${randomUUID()}`,
            values: [extension],
            searchText: extension,
            status: 'فعال',
          },
        });
    await this.audit(
      tx,
      actor,
      {
        employeeId: employee.id,
        branchId: employee.branchId,
        recordId: saved.id,
      },
      'employee.extension',
      { before: row?.values ?? [], after: extension ? [extension] : [] },
      saved.version,
    );
  }
  private async employeeJobTitle(
    tx: Tx,
    input: Record<string, unknown>,
    existing?: Employee,
  ) {
    if (
      input.jobTitleId === undefined &&
      (input.position === undefined || input.position === existing?.position)
    )
      return undefined;
    // Legacy clients may create their historical free-text title; the current editor sends a catalogue ID.
    if (input.jobTitleId === undefined && !existing) return undefined;
    const name = validate.text(
      input.position ?? existing?.position,
      'عنوان شغلی',
    );
    const title =
      input.jobTitleId === undefined
        ? null
        : await tx.hrRecord.findFirst({
            where: {
              section: 'organization',
              tab: 'positions',
              employeeId: null,
              deletedAt: null,
              status: 'فعال',
              id: validate.uuid(input.jobTitleId, 'عنوان شغلی'),
            },
          });
    // Name-only edits resolve the canonical catalogue without accepting an arbitrary assignment.
    const candidates =
      input.jobTitleId === undefined
        ? await tx.hrRecord.findMany({
            where: {
              section: 'organization',
              tab: 'positions',
              employeeId: null,
              deletedAt: null,
              status: 'فعال',
            },
            orderBy: { id: 'asc' },
          })
        : title
          ? [title]
          : [];
    const result = candidates.find(
      (row) =>
        ((row.values as string[])[1] || (row.values as string[])[0]) === name,
    );
    if (!result)
      throw new BadRequestException('عنوان شغلی فعال را از فهرست انتخاب کنید.');
    return result;
  }
  private async validateEmployeeUnit(
    tx: Tx,
    value: unknown,
    employee: Employee,
  ) {
    const unit = validate.text(value, 'واحد', 160, true);
    if (!unit) return '';
    const rows = await tx.hrRecord.findMany({
      where: {
        section: 'organization',
        tab: 'units',
        branchId: employee.branchId,
        deletedAt: null,
        status: 'فعال',
      },
    });
    const companyRecords = employee.organizationBranchId
      ? await tx.hrRecord.findMany({
          where: {
            branchId: employee.branchId,
            section: 'organization',
            tab: 'branches',
            deletedAt: null,
            status: 'فعال',
          },
        })
      : [];
    const company = companyRecords.find(
      (r) => r.id === employee.organizationBranchId,
    );
    const aliases = new Set(
      companyRecords
        .filter(
          (r) =>
            company &&
            hrBranchKey((r.values as string[])[0] ?? '') ===
              hrBranchKey((company.values as string[])[0] ?? ''),
        )
        .map((r) => r.id),
    );
    if (
      !rows.some(
        (row) =>
          (row.values as string[])[0] === unit &&
          (!employee.organizationBranchId ||
            !(row.data as HrWorkflowData).organizationBranchId ||
            (row.data as HrWorkflowData).organizationBranchId ===
              employee.organizationBranchId ||
            aliases.has(
              (row.data as HrWorkflowData).organizationBranchId ?? '',
            )),
      )
    )
      throw new BadRequestException('واحد فعال همان شرکت را انتخاب کنید.');
    return unit;
  }
  private async insertEmployee(
    tx: Tx,
    input: Record<string, unknown>,
    actor: AuthenticatedActor,
    photoDocumentId: string | null = null,
  ) {
    const branchId = this.branch(actor, input.branchId);
    const jobTitle = await this.employeeJobTitle(tx, input);
    const row = await tx.hrEmployee.create({
      data: {
        branchId,
        jobTitleId: jobTitle?.id ?? null,
        userId: await this.userReference(input.userId, branchId),
        photoDocumentId,
        organizationBranchId: input.organizationBranchId
          ? await this.organizationBranch(
              tx,
              input.organizationBranchId,
              branchId,
              actor,
            )
          : null,
        personnelCode: input.personnelCode
          ? validate.text(input.personnelCode, 'کد پرسنلی', 50).toUpperCase()
          : `HR-${randomUUID().slice(0, 12).toUpperCase()}`,
        name: validate.text(input.name, 'نام'),
        kind: validate.text(input.kind, 'نوع همکاری', 80),
        unit: input.unit ? validate.text(input.unit, 'واحد') : '',
        position: validate.text(input.position, 'عنوان شغلی'),
        grade: validate.text(input.grade, 'رده', 40),
        managerId: await this.manager(tx, input.managerId, branchId, actor),
        startedAt: validate.isoDate(input.startedAtValue),
        status: input.status ? validate.status(input.status, false) : 'فعال',
      },
    });
    await this.setEmployeeExtension(tx, row, input.extension, actor);
    if (input.groupId !== undefined)
      await this.setEmployeeGroup(tx, row, input.groupId, actor);
    const assignment = await tx.hrRecord.create({
      data: {
        branchId,
        employeeId: row.id,
        jobTitleId: jobTitle?.id ?? null,
        code: `HR-ASG-${randomUUID().slice(0, 12).toUpperCase()}`,
        section: 'employee',
        tab: 'assignment',
        values: [
          branchId,
          row.unit,
          row.position,
          row.managerId ?? '',
          row.startedAt.toISOString().slice(0, 10),
        ],
        status: 'فعال',
        effectiveAt: row.startedAt,
        appliedAt: new Date(),
      },
    });
    await this.audit(
      tx,
      actor,
      { branchId, employeeId: row.id, recordId: assignment.id },
      'employee.create',
      { fields: employeeKeys },
      row.version,
      undefined,
      row.status,
    );
    return row;
  }
  private chartCoordinates(schema: HrResourceDefinition, data: HrWorkflowData) {
    if (
      (data.chartX !== undefined || data.chartY !== undefined) &&
      ![
        'organization.branches',
        'organization.units',
        'organization.chartEmployees',
      ].includes(schema.key)
    )
      throw new BadRequestException(
        'مختصات فقط برای گره‌های چارت سازمانی مجاز است.',
      );
  }
  private async chartEmployee(
    tx: Tx,
    schema: HrResourceDefinition,
    employee: Employee | null,
    branchId: string,
    parentId: string | null,
    data: HrWorkflowData,
    actor: AuthenticatedActor,
    id?: string,
  ) {
    if (schema.key !== 'organization.chartEmployees') return;
    if (!employee || employee.branchId !== branchId)
      throw new BadRequestException('کارمند گره باید متعلق به همان شعبه باشد.');
    if (
      await tx.hrRecord.count({
        where: {
          section: 'organization',
          tab: 'chartEmployees',
          employeeId: employee.id,
          branchId,
          ...(employee.organizationBranchId
            ? {
                OR: [
                  {
                    data: {
                      path: ['organizationBranchId'],
                      equals: employee.organizationBranchId,
                    },
                  },
                  {
                    data: {
                      path: ['organizationBranchId'],
                      equals: Prisma.DbNull,
                    },
                  },
                ],
              }
            : {}),
          deletedAt: null,
          ...(id ? { id: { not: id } } : {}),
        },
      })
    )
      throw new ConflictException('این کارمند قبلاً در چارت قرار گرفته است.');
    let cursor = parentId;
    const seen = new Set(id ? [id] : []);
    let company: string | null | undefined =
      data.organizationBranchId || employee.organizationBranchId;
    while (cursor) {
      if (seen.has(cursor) || seen.size > 1000)
        throw new BadRequestException('چرخه ساختار سازمانی مجاز نیست.');
      seen.add(cursor);
      const parent = await this.record(tx, cursor, actor);
      if (
        parent.branchId !== branchId ||
        !['organization.units', 'organization.chartEmployees'].includes(
          `${parent.section}.${parent.tab}`,
        ) ||
        parent.status !== 'فعال'
      )
        throw new BadRequestException(
          'والد گره باید فعال و متعلق به همان شعبه باشد.',
        );
      if (parent.employeeId === employee.id)
        throw new BadRequestException('کارمند نمی‌تواند والد خودش باشد.');
      const parentCompany = (parent.data as HrWorkflowData)
        .organizationBranchId;
      if (parentCompany && company && company !== parentCompany)
        throw new BadRequestException(
          'گره و والد باید متعلق به یک شرکت باشند.',
        );
      company ||= parentCompany;
      cursor = parent.parentId;
    }
    if (
      company &&
      employee.organizationBranchId &&
      company !== employee.organizationBranchId
    )
      throw new BadRequestException(
        'کارمند و گره باید متعلق به یک شرکت باشند.',
      );
    if (company) {
      await this.organizationBranch(tx, company, branchId, actor);
      data.organizationBranchId = company;
      if (id) await this.assertChartDescendantsCompany(tx, id, company);
    }
  }
  private async organizationBranch(
    tx: Tx,
    id: unknown,
    branchId: string,
    actor: AuthenticatedActor,
  ) {
    const row = await this.record(tx, validate.uuid(id, 'شعبه سازمانی'), actor);
    if (
      row.section !== 'organization' ||
      row.tab !== 'branches' ||
      row.branchId !== branchId ||
      row.status !== 'فعال'
    )
      throw new BadRequestException(
        'شعبه سازمانی باید فعال و در همان محدوده دسترسی باشد.',
      );
    return row.id;
  }
  private async companyDependants(tx: Tx, id: string) {
    return tx.hrRecord.count({
      where: {
        deletedAt: null,
        data: { path: ['organizationBranchId'], equals: id },
      },
    });
  }
  private async unitCompany(
    tx: Tx,
    branchId: string,
    parentId: string | null,
    data: HrWorkflowData,
    actor: AuthenticatedActor,
    id?: string,
  ) {
    const visited = new Set<string>(id ? [id] : []);
    let cursor = parentId;
    while (cursor) {
      if (visited.has(cursor))
        throw new BadRequestException('چرخه ساختار سازمانی مجاز نیست.');
      visited.add(cursor);
      const parent = await this.record(tx, cursor, actor);
      if (
        parent.branchId !== branchId ||
        parent.section !== 'organization' ||
        parent.tab !== 'units'
      )
        throw new BadRequestException('والد باید واحد سازمانی همان شعبه باشد.');
      const company = (parent.data as HrWorkflowData).organizationBranchId;
      if (company) {
        if (data.organizationBranchId && data.organizationBranchId !== company)
          throw new BadRequestException(
            'واحد و والد باید متعلق به همان شرکت باشند.',
          );
        data.organizationBranchId = company;
      }
      cursor = parent.parentId;
    }
    if (data.organizationBranchId)
      await this.organizationBranch(
        tx,
        data.organizationBranchId,
        branchId,
        actor,
      );
    if (id && data.organizationBranchId)
      await this.assertChartDescendantsCompany(
        tx,
        id,
        data.organizationBranchId,
      );
  }
  private async assertChartDescendantsCompany(
    tx: Tx,
    id: string,
    companyId: string,
  ) {
    let frontier = [id],
      inspected = 0;
    const seen = new Set([id]);
    while (frontier.length) {
      const children = await tx.hrRecord.findMany({
        where: {
          parentId: { in: frontier },
          section: 'organization',
          tab: { in: ['units', 'chartEmployees'] },
          deletedAt: null,
        },
        select: { id: true, data: true },
        take: 2001,
      });
      inspected += children.length;
      if (inspected > 2000)
        throw new ConflictException(
          'ساختار بزرگ است؛ تغییر شرکت نیازمند بررسی سازمانی است.',
        );
      if (
        children.some((child) => {
          const company = (child.data as HrWorkflowData).organizationBranchId;
          return company && company !== companyId;
        })
      )
        throw new BadRequestException(
          'واحد دارای زیرمجموعه متعلق به شرکت دیگر است.',
        );
      frontier = [];
      for (const child of children) {
        if (seen.has(child.id))
          throw new BadRequestException('چرخه ساختار سازمانی مجاز نیست.');
        seen.add(child.id);
        frontier.push(child.id);
      }
    }
  }
  private compatibleTimeInput(value: unknown, row: RecordRow) {
    const legacy =
      row.section === 'time'
        ? (
            { workingHours: 8, leaveTransferRules: 9 } as Record<string, number>
          )[row.tab]
        : undefined;
    if (
      legacy !== undefined &&
      Array.isArray(value) &&
      value.length === legacy &&
      Array.isArray(row.values) &&
      row.values.length > legacy
    )
      return [...value, ...row.values.slice(legacy)];
    return value;
  }
  private compatibleIdentityInput(value: unknown, row?: RecordRow) {
    if (!Array.isArray(value) || value.length !== 14 || !row) return value;
    const previous = revealHrValues(
      row.data,
      `${row.branchId}:${row.employeeId ?? row.parentId}:employee.identity`,
    );
    return [...value, previous[14] ?? ''];
  }
  private async insertPersonnelProfile(
    tx: Tx,
    employee: Employee,
    input: Record<string, unknown>,
    actor: AuthenticatedActor,
    existing: RecordRow[] = [],
  ) {
    const identitySchema = validate.resource('employee', 'identity');
    const identity = validate.recordValues(
      this.compatibleIdentityInput(
        input.identityValues,
        existing.find((row) => row.tab === 'identity'),
      ),
      identitySchema,
    );
    this.nameParts({ firstName: identity[0], lastName: identity[1] });
    if (`${identity[0]} ${identity[1]}` !== employee.name)
      throw new BadRequestException('نام و اطلاعات هویتی کارمند یکسان نیستند.');
    const contacts = input.contactValues ?? [];
    if (!Array.isArray(contacts) || contacts.length > 20)
      throw new BadRequestException('حداکثر بیست شماره تماس مجاز است.');
    const phoneSchema = validate.resource('employee', 'phones');
    const phones = contacts.map((values) =>
      validate.recordValues(values, phoneSchema),
    );
    const seen = new Set<string>();
    for (const phone of phones) {
      const normalized = `${phone[0]}:${validate.digits(phone[1]!).replace(/[()+-]/g, '')}`;
      if (seen.has(normalized))
        throw new BadRequestException('شماره تماس تکراری است.');
      seen.add(normalized);
    }
    const remaining = [...existing];
    for (const [schema, values] of [
      [identitySchema, identity],
      ...phones.map((phone) => [phoneSchema, phone] as const),
    ] as const) {
      const index = remaining.findIndex((row) => row.tab === schema.tab);
      const previous = index < 0 ? undefined : remaining.splice(index, 1)[0];
      const data = {
        values: values.map(() => '••••'),
        searchText: '',
        data: json({
          ...(previous ? publicHrData(previous.data) : {}),
          ...protectHrValues(
            values,
            `${employee.branchId}:${employee.id}:${schema.key}`,
          ),
        }),
      };
      let recordId: string;
      let version: number;
      if (previous) {
        const changed = await tx.hrRecord.updateMany({
          where: {
            id: previous.id,
            version: previous.version,
            deletedAt: null,
          },
          data: { ...data, version: { increment: 1 } },
        });
        if (changed.count !== 1)
          throw new ConflictException('نسخه رکورد تغییر کرده است.');
        recordId = previous.id;
        version = previous.version + 1;
      } else {
        const row = await tx.hrRecord.create({
          data: {
            ...data,
            branchId: employee.branchId,
            employeeId: employee.id,
            section: schema.section,
            tab: schema.tab,
            code: `HR-PRIVATE-${randomUUID().slice(0, 16)}`,
            status: 'فعال',
          },
        });
        recordId = row.id;
        version = row.version;
      }
      await this.audit(
        tx,
        actor,
        {
          branchId: employee.branchId,
          employeeId: employee.id,
          recordId,
        },
        previous ? 'personnel.profile.update' : 'personnel.profile.create',
        { fields: schema.columns },
        version,
      );
    }
    for (const previous of remaining) {
      const changed = await tx.hrRecord.updateMany({
        where: { id: previous.id, version: previous.version, deletedAt: null },
        data: { deletedAt: new Date(), version: { increment: 1 } },
      });
      if (changed.count !== 1)
        throw new ConflictException('نسخه رکورد تغییر کرده است.');
      await this.audit(
        tx,
        actor,
        {
          branchId: employee.branchId,
          employeeId: employee.id,
          recordId: previous.id,
        },
        'personnel.profile.remove',
        { fields: ['شماره‌های تماس'] },
        previous.version + 1,
      );
    }
  }
  async createEmployee(body: unknown, key: unknown, actor: AuthenticatedActor) {
    this.require(actor, 'hr.manage');
    const input = validate.object(body, employeeKeys);
    this.nameParts(input);
    const privateProfile =
      input.identityValues !== undefined || input.contactValues !== undefined;
    if (privateProfile) this.require(actor, 'hr.sensitive');
    const photo = input.photoDocumentId
      ? await this.documentReference(
          input.photoDocumentId,
          actor,
          this.branch(actor, input.branchId),
        )
      : null;
    const result = await this.command(
      actor,
      key,
      {
        operation: 'employee.create',
        input: privateProfile
          ? privateCommandFingerprint(input, actor.userId)
          : input,
      },
      async (tx) => {
        const employee = await this.insertEmployee(tx, input, actor, photo);
        if (privateProfile)
          await this.insertPersonnelProfile(tx, employee, input, actor);
        return { id: employee.id };
      },
    );
    return this.employeeDto(
      await this.employee(this.database.client, result.id, actor),
    );
  }
  async updateEmployee(id: string, body: unknown, actor: AuthenticatedActor) {
    this.require(actor, 'hr.manage');
    const input = validate.object(body, [
      ...employeeKeys,
      'profileRecords',
      'version',
    ]);
    const privateProfile =
      input.identityValues !== undefined || input.contactValues !== undefined;
    if (privateProfile) {
      this.require(actor, 'hr.sensitive');
      if (
        !Array.isArray(input.identityValues) ||
        !Array.isArray(input.contactValues)
      )
        throw new BadRequestException('اطلاعات هویتی و تماس الزامی است.');
      if (
        !Array.isArray(input.profileRecords) ||
        input.profileRecords.length > 100
      )
        throw new BadRequestException('نسخه اطلاعات هویتی و تماس الزامی است.');
      for (const record of input.profileRecords) {
        const value = validate.object(record, ['id', 'version']);
        validate.text(value.id, 'شناسه رکورد', 100);
        validate.version(value.version);
      }
    } else if (input.profileRecords !== undefined)
      throw new BadRequestException('اطلاعات هویتی و تماس الزامی است.');
    const expected = validate.version(input.version);
    const photo = input.photoDocumentId
      ? await this.documentReference(
          input.photoDocumentId,
          actor,
          input.branchId === undefined
            ? (await this.employee(this.database.client, id, actor)).branchId
            : this.branch(actor, input.branchId),
        )
      : undefined;
    const row = await this.transaction(async (tx) => {
      const existing = await this.employee(tx, id, actor);
      if (existing.version !== expected)
        throw new ConflictException('نسخه کارمند تغییر کرده است.');
      for (const key of ['startedAtValue'])
        if (input[key] !== undefined)
          throw new BadRequestException(
            'تغییر انتصاب باید از گردش ارتقا یا انتقال با تاریخ اثر ثبت شود.',
          );
      const targetBranchId =
        input.branchId === undefined
          ? existing.branchId
          : this.branch(actor, input.branchId);
      const movingBranch = targetBranchId !== existing.branchId;
      if (movingBranch) this.require(actor, 'hr.sensitive');
      if (
        movingBranch &&
        (await tx.hrEmployee.count({
          where: { managerId: id, status: 'فعال', deletedAt: null },
        }))
      )
        throw new ConflictException(
          'ابتدا مدیر کارکنان زیرمجموعه را تعیین کنید.',
        );
      const targetCompanyId =
        input.organizationBranchId === undefined
          ? movingBranch
            ? null
            : existing.organizationBranchId
          : input.organizationBranchId === null
            ? null
            : await this.organizationBranch(
                tx,
                input.organizationBranchId,
                targetBranchId,
                actor,
              );
      const destination = {
        ...existing,
        branchId: targetBranchId,
        organizationBranchId: targetCompanyId,
      };
      const jobTitle = await this.employeeJobTitle(tx, input, existing);
      const data: Prisma.HrEmployeeUncheckedUpdateManyInput = {
        version: { increment: 1 },
        ...(movingBranch ? { branchId: targetBranchId, managerId: null } : {}),
        ...(input.organizationBranchId !== undefined || movingBranch
          ? { organizationBranchId: targetCompanyId }
          : {}),
      };
      for (const key of ['name', 'kind', 'personnelCode'] as const)
        if (input[key] !== undefined)
          data[key] = validate.text(
            input[key],
            key,
            key === 'personnelCode' ? 50 : key === 'kind' ? 80 : 160,
          );
      if (jobTitle) data.jobTitleId = jobTitle.id;
      if (
        (input.unit !== undefined && input.unit !== existing.unit) ||
        movingBranch ||
        targetCompanyId !== existing.organizationBranchId
      )
        data.unit = await this.validateEmployeeUnit(
          tx,
          input.unit ?? existing.unit,
          destination,
        );
      if (input.position !== undefined)
        data.position = validate.text(input.position, 'عنوان شغلی');
      if (input.grade !== undefined)
        data.grade = validate.text(input.grade, 'رده', 40);
      if (input.managerId !== undefined)
        data.managerId = await this.manager(
          tx,
          input.managerId,
          targetBranchId,
          actor,
          id,
        );
      const nameParts = this.nameParts(input);
      if (nameParts) data.name = nameParts.join(' ');
      if (input.status !== undefined && input.status !== existing.status)
        throw new BadRequestException(
          'پایان همکاری باید از پرونده خروج ثبت شود.',
        );
      if (input.groupId !== undefined)
        await this.setEmployeeGroup(tx, destination, input.groupId, actor);
      if (input.userId !== undefined)
        data.userId = await this.userReference(input.userId, targetBranchId);
      else if (movingBranch && existing.userId)
        await this.userReference(existing.userId, targetBranchId);
      if (photo !== undefined) data.photoDocumentId = photo;
      const changed = await tx.hrEmployee.updateMany({
        where: { id, version: expected, deletedAt: null },
        data,
      });
      if (changed.count !== 1)
        throw new ConflictException('نسخه کارمند تغییر کرده است.');
      const assignmentChanged =
        input.jobTitleId !== undefined ||
        [
          'branchId',
          'organizationBranchId',
          'unit',
          'position',
          'grade',
          'managerId',
        ].some(
          (key) =>
            input[key] !== undefined &&
            input[key] !== existing[key as keyof Employee],
        );
      if (assignmentChanged) {
        const current = await tx.hrEmployee.findUniqueOrThrow({
          where: { id },
        });
        const effectiveAt = new Date();
        const assignment = await tx.hrRecord.create({
          data: {
            branchId: current.branchId,
            employeeId: id,
            jobTitleId: current.jobTitleId,
            section: 'employee',
            tab: 'assignment',
            data: current.organizationBranchId
              ? { organizationBranchId: current.organizationBranchId }
              : {},
            code: `HR-ASG-${randomUUID()}`,
            values: [
              current.branchId,
              current.unit,
              current.position,
              current.managerId ?? '',
              effectiveAt.toISOString().slice(0, 10),
            ],
            effectiveAt,
            appliedAt: effectiveAt,
            status: current.status,
          },
        });
        await this.audit(
          tx,
          actor,
          {
            branchId: current.branchId,
            employeeId: id,
            recordId: assignment.id,
          },
          'employee.assignment.correct',
          {
            before: {
              branchId: existing.branchId,
              organizationBranchId: existing.organizationBranchId,
              unit: existing.unit,
              position: existing.position,
              grade: existing.grade,
              managerId: existing.managerId,
            },
            after: {
              branchId: current.branchId,
              organizationBranchId: current.organizationBranchId,
              unit: current.unit,
              position: current.position,
              grade: current.grade,
              managerId: current.managerId,
            },
          },
          expected + 1,
        );
      }
      await this.setEmployeeExtension(tx, existing, input.extension, actor);
      if (privateProfile) {
        const records = await tx.hrRecord.findMany({
          where: {
            employeeId: id,
            branchId: existing.branchId,
            section: 'employee',
            tab: { in: ['identity', 'phones'] },
            deletedAt: null,
          },
          orderBy: { id: 'asc' },
        });
        const snapshot = input.profileRecords as {
          id: string;
          version: number;
        }[];
        if (
          snapshot.length !== records.length ||
          new Set(snapshot.map((r) => r.id)).size !== snapshot.length ||
          records.some(
            (r) =>
              !snapshot.some((v) => v.id === r.id && v.version === r.version),
          )
        )
          throw new ConflictException(
            'نسخه اطلاعات هویتی و تماس تغییر کرده است.',
          );
        if (records.filter((r) => r.tab === 'identity').length > 1)
          throw new ConflictException('بیش از یک پرونده هویتی ثبت شده است.');
        await this.insertPersonnelProfile(
          tx,
          {
            ...existing,
            name: typeof data.name === 'string' ? data.name : existing.name,
          },
          input,
          actor,
          records,
        );
      } else if (typeof data.name === 'string')
        await this.syncIdentityNames(tx, existing, data.name, nameParts, actor);
      if (movingBranch) {
        const currentProfile = await tx.hrRecord.findMany({
          where: {
            employeeId: id,
            branchId: existing.branchId,
            OR: [
              {
                section: 'employee',
                tab: { in: ['identity', 'phones', 'internalContact'] },
              },
              { section: 'payrollWorksheets', tab: 'configuration' },
            ],
            deletedAt: null,
          },
        });
        for (const record of currentProfile) {
          const payConfiguration = record.section === 'payrollWorksheets';
          const key = payConfiguration
            ? 'payroll-worksheet:v1'
            : `employee.${record.tab}`;
          const contextId = payConfiguration ? record.id : id;
          const privateData =
            payConfiguration || privateHrResource(key)
              ? {
                  ...publicHrData(record.data),
                  ...protectHrValues(
                    revealHrValues(
                      record.data,
                      `${existing.branchId}:${contextId}:${key}`,
                    ),
                    `${targetBranchId}:${contextId}:${key}`,
                  ),
                }
              : record.data;
          await tx.hrRecord.update({
            where: { id: record.id },
            data: {
              branchId: targetBranchId,
              data: json(privateData),
              version: { increment: 1 },
            },
          });
        }
        if (input.groupId === undefined)
          await this.setEmployeeGroup(tx, destination, null, actor);
      }
      await this.audit(
        tx,
        actor,
        { branchId: existing.branchId, employeeId: id },
        'employee.update',
        {
          before: { name: existing.name, kind: existing.kind },
          fields: Object.keys(input),
        },
        expected + 1,
      );
      return tx.hrEmployee.findUniqueOrThrow({
        where: { id },
        include: {
          organizationBranch: true,
          records: employeeExtensionProjection,
          manager: { select: { name: true } },
        },
      });
    });
    return this.employeeDto(row);
  }
  async deleteEmployee(
    id: string,
    expected: unknown,
    actor: AuthenticatedActor,
  ) {
    this.require(actor, 'hr.manage');
    const v = validate.version(Number(expected));
    return this.transaction(async (tx) => {
      const row = await this.employee(tx, id, actor);
      if (
        await tx.hrEmployee.count({ where: { managerId: id, deletedAt: null } })
      )
        throw new ConflictException(
          'ابتدا مدیر کارکنان زیرمجموعه را تغییر دهید.',
        );
      if (
        await tx.hrRecord.count({
          where: {
            employeeId: id,
            deletedAt: null,
            section: { not: 'employee' },
          },
        })
      )
        throw new ConflictException(
          'کارمند دارای پرونده عملیاتی است؛ از پایان همکاری استفاده کنید.',
        );
      const result = await tx.hrEmployee.updateMany({
        where: { id, version: v, deletedAt: null },
        data: { deletedAt: new Date(), version: { increment: 1 } },
      });
      if (result.count !== 1)
        throw new ConflictException('نسخه کارمند تغییر کرده است.');
      await this.audit(
        tx,
        actor,
        { branchId: row.branchId, employeeId: id },
        'employee.delete',
        { reason: 'بایگانی کارمند' },
        v + 1,
      );
      return { id, deleted: true };
    });
  }
  private writeResource(
    schema: HrResourceDefinition,
    actor: AuthenticatedActor,
    employee?: Employee | null,
  ) {
    if (schema.readOnly || systemResources.has(schema.key))
      throw new ForbiddenException('این رکورد توسط گردش عملیاتی تولید می‌شود.');
    if (schema.sensitive) this.require(actor, 'hr.sensitive');
    if (
      !this.has(actor, 'hr.manage') &&
      !(
        schema.selfService &&
        this.has(actor, 'hr.self') &&
        employee?.userId === actor.userId
      )
    )
      throw new ForbiddenException('مجوز تغییر این نوع رکورد وجود ندارد.');
  }
  private async approve(
    tx: Tx,
    schema: HrResourceDefinition,
    actor: AuthenticatedActor,
    employee?: Employee | null,
  ) {
    this.require(actor, 'hr.approve');
    if (schema.sensitive) this.require(actor, 'hr.sensitive');
    if (employee?.userId === actor.userId)
      throw new ForbiddenException('تأیید درخواست خود مجاز نیست.');
    if (!this.has(actor, 'hr.manage')) {
      const manager = employee?.managerId
        ? await tx.hrEmployee.findUnique({ where: { id: employee.managerId } })
        : null;
      if (!this.has(actor, 'hr.team') || manager?.userId !== actor.userId)
        throw new ForbiddenException(
          'تأیید فقط برای کارکنان زیرمجموعه مجاز است.',
        );
    }
  }
  private async values(
    tx: Tx,
    schema: HrResourceDefinition,
    input: unknown,
    employee: Employee | null,
    branchId: string,
    data: HrWorkflowData,
    parentId?: string | null,
  ) {
    const submitted = Array.isArray(input) ? [...input] : input;
    const canonicalEmployeeColumn = schema.columns.indexOf('کارمند');
    if (Array.isArray(submitted) && employee && canonicalEmployeeColumn >= 0)
      submitted[canonicalEmployeeColumn] = employee.name;
    const values = validate.recordValues(submitted, schema);
    const employeeColumn = schema.columns.indexOf('کارمند');
    if (employeeColumn >= 0 && employee) values[employeeColumn] = employee.name;
    if (
      ['time.corrections', 'requests.attendance'].includes(schema.key) &&
      employee
    ) {
      const date = values[1]!;
      validate.isoDate(date);
      const source = await tx.hrRecord.findMany({
        where: {
          branchId,
          employeeId: employee.id,
          section: 'time',
          tab: { in: ['checkins', 'shift'] },
          deletedAt: null,
        },
        take: 10001,
      });
      if (source.length > 10000)
        throw new ConflictException(
          'تعداد تردد برای محاسبه مستقیم بیش از حد مجاز است.',
        );
      const { events, result } = this.attendanceView(source, employee.id, date);
      values[2] = events.length
        ? `${Math.floor(result.worked / 60)}:${String(result.worked % 60).padStart(2, '0')}`
        : 'تردد ثبت نشده';
      if (data.startsAt || data.endsAt) {
        if (!data.startsAt || !data.endsAt)
          throw new BadRequestException(
            'زمان شروع و پایان اصلاح باید با هم مشخص شوند.',
          );
        const start = validate.localClockParts(new Date(data.startsAt)),
          end = validate.localClockParts(new Date(data.endsAt));
        const nextDate = new Date(validate.isoDate(date).getTime() + 86400000)
          .toISOString()
          .slice(0, 10);
        if (
          start.date !== date ||
          ![date, nextDate].includes(end.date) ||
          Date.parse(data.endsAt) - Date.parse(data.startsAt) > 86400000
        )
          throw new BadRequestException(
            'بازه اصلاح باید با روز کارکرد منطبق و حداکثر ۲۴ ساعت باشد.',
          );
        values[3] = `${start.time} تا ${end.time}${end.date !== date ? ' (روز بعد)' : ''}`;
      }
    }
    if (['requests.radanLeave', 'requests.radanMission'].includes(schema.key)) {
      const hourly = values[4] === 'ساعتی';
      data.startsAt = hourly
        ? validate.localClockToUtc(values[2]!, values[5]!).toISOString()
        : values[2] + 'T00:00:00.000Z';
      data.endsAt = hourly
        ? validate.localClockToUtc(values[3]!, values[6]!).toISOString()
        : values[3] + 'T23:59:59.999Z';
      if (hourly)
        data.minutes =
          (Date.parse(data.endsAt) - Date.parse(data.startsAt)) / 60000;
      else delete data.minutes;
      const category =
        schema.key === 'requests.radanLeave' ? 'مرخصی' : 'مأموریت';
      data.requestSubtype = `${category} ${values[4]} ${values[1]}${values[7] === 'بله' ? ' با جایگزینی' : ''}`;
      if (
        schema.key === 'requests.radanMission' &&
        values[1] === 'وابسته به پایان مأموریت'
      )
        data.requestSubtype = 'مأموریت وابسته به پایان مأموریت';
      if (
        schema.key === 'requests.radanMission' &&
        values[1] === 'پایان مأموریت'
      )
        data.requestSubtype = 'پایان مأموریت';
    }
    if (schema.key === 'time.remote') {
      if (values[3] === 'ساعتی') {
        const starts = validate.localClockToUtc(values[1]!, values[4]!);
        const ends = validate.localClockToUtc(values[2]!, values[5]!);
        data.startsAt = starts.toISOString();
        data.endsAt = ends.toISOString();
        data.minutes = (ends.getTime() - starts.getTime()) / 60000;
      } else {
        data.startsAt = values[1] + 'T00:00:00.000Z';
        data.endsAt = values[2] + 'T23:59:59.999Z';
        delete data.minutes;
      }
    }
    if (schema.key === 'time.shift' && parentId) {
      const template = await tx.hrRecord.findFirst({
        where: {
          id: parentId,
          branchId,
          section: 'time',
          tab: 'shiftTemplates',
          status: 'فعال',
          deletedAt: null,
        },
      });
      if (template?.tab === 'shiftTemplates') {
        const days = await tx.hrRecord.findMany({
          where: {
            parentId,
            branchId,
            section: 'time',
            tab: 'templateDays',
            status: 'فعال',
            deletedAt: null,
          },
          take: 1101,
        });
        if (!days.length || days.length > 1100)
          throw new BadRequestException('روزهای تقویم شیفت باید تعریف شوند.');
        const inRange = days.filter((day) => {
          const date = (day.values as string[])[0]!;
          return date >= values[7]! && date <= values[8]!;
        });
        if (!inRange.length)
          throw new BadRequestException('روزهای تقویم شیفت باید تعریف شوند.');
        assertTemplateIntervals(inRange.map((day) => day.values as string[]));
        data.templateSchedule = Object.fromEntries(
          inRange.map((day) => {
            const d = day.values as string[];
            return [d[0]!, { values: d.slice(1) }];
          }),
        );
        values[0] = (template.values as string[])[0]!;
        return values;
      }
      delete data.templateSchedule;

      const hours = await tx.hrRecord.findFirst({
        where: {
          id: parentId,
          branchId,
          section: 'time',
          tab: 'workingHours',
          deletedAt: null,
          status: 'فعال',
        },
      });
      if (!hours)
        throw new BadRequestException(
          'ساعت کاری فعال متعلق به همین شعبه را انتخاب کنید.',
        );
      const v = hours.values as string[];
      values[1] = v[2]!;
      values[2] = v[3]!;
      data.shiftEndDayOffset = ['همان روز', 'یک روز بعد', 'دو روز بعد'].indexOf(
        v[4]!,
      );
      data.attendanceBeforeHours = Number(validate.digits(v[5]!));
      data.attendanceAfterHours = Number(validate.digits(v[6]!));
      const minute = (clock: string) =>
        Number(validate.digits(clock).slice(0, 2)) * 60 +
        Number(validate.digits(clock).slice(3));
      const length =
        data.shiftEndDayOffset * 1440 + minute(v[3]!) - minute(v[2]!);
      if (length >= 1440 && values[7] !== values[8])
        throw new BadRequestException(
          'شیفت ۲۴ساعته یا بیشتر باید برای یک روز شروع مشخص ثبت شود.',
        );
    }
    if (schema.key === 'time.biometric')
      for (const label of ['آخرین همگام‌سازی', 'تعداد رکورد', 'سلامت اتصال']) {
        const i = schema.columns.indexOf(label);
        if (i >= 0) values[i] = label === 'تعداد رکورد' ? '0' : 'در دسترس نیست';
      }
    if (schema.key === 'lifecycle.promotion' && employee) {
      values[1] = employee.position;
      values[2] = employee.grade;
      values[6] = 'تعیین توسط سامانه';
    }
    if (schema.key === 'lifecycle.transfer' && employee) {
      values[1] = employee.branchId;
      values[2] = employee.unit;
      if (data.targetBranchId) values[3] = data.targetBranchId;
    }
    if (schema.key === 'time.overtime') {
      const start = validate.localClockToUtc(values[1]!, values[2]!),
        end = validate.localClockToUtc(values[1]!, values[3]!);
      const minutes = (end.getTime() - start.getTime()) / 60000;
      if (minutes <= 0 || minutes > 960)
        throw new BadRequestException(
          'بازه اضافه‌کاری باید در همان روز و حداکثر ۱۶ ساعت باشد.',
        );
      values[4] = `${minutes} دقیقه`;
      data.minutes = minutes;
      data.startsAt = start.toISOString();
      data.endsAt = end.toISOString();
    }
    if (schema.key === 'time.checkins') {
      if (!['ورود', 'خروج'].includes(values[3]!))
        throw new BadRequestException('نوع تردد باید ورود یا خروج باشد.');
      const date = values[1]!;
      const at = validate.localClockToUtc(date, values[2]!);
      if (data.startsAt && data.startsAt !== at.toISOString())
        throw new BadRequestException(
          'زمان UTC با ساعت و تاریخ محلی مطابقت ندارد.',
        );
      data.startsAt = at.toISOString();
      await this.assertOpenPeriod(tx, branchId, date);
      const duplicate = await tx.hrRecord.findFirst({
        where: {
          branchId,
          employeeId: employee?.id ?? null,
          section: 'time',
          tab: 'checkins',
          deletedAt: null,
          values: { equals: values },
        },
      });
      if (duplicate) throw new ConflictException('این تردد قبلاً ثبت شده است.');
    }
    const starts = schema.columns.findIndex((c) =>
      ['از تاریخ', 'تاریخ شروع', 'تاریخ رفت'].includes(c),
    );
    const ends = schema.columns.findIndex((c) =>
      ['تا تاریخ', 'تاریخ پایان', 'تاریخ برگشت'].includes(c),
    );
    if (
      starts >= 0 &&
      ends >= 0 &&
      values[starts] &&
      values[ends] &&
      values[ends]! < values[starts]!
    )
      throw new BadRequestException('پایان بازه نمی‌تواند پیش از شروع باشد.');
    return values;
  }
  private effective(
    schema: HrResourceDefinition,
    values: string[],
    input: unknown,
  ) {
    const index = schema.columns.indexOf('تاریخ اثر');
    if (input !== undefined) return validate.isoDate(input, 'تاریخ اثر');
    if (index >= 0 && values[index])
      return validate.isoDate(values[index], 'تاریخ اثر');
    if (schema.key === 'lifecycle.separation')
      return validate.isoDate(values[2], 'آخرین روز کاری');
    const firstDate = schema.fields.findIndex((field) => field.type === 'date');
    return firstDate >= 0 && values[firstDate] && values[firstDate] !== '—'
      ? validate.isoDate(values[firstDate])
      : new Date(new Date().toISOString().slice(0, 10));
  }
  private expiry(schema: HrResourceDefinition, values: string[]) {
    const index = schema.columns.findIndex((label) =>
      ['تاریخ پایان', 'تا تاریخ', 'تاریخ اعتبار'].includes(label),
    );
    return index >= 0 && values[index] && values[index] !== '—'
      ? validate.isoDate(values[index])
      : null;
  }
  private async amounts(
    tx: Tx,
    row: RecordRow,
    schema: HrResourceDefinition,
    values: string[],
    data: HrWorkflowData,
  ) {
    const money = schema.fields.filter((f) => f.type === 'money');
    await tx.hrRecordAmount.deleteMany({ where: { recordId: row.id } });
    for (const field of money) {
      const value = values[schema.fields.indexOf(field)];
      if (!value || value === '—') continue;
      const currency = data.currency || values[schema.columns.indexOf('ارز')];
      if (!currency || !/^[A-Z]{3}$/.test(currency))
        throw new BadRequestException('برای مبلغ، کد ارز سه‌حرفی الزامی است.');
      await this.directory.master.assertCurrency(currency);
      await tx.hrRecordAmount.upsert({
        where: { recordId_field: { recordId: row.id, field: field.key } },
        create: {
          recordId: row.id,
          field: field.key,
          amount: new Prisma.Decimal(validate.digits(value)),
          currency,
        },
        update: {
          amount: new Prisma.Decimal(validate.digits(value)),
          currency,
        },
      });
    }
  }
  async createRecord(body: unknown, key: unknown, actor: AuthenticatedActor) {
    this.readable(actor);
    const input = validate.object(body, recordKeys);
    const schema = validate.resource(input.section, input.tab);
    const data = validate.workflowData(input.data);
    this.chartCoordinates(schema, data);
    const networkPassword = this.devicePassword(
      input.privateData,
      schema,
      actor,
    );
    if (privateHrResource(schema.key)) this.require(actor, 'hr.sensitive');
    const commandInput = privateHrResource(schema.key)
      ? privateCommandFingerprint(input, actor.userId)
      : networkPassword !== undefined
        ? {
            ...input,
            privateData: privateCommandFingerprint(
              input.privateData,
              actor.userId,
            ),
          }
        : input;

    const result = await this.command(
      actor,
      key,
      { operation: 'record.create', input: commandInput },
      async (tx) => {
        const employee = input.employeeId
          ? await this.employee(tx, validate.uuid(input.employeeId), actor)
          : null;
        this.writeResource(schema, actor, employee);
        if (schema.employeeRequired && !employee)
          throw new BadRequestException('انتخاب شناسه کارمند الزامی است.');
        const branchId = this.branch(
          actor,
          input.branchId ?? employee?.branchId,
        );
        const documentId = data.documentId
          ? await this.documentReference(data.documentId, actor, branchId)
          : null;
        if (employee && employee.branchId !== branchId)
          throw new BadRequestException(
            'کارمند متعلق به شعبه انتخاب‌شده نیست.',
          );
        if (data.allBranches) {
          if (!isHrSharedResource(schema.section, schema.tab) || employee)
            throw new BadRequestException('دامنه شعبه معتبر نیست.');
          delete data.organizationBranchId;
        }
        if (data.organizationBranchId)
          await this.organizationBranch(
            tx,
            data.organizationBranchId,
            schema.key === 'lifecycle.transfer' && data.targetBranchId
              ? this.branch(actor, data.targetBranchId)
              : branchId,
            actor,
          );
        const parent = input.parentId
          ? await this.record(tx, validate.uuid(input.parentId), actor)
          : null;
        if (schema.parentResources.length && !schema.parentOptional && !parent)
          throw new BadRequestException('انتخاب پرونده والد الزامی است.');
        if (
          parent &&
          (parent.branchId !== branchId ||
            (schema.parentResources.length &&
              !schema.parentResources.includes(
                `${parent.section}.${parent.tab}`,
              )) ||
            (parent.employeeId &&
              parent.employeeId !== employee?.id &&
              schema.key !== 'organization.chartEmployees'))
        )
          throw new BadRequestException(
            'ارتباط پرونده والد با این رکورد معتبر نیست.',
          );
        await this.chartEmployee(
          tx,
          schema,
          employee,
          branchId,
          parent?.id ?? null,
          data,
          actor,
        );
        if (schema.key === 'organization.units')
          await this.unitCompany(tx, branchId, parent?.id ?? null, data, actor);
        if (missionExpenseResources.has(schema.key))
          this.expenseMission(parent, employee, data);
        const values = await this.values(
          tx,
          schema,
          input.values,
          employee,
          branchId,
          data,
          parent?.id,
        );
        if (missionExpenseResources.has(schema.key)) {
          const referenceIndex = schema.columns.indexOf('مأموریت مرجع');
          if (referenceIndex >= 0) values[referenceIndex] = parent?.code ?? '';
        }
        if (schema.key === 'recruitment.applicants' && parent) {
          if (parent.section !== 'recruitment' || parent.tab !== 'staffing')
            throw new BadRequestException(
              'متقاضی جدید باید به برنامه جذب ثبت‌شده متصل شود.',
            );
          const openingCompany = (parent.data as HrWorkflowData)
            .organizationBranchId;
          if (
            openingCompany &&
            data.organizationBranchId &&
            openingCompany !== data.organizationBranchId
          )
            throw new BadRequestException(
              'برنامه جذب باید متعلق به شرکت انتخاب‌شده باشد.',
            );
          const plan = parent.values as string[];
          values[1] = `برنامه ${plan[0] ?? ''} - ${plan[2] ?? ''}`.trim();
        }
        await this.validateRadanRelations(
          tx,
          schema,
          branchId,
          employee,
          parent?.id ?? null,
          values,
          actor,
        );
        if (schema.approval && employee)
          await this.attachRadanRoute(
            tx,
            schema,
            branchId,
            employee,
            values,
            data,
          );
        const state = validate.status(input.status, schema.approval);
        if (data.approvalRoute?.length && validate.APPROVED.has(state))
          throw new BadRequestException(
            'درخواست دارای روند باید ابتدا برای تأیید ثبت شود.',
          );
        const privateValues = privateHrResource(schema.key);
        const persistedValues = privateValues
          ? values.map(() => '••••')
          : values;
        const newId = randomUUID();
        let persistedData = privateValues
          ? {
              ...data,
              ...protectHrValues(
                values,
                `${branchId}:${employee?.id ?? parent?.id}:${schema.key}`,
              ),
            }
          : data;

        if (schema.approval && validate.APPROVED.has(state))
          await this.approve(tx, schema, actor, employee);
        if (schema.key === 'finance.batch' && validate.APPROVED.has(state))
          throw new ConflictException(
            'قرارداد عمومی دریافت ورودی پرداخت Finance هنوز منتشر نشده است.',
          );
        if (networkPassword !== undefined)
          persistedData = {
            ...persistedData,
            ...protectHrValues(
              [networkPassword],
              `${branchId}:${newId}:time.biometric`,
            ),
          };
        const row = await tx.hrRecord.create({
          data: {
            id: newId,
            branchId,
            employeeId: employee?.id ?? null,
            parentId: parent?.id ?? null,
            documentId,
            section: schema.section,
            tab: schema.tab,
            code: `HR-${randomUUID().slice(0, 16).toUpperCase()}`,
            values: persistedValues,
            searchText: privateValues ? '' : values.join(' '),
            expiresAt: this.expiry(schema, values),
            data: json(persistedData),
            status: state,
            effectiveAt: this.effective(schema, values, input.effectiveAt),
          },
        });
        await this.syncSharedReference(tx, row, actor);
        if (data.approvalRoute?.length)
          await this.syncRadanReviewers(tx, row, data);
        if (
          schema.key === 'lifecycle.onboarding' &&
          !validate.FINAL.has(state)
        ) {
          const created = await this.insertEmployee(
            tx,
            {
              branchId: row.branchId,
              organizationBranchId: data.organizationBranchId,
              name: values[0],
              unit: values[2],
              kind: values[3],
              position: values[4],
              grade: values[5],
              managerId: data.managerId,
              startedAtValue: values[7],
              status: 'در حال تکمیل',
            },
            actor,
          );
          await tx.hrRecord.update({
            where: { id: row.id },
            data: { employeeId: created.id },
          });
        }
        await this.amounts(tx, row, schema, values, data);
        if (schema.approval && validate.APPROVED.has(state))
          await this.effects(tx, row, schema, actor, employee);
        await this.audit(
          tx,
          actor,
          { branchId, employeeId: row.employeeId, recordId: row.id },
          'record.create',
          {
            fields: schema.fields.map((f) => f.label),
            values: privateValues ? undefined : values,
            data: privateValues ? undefined : data,
            employeeId: row.employeeId,
            parentId: row.parentId,
          },
          1,
          undefined,
          state,
        );
        return { id: row.id };
      },
    );
    return this.recordDto(
      await this.record(this.database.client, result.id, actor),
      actor,
    );
  }
  async updateRecord(id: string, body: unknown, actor: AuthenticatedActor) {
    const input = validate.object(body, [
      'privateData',
      'version',
      'values',
      'status',
      'effectiveAt',
      'data',
      'parentId',
    ]);
    const expected = validate.version(input.version);
    const providedData =
      input.data === undefined ? undefined : validate.workflowData(input.data);
    const docId = providedData?.documentId
      ? await this.documentReference(
          providedData.documentId,
          actor,
          (await this.record(this.database.client, id, actor)).branchId,
        )
      : undefined;
    return this.transaction(async (tx) => {
      const row = await this.record(tx, id, actor);
      if (row.sharedSourceId || (row.data as HrWorkflowData).allBranches) {
        const sourceId = row.sharedSourceId ?? row.id;
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${sourceId + ':shared-reference'},0))::text`;
        const fresh = await this.record(tx, id, actor);
        if (fresh.version !== row.version)
          throw new ConflictException('نسخه رکورد تغییر کرده است.');
      }
      if (row.version !== expected)
        throw new ConflictException('رکورد توسط کاربر دیگری تغییر کرده است.');
      if (
        row.section === 'payroll' &&
        row.tab === 'paymentRequests' &&
        ['تأییدشده', 'تاییدشده'].includes(row.status)
      )
        throw new ConflictException(
          'حقوق تأییدشده تغییر نمی‌کند؛ پس از برگشت مالی یک درخواست اصلاح‌شده ارسال کنید.',
        );
      const schema = validate.resource(row.section, row.tab);
      const networkPassword = this.devicePassword(
        input.privateData,
        schema,
        actor,
      );
      let parentId = row.parentId;
      if (input.parentId !== undefined) {
        if (
          ![
            'organization.units',
            'organization.chartEmployees',
            'recruitment.applicants',
          ].includes(schema.key) &&
          !missionExpenseResources.has(schema.key)
        )
          throw new BadRequestException(
            'تغییر والد برای این نوع رکورد مجاز نیست.',
          );
        parentId =
          input.parentId === null
            ? null
            : validate.uuid(input.parentId, 'والد');
        let cursor = parentId;
        const seen = new Set([row.id]);
        while (cursor) {
          if (seen.has(cursor))
            throw new BadRequestException('چرخه ساختار سازمانی مجاز نیست.');
          seen.add(cursor);
          const parent = await this.record(tx, cursor, actor);
          if (
            parent.branchId !== row.branchId ||
            !schema.parentResources.includes(`${parent.section}.${parent.tab}`)
          )
            throw new BadRequestException(
              'رکورد مرتبط باید از نوع مجاز و متعلق به همان شعبه باشد.',
            );
          cursor = [
            'organization.units',
            'organization.chartEmployees',
          ].includes(schema.key)
            ? parent.parentId
            : null;
        }
      }
      if (schema.key === 'time.checkins') {
        if (row.parentId)
          throw new ConflictException('تردد اصلاحی مصوب تغییرپذیر نیست.');
        await this.assertOpenPeriod(
          tx,
          row.branchId,
          (row.values as string[])[1]!,
        );
      }
      const employee = row.employeeId
        ? (row.data as HrWorkflowData).approvalRoute?.length &&
          this.has(actor, 'hr.approve')
          ? await tx.hrEmployee.findFirst({
              where: {
                id: row.employeeId,
                branchId: row.branchId,
                deletedAt: null,
              },
            })
          : await this.employee(tx, row.employeeId, actor)
        : null;
      if (providedData?.organizationBranchId)
        await this.organizationBranch(
          tx,
          providedData.organizationBranchId,
          schema.key === 'lifecycle.transfer' &&
            (providedData.targetBranchId ??
              (row.data as HrWorkflowData).targetBranchId)
            ? this.branch(
                actor,
                providedData.targetBranchId ??
                  (row.data as HrWorkflowData).targetBranchId,
              )
            : row.branchId,
          actor,
        );
      let state = validate.status(input.status, schema.approval, row.status);
      if (
        schema.key === 'organization.branches' &&
        state !== 'فعال' &&
        (await this.companyDependants(tx, row.id))
      )
        throw new ConflictException('شعبه سازمانی دارای رکورد وابسته است.');
      if (
        schema.key === 'organization.branches' &&
        state !== 'فعال' &&
        (await tx.hrEmployee.count({
          where: {
            organizationBranchId: row.id,
            deletedAt: null,
            status: 'فعال',
          },
        }))
      )
        throw new ConflictException('شعبه سازمانی دارای کارمند فعال است.');
      if (
        (row.data as HrWorkflowData).approvalStep &&
        input.values !== undefined
      )
        throw new ConflictException(
          'محتوای درخواست پس از شروع تأیید تغییر نمی‌کند.',
        );
      const approvalAction =
        schema.approval &&
        state !== row.status &&
        ['تأییدشده', 'تاییدشده', 'فعال', 'آماده شروع', 'ردشده'].includes(state);
      if (
        approvalAction &&
        (row.data as HrWorkflowData).approvalRoute?.length
      ) {
        this.require(actor, 'hr.approve');
        if (schema.sensitive) this.require(actor, 'hr.sensitive');
        if (employee?.userId === actor.userId)
          throw new ForbiddenException('تأیید درخواست خود مجاز نیست.');
      } else if (approvalAction)
        await this.approve(tx, schema, actor, employee);
      else this.writeResource(schema, actor, employee);
      const cancel = state === 'لغوشده' && validate.APPROVED.has(row.status);
      if (schema.approval && validate.FINAL.has(row.status) && !cancel)
        throw new ConflictException(
          'رکورد نهایی تغییرپذیر نیست؛ اصلاحیه مرتبط ثبت کنید.',
        );
      if (
        cancel &&
        (!isOptionalOperationReason(providedData?.reason) ||
          input.values !== undefined ||
          input.parentId !== undefined ||
          input.effectiveAt !== undefined)
      )
        throw new BadRequestException(
          'لغو فقط با دلیل و بدون تغییر داده مصوب مجاز است.',
        );
      if (cancel && row.appliedAt && jobResources.has(schema.key))
        throw new ConflictException(
          'تغییر شغلی اعمال‌شده فقط با حکم اصلاحی جدید قابل جبران است.',
        );
      if (
        approvalAction &&
        (input.values !== undefined ||
          input.effectiveAt !== undefined ||
          input.parentId !== undefined)
      )
        throw new BadRequestException(
          'تأیید و تغییر محتوا باید در درخواست‌های جدا ثبت شوند.',
        );
      if (
        (approvalAction || cancel) &&
        providedData &&
        Object.keys(providedData).some((k) => k !== 'reason')
      )
        throw new BadRequestException(
          'عملیات تأیید یا لغو فقط دلیل را می‌پذیرد.',
        );
      if (schema.key === 'finance.batch' && validate.APPROVED.has(state))
        throw new ConflictException('دریافت Finance هنوز در دسترس نیست.');
      const data = { ...(row.data as HrWorkflowData), ...providedData };
      if (data.allBranches) {
        if (!isHrSharedResource(schema.section, schema.tab) || employee)
          throw new BadRequestException('دامنه شعبه معتبر نیست.');
        delete data.organizationBranchId;
      }
      if (
        (row.sharedSourceId || (row.data as HrWorkflowData).allBranches) &&
        !data.allBranches
      )
        throw new ConflictException('دامنه اطلاعات مشترک تغییرپذیر نیست.');
      if (approvalAction && data.approvalRoute?.length) {
        if (!/انتظار|بررسی/.test(row.status))
          throw new ConflictException(
            'درخواست باید ابتدا برای تأیید ارسال شود.',
          );
        const route = structuredClone(data.approvalRoute);
        const step = data.approvalStep ?? 0;
        const current = route[step];
        if (!current) throw new ConflictException('مرحله تأیید معتبر نیست.');
        const assigned = await tx.hrEmployee.findFirst({
          where: {
            id: current.employeeId,
            branchId: row.branchId,
            status: 'فعال',
            deletedAt: null,
          },
        });
        if (!assigned)
          throw new ForbiddenException('تأییدکننده فعال در شعبه درخواست نیست.');
        const senior =
          current.senior && assigned.managerId
            ? await tx.hrEmployee.findFirst({
                where: {
                  id: assigned.managerId,
                  branchId: row.branchId,
                  status: 'فعال',
                  deletedAt: null,
                },
              })
            : null;
        if (assigned.userId !== actor.userId && senior?.userId !== actor.userId)
          throw new ForbiddenException('درخواست در مرحله تأیید شما نیست.');
        current.decidedBy = actor.userId;
        current.decidedAt = new Date().toISOString();
        data.approvalRoute = route;
        if (validate.APPROVED.has(state)) {
          data.approvalStep = step + 1;
          if (step + 1 < route.length) state = 'در انتظار تأیید';
        }
      }

      const missionParent =
        missionExpenseResources.has(schema.key) &&
        (input.parentId !== undefined ||
          input.values !== undefined ||
          providedData?.organizationBranchId !== undefined)
          ? parentId
            ? await this.record(tx, parentId, actor)
            : null
          : undefined;
      if (missionParent !== undefined)
        this.expenseMission(missionParent, employee, data);
      this.chartCoordinates(schema, data);
      await this.chartEmployee(
        tx,
        schema,
        employee,
        row.branchId,
        parentId,
        data,
        actor,
        row.id,
      );
      if (schema.key === 'organization.units')
        await this.unitCompany(tx, row.branchId, parentId, data, actor, row.id);
      const values =
        input.values === undefined &&
        (cancel ||
          !['time.corrections', 'requests.attendance'].includes(schema.key))
          ? privateHrResource(schema.key)
            ? revealHrValues(
                row.data,
                `${row.branchId}:${row.employeeId ?? row.parentId}:${schema.key}`,
              )
            : (row.values as string[])
          : await this.values(
              tx,
              schema,
              schema.key === 'employee.identity'
                ? this.compatibleIdentityInput(input.values ?? row.values, row)
                : this.compatibleTimeInput(input.values ?? row.values, row),
              employee,
              row.branchId,
              data,
              parentId,
            );
      if (missionParent !== undefined) {
        const referenceIndex = schema.columns.indexOf('مأموریت مرجع');
        if (referenceIndex >= 0)
          values[referenceIndex] = missionParent?.code ?? '';
      }
      if (schema.key === 'recruitment.applicants' && parentId) {
        const plan = await this.record(tx, parentId, actor);
        if (plan.tab !== 'staffing' && parentId !== row.parentId)
          throw new BadRequestException(
            'متقاضی باید به برنامه جذب ثبت‌شده متصل شود.',
          );
        const openingCompany = (plan.data as HrWorkflowData)
          .organizationBranchId;
        if (
          openingCompany &&
          data.organizationBranchId &&
          openingCompany !== data.organizationBranchId
        )
          throw new BadRequestException(
            'برنامه جذب باید متعلق به شرکت انتخاب‌شده باشد.',
          );
        const source = plan.values as string[];
        values[1] =
          plan.tab === 'staffing'
            ? `برنامه ${source[0] ?? ''} - ${source[2] ?? ''}`.trim()
            : (source[0] ?? '');
      }
      if (
        schema.key === 'lifecycle.onboarding' &&
        row.employeeId &&
        input.values !== undefined &&
        !validate.APPROVED.has(state)
      ) {
        await tx.hrEmployee.update({
          where: { id: row.employeeId },
          data: {
            name: validate.text(values[0], 'نام'),
            unit: values[2] ?? '',
            kind: validate.text(values[3], 'نوع همکاری', 80),
            position: validate.text(values[4], 'سمت'),
            grade: validate.text(values[5], 'رده', 40),
            managerId: await this.manager(
              tx,
              data.managerId,
              row.branchId,
              actor,
              row.employeeId,
            ),
            startedAt: validate.isoDate(values[7]),
            version: { increment: 1 },
          },
        });
      }
      await this.validateRadanRelations(
        tx,
        schema,
        row.branchId,
        employee,
        parentId,
        values,
        actor,
        row.id,
      );
      if (
        input.values !== undefined &&
        schema.approval &&
        employee &&
        !(data.approvalStep ?? 0)
      ) {
        delete data.approvalRoute;
        delete data.approvalStep;
        await this.attachRadanRoute(
          tx,
          schema,
          row.branchId,
          employee,
          values,
          data,
        );
      }
      const privateValues = privateHrResource(schema.key);
      const persistedValues = privateValues ? values.map(() => '••••') : values;
      let persistedData = privateValues
        ? {
            ...publicHrData(data),
            ...protectHrValues(
              values,
              `${row.branchId}:${row.employeeId ?? parentId}:${schema.key}`,
            ),
          }
        : data;
      if (networkPassword !== undefined)
        persistedData = {
          ...persistedData,
          ...protectHrValues(
            [networkPassword],
            `${row.branchId}:${row.id}:time.biometric`,
          ),
        };
      const changed = await tx.hrRecord.updateMany({
        where: { id, version: expected, deletedAt: null },
        data: {
          parentId,
          values: persistedValues,
          searchText: privateValues ? '' : values.join(' '),
          expiresAt: this.expiry(schema, values),
          status: state,
          data: json(persistedData),
          ...(docId ? { documentId: docId } : {}),
          ...(input.effectiveAt !== undefined || input.values !== undefined
            ? { effectiveAt: this.effective(schema, values, input.effectiveAt) }
            : {}),
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1)
        throw new ConflictException('نسخه رکورد تغییر کرده است.');
      const updated = await tx.hrRecord.findUniqueOrThrow({ where: { id } });
      await this.syncSharedReference(tx, updated, actor);
      if (
        data.approvalRoute?.length &&
        (input.status !== undefined || input.values !== undefined)
      )
        await this.syncRadanReviewers(tx, updated, data);
      if (
        schema.key === 'lifecycle.onboarding' &&
        row.employeeId &&
        ['ردشده', 'لغوشده'].includes(state)
      ) {
        await tx.hrEmployee.updateMany({
          where: {
            id: row.employeeId,
            status: 'در حال تکمیل',
            deletedAt: null,
          },
          data: {
            status: 'لغوشده',
            deletedAt: new Date(),
            version: { increment: 1 },
          },
        });
      }
      await this.amounts(tx, updated, schema, values, data);
      if (approvalAction && validate.APPROVED.has(state))
        await this.effects(tx, updated, schema, actor, employee);
      if (cancel && schema.key === 'requests.radanLeave' && employee) {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${employee.id + ':minute-leave'}, 0))::text`;
        const entries = await tx.hrRecord.findMany({
          where: {
            parentId: row.id,
            section: 'time',
            tab: 'minuteLedger',
            deletedAt: null,
          },
        });
        for (const entry of entries) {
          const v = entry.values as string[];
          if (v[4] === 'مصرف')
            await this.minuteEntry(
              tx,
              employee,
              Number(v[1]),
              Number(v[2]),
              v[3]!,
              -Number(v[5]),
              'برگشت مصرف',
              row.id,
              actor,
            );
        }
      }
      if (cancel) await this.cancelEffects(tx, updated, schema);
      await this.audit(
        tx,
        actor,
        { branchId: row.branchId, employeeId: row.employeeId, recordId: id },
        approvalAction
          ? 'record.approve'
          : cancel
            ? 'record.cancel'
            : 'record.update',
        {
          fields: Object.keys(input),
          reason: providedData?.reason ?? null,
          before: {
            values: privateValues ? undefined : row.values,
            data: privateValues ? undefined : publicHrData(row.data),
            status: row.status,
            parentId: row.parentId,
          },
          after: privateValues
            ? { status: state, parentId }
            : { values, data: publicHrData(data), status: state, parentId },
        },
        expected + 1,
        row.status,
        state,
      );
      return this.recordDto(
        await tx.hrRecord.findUniqueOrThrow({ where: { id } }),
        actor,
      );
    });
  }
  async contractState(
    id: string,
    body: unknown,
    key: unknown,
    actor: AuthenticatedActor,
  ) {
    this.require(actor, 'hr.manage');
    this.require(actor, 'hr.approve');
    this.require(actor, 'hr.sensitive');
    const input = validate.object(body, [
      'version',
      'state',
      'signedDocumentId',
      'documentId',
      'reason',
    ]);
    const version = validate.version(input.version);
    const state = validate.text(input.state, 'مرحله قرارداد', 20);
    if (!['SIGNED', 'ACTIVE', 'ENDED'].includes(state))
      throw new BadRequestException('مرحله قرارداد معتبر نیست.');
    const reason =
      input.reason === undefined
        ? undefined
        : validate.text(input.reason, 'دلیل', 1000);
    if (state === 'ENDED' && !isOptionalOperationReason(reason))
      throw new BadRequestException('دلیل پایان قرارداد الزامی است.');
    if (
      input.signedDocumentId &&
      input.documentId &&
      input.signedDocumentId !== input.documentId
    )
      throw new BadRequestException('مرجع نسخه امضاشده یکسان نیست.');
    const reference = input.signedDocumentId ?? input.documentId;
    if (state === 'SIGNED' && !reference)
      throw new BadRequestException('مرجع سند نسخه امضاشده الزامی است.');
    if (state !== 'SIGNED' && reference)
      throw new BadRequestException(
        'مرجع نسخه فقط در ثبت امضا پذیرفته می‌شود.',
      );
    const visible = await this.record(
      this.database.client,
      validate.uuid(id),
      actor,
    );
    const signedDocumentId = reference
      ? await this.documentReference(reference, actor, visible.branchId)
      : undefined;
    const result = await this.command(
      actor,
      key,
      { operation: 'contract.state', id, input },
      async (tx) => {
        const row = await this.record(tx, id, actor);
        if (row.version !== version)
          throw new ConflictException('نسخه قرارداد تغییر کرده است.');
        const schema = validate.resource(row.section, row.tab);
        if (
          schema.key !== 'contracts.active' ||
          !validate.APPROVED.has(row.status)
        )
          throw new ConflictException('قرارداد باید ابتدا تأیید شود.');
        const employee = row.employeeId
          ? await this.employee(tx, row.employeeId, actor)
          : null;
        await this.approve(tx, schema, actor, employee);
        const previous = (row.data as HrWorkflowData).contractState;
        if (
          (state === 'SIGNED' && previous) ||
          (state === 'ACTIVE' && previous !== 'SIGNED') ||
          (state === 'ENDED' && !['SIGNED', 'ACTIVE'].includes(previous ?? ''))
        )
          throw new ConflictException('ترتیب مرحله قرارداد معتبر نیست.');
        if (state === 'ACTIVE') {
          const values = row.values as string[],
            today = new Date().toISOString().slice(0, 10);
          if (values[4]! > today || values[5]! < today)
            throw new ConflictException(
              'قرارداد خارج از بازه تاریخ اعتبار است.',
            );
          await this.effects(tx, row, schema, actor, employee);
        }
        const data: HrWorkflowData = {
          ...(row.data as HrWorkflowData),
          contractState: state as 'SIGNED' | 'ACTIVE' | 'ENDED',
          contractStateChangedAt: new Date().toISOString(),
          ...(signedDocumentId ? { signedDocumentId } : {}),
          ...(reason ? { contractStateReason: reason } : {}),
        };
        const changed = await tx.hrRecord.updateMany({
          where: { id, version, deletedAt: null },
          data: {
            data: json(data),
            ...(signedDocumentId ? { documentId: signedDocumentId } : {}),
            version: { increment: 1 },
          },
        });
        if (changed.count !== 1)
          throw new ConflictException('نسخه قرارداد تغییر کرده است.');
        await this.audit(
          tx,
          actor,
          { branchId: row.branchId, employeeId: row.employeeId, recordId: id },
          'contract.state',
          {
            before: row.data,
            after: data,
            reason: reason ?? null,
            signedCopyOnly: true,
          },
          version + 1,
          previous ?? 'APPROVED',
          state,
        );
        return { id };
      },
    );
    return this.recordDto(
      await this.record(this.database.client, result.id, actor),
      actor,
    );
  }
  async deleteRecord(id: string, expected: unknown, actor: AuthenticatedActor) {
    const v = validate.version(Number(expected));
    return this.transaction(async (tx) => {
      const row = await this.record(tx, id, actor);
      if (row.sharedSourceId || (row.data as HrWorkflowData).allBranches) {
        const sourceId = row.sharedSourceId ?? row.id;
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${sourceId + ':shared-reference'},0))::text`;
        const current = await this.record(tx, id, actor);
        if (current.version !== v)
          throw new ConflictException('نسخه رکورد تغییر کرده است.');
        this.writeResource(
          validate.resource(row.section, row.tab),
          actor,
          null,
        );
        const members = await tx.hrRecord.findMany({
          where: {
            OR: [{ id: sourceId }, { sharedSourceId: sourceId }],
            deletedAt: null,
          },
        });
        if (members.some((m) => !actor.branchIds.includes(m.branchId)))
          throw new ForbiddenException(
            'ویرایش اطلاعات مشترک نیازمند دسترسی همه شعبه‌ها است.',
          );
        for (const member of members) {
          if (
            (await tx.hrRecord.count({
              where: { parentId: member.id, deletedAt: null },
            })) ||
            (await tx.hrEmployee.count({
              where: {
                deletedAt: null,
                OR: [
                  { organizationBranchId: member.id },
                  { jobTitleId: member.id },
                ],
              },
            })) ||
            (await this.companyDependants(tx, member.id))
          )
            throw new ConflictException('پرونده دارای رکورد وابسته فعال است.');
        }
        await tx.hrRecord.updateMany({
          where: { id: { in: members.map((m) => m.id) }, deletedAt: null },
          data: { deletedAt: new Date(), version: { increment: 1 } },
        });
        for (const member of members)
          await this.audit(
            tx,
            actor,
            { branchId: member.branchId, recordId: member.id },
            'reference.shared.delete',
            { sourceId },
            member.version + 1,
          );
        return { id, deleted: true };
      }
      if (
        await tx.hrEmployee.count({
          where: { organizationBranchId: row.id, deletedAt: null },
        })
      )
        throw new ConflictException(
          'این شعبه سازمانی به پرونده کارکنان متصل است.',
        );
      const schema = validate.resource(row.section, row.tab);
      if (
        schema.key === 'organization.branches' &&
        (await this.companyDependants(tx, row.id))
      )
        throw new ConflictException('شعبه سازمانی دارای رکورد وابسته است.');
      if (schema.key === 'time.checkins') {
        if (row.parentId)
          throw new ConflictException('تردد اصلاحی مصوب تغییرپذیر نیست.');
        await this.assertOpenPeriod(
          tx,
          row.branchId,
          (row.values as string[])[1]!,
        );
      }
      const employee = row.employeeId
        ? await this.employee(tx, row.employeeId, actor)
        : null;
      this.writeResource(schema, actor, employee);
      if (schema.approval && validate.FINAL.has(row.status))
        throw new ConflictException(
          'تاریخچه نهایی حذف نمی‌شود؛ از لغو یا اصلاحیه استفاده کنید.',
        );
      if (await tx.hrRecord.count({ where: { parentId: id, deletedAt: null } }))
        throw new ConflictException('پرونده دارای رکورد وابسته فعال است.');
      const changed = await tx.hrRecord.updateMany({
        where: { id, version: v, deletedAt: null },
        data: { deletedAt: new Date(), version: { increment: 1 } },
      });
      if (changed.count !== 1)
        throw new ConflictException('نسخه رکورد تغییر کرده است.');
      if (schema.key === 'lifecycle.onboarding' && row.employeeId) {
        await tx.hrEmployee.updateMany({
          where: {
            id: row.employeeId,
            status: 'در حال تکمیل',
            deletedAt: null,
          },
          data: {
            status: 'لغوشده',
            deletedAt: new Date(),
            version: { increment: 1 },
          },
        });
      }
      await this.audit(
        tx,
        actor,
        { branchId: row.branchId, employeeId: row.employeeId, recordId: id },
        'record.delete',
        {},
        v + 1,
      );
      return { id, deleted: true };
    });
  }
  private async effects(
    tx: Tx,
    row: RecordRow,
    schema: HrResourceDefinition,
    actor: AuthenticatedActor,
    employee: Employee | null,
  ) {
    const values = row.values as string[];
    const data = row.data as HrWorkflowData;
    if (schema.key === 'lifecycle.onboarding') {
      if (row.employeeId) {
        const changed = await tx.hrEmployee.updateMany({
          where: {
            id: row.employeeId,
            status: 'در حال تکمیل',
            deletedAt: null,
          },
          data: { status: 'فعال', version: { increment: 1 } },
        });
        if (!changed.count)
          throw new ConflictException('وضعیت نیروی جدید معتبر نیست.');
        await tx.hrRecord.update({
          where: { id: row.id },
          data: { appliedAt: new Date() },
        });
        return;
      }
      const created = await this.insertEmployee(
        tx,
        {
          branchId: row.branchId,
          name: values[0],
          unit: values[2],
          kind: values[3],
          position: values[4],
          grade: values[5],
          managerId: data.managerId,
          startedAtValue: values[7],
        },
        actor,
      );
      await tx.hrRecord.update({
        where: { id: row.id },
        data: { employeeId: created.id, appliedAt: new Date() },
      });
    }
    if (jobResources.has(schema.key)) {
      if (!employee || !row.effectiveAt)
        throw new BadRequestException(
          'کارمند و تاریخ اثر برای حکم الزامی‌اند.',
        );
      if (row.effectiveAt < employee.startedAt)
        throw new BadRequestException('تاریخ اثر پیش از شروع همکاری است.');
      const overlap = await tx.hrRecord.findFirst({
        where: {
          employeeId: employee.id,
          section: 'lifecycle',
          tab: { in: ['promotion', 'transfer', 'separation'] },
          status: { in: [...validate.APPROVED] },
          effectiveAt: row.effectiveAt,
          deletedAt: null,
          id: { not: row.id },
        },
      });
      if (overlap)
        throw new ConflictException('حکم دیگری برای همین تاریخ اثر وجود دارد.');
      if (
        await tx.hrRecord.count({
          where: {
            employeeId: employee.id,
            section: 'lifecycle',
            tab: { in: ['promotion', 'transfer', 'separation'] },
            deletedAt: null,
            appliedAt: { not: null },
            effectiveAt: { gt: row.effectiveAt },
          },
        })
      )
        throw new ConflictException(
          'حکم با تاریخ پیش از آخرین تغییر اعمال‌شده قابل اجرا نیست؛ حکم اصلاحی با تاریخ جدید ثبت کنید.',
        );
      if (schema.key === 'lifecycle.transfer')
        this.branch(actor, data.targetBranchId ?? values[3]);
      if (row.effectiveAt <= new Date())
        await this.applyJob(tx, row, employee, actor);
    }
    if (schema.key === 'requests.radanLeave' && employee) {
      const from = validate.isoDate(values[2]),
        to = validate.isoDate(values[3]);
      const yearOf = (d: Date) =>
        Number(
          new Intl.DateTimeFormat('en-u-ca-persian', {
            year: 'numeric',
            timeZone: 'UTC',
          }).format(d),
        );
      const year = yearOf(from);
      if (year !== yearOf(to) || to.getTime() - from.getTime() > 366 * 86400000)
        throw new BadRequestException('مرخصی هر سال شمسی جدا ثبت شود.');
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${employee.id + ':minute-leave'}, 0))::text`;
      const peers = await tx.hrRecord.findMany({
        where: {
          employeeId: employee.id,
          section: 'requests',
          tab: 'radanLeave',
          status: { in: [...validate.APPROVED] },
          deletedAt: null,
          id: { not: row.id },
        },
      });
      if (
        peers.some((r) => {
          const d = r.data as HrWorkflowData;
          return (
            d.startsAt &&
            d.endsAt &&
            d.startsAt < data.endsAt! &&
            d.endsAt > data.startsAt!
          );
        })
      )
        throw new ConflictException('مرخصی تأییدشده هم‌پوشان وجود دارد.');
      const settings = await tx.hrRecord.findFirst({
        where: {
          branchId: row.branchId,
          section: 'time',
          tab: 'calculationSettings',
          status: 'فعال',
          deletedAt: null,
        },
      });
      const config = settings?.values as string[] | undefined;
      let minutes = data.minutes ?? 0;
      if (values[4] === 'روزانه') {
        if (!config)
          throw new ConflictException(
            'ابتدا طول مرخصی روزانه را در تنظیمات کارکرد ثبت کنید.',
          );
        for (let at = from.getTime(); at <= to.getTime(); at += 86400000) {
          const date = new Date(at).toISOString().slice(0, 10);
          await this.assertOpenPeriod(tx, row.branchId, date);
          if (config[2] === 'بله') {
            const shifts = await tx.hrRecord.findMany({
              where: {
                branchId: row.branchId,
                employeeId: employee.id,
                section: 'time',
                tab: 'shift',
                status: 'فعال',
                deletedAt: null,
              },
            });
            const view = this.attendanceView(shifts, employee.id, date);
            if (!view.shiftStart || !view.shiftEnd)
              throw new ConflictException(
                'طول شیفت مصوب برای روز مرخصی مشخص نیست.',
              );
            minutes +=
              (view.shiftEnd.getTime() - view.shiftStart.getTime()) / 60000;
          } else minutes += Number(config[3]);
        }
      } else await this.assertOpenPeriod(tx, row.branchId, values[2]!);
      if (
        (await this.minuteBalance(tx, employee.id, year, values[1]!)) < minutes
      )
        throw new ConflictException('مانده دقیقه‌ای مرخصی کافی نیست.');
      const month = Number(
        new Intl.DateTimeFormat('en-u-ca-persian', {
          month: 'numeric',
          timeZone: 'UTC',
        }).format(from),
      );
      await this.minuteEntry(
        tx,
        employee,
        year,
        month,
        values[1]!,
        -minutes,
        'مصرف',
        row.id,
        actor,
      );
      await tx.hrRecord.update({
        where: { id: row.id },
        data: { appliedAt: new Date(), data: json({ ...data, minutes }) },
      });
    }
    if (['time.leave', 'requests.leave'].includes(schema.key)) {
      if (!employee) throw new BadRequestException('کارمند الزامی است.');
      const from = validate.isoDate(values[2]),
        to = validate.isoDate(values[3]);
      await this.assertOpenPeriod(tx, row.branchId, values[2]!);
      await this.assertOpenPeriod(tx, row.branchId, values[3]!);
      const days = new Prisma.Decimal(validate.digits(values[4] ?? ''));
      const span = (to.getTime() - from.getTime()) / 86400000 + 1;
      if (
        days.lte(0) ||
        days.gt(span) ||
        span > 366 ||
        from.getUTCFullYear() !== to.getUTCFullYear()
      )
        throw new BadRequestException(
          'تعداد روز یا بازه مرخصی معتبر نیست؛ درخواست هر سال جدا باشد.',
        );
      const type = values[1]!;
      const candidates = await tx.hrRecord.findMany({
        where: {
          employeeId: employee.id,
          section: { in: ['time', 'requests'] },
          tab: 'leave',
          status: { in: [...validate.APPROVED] },
          deletedAt: null,
          id: { not: row.id },
        },
        take: 2000,
      });
      if (
        candidates.some((item) => {
          const v = item.values as string[];
          return v[2]! <= values[3]! && v[3]! >= values[2]!;
        })
      )
        throw new ConflictException(
          'مرخصی با درخواست تأییدشده دیگری هم‌پوشان است.',
        );
      const totals = await tx.hrLeaveEntry.aggregate({
        where: { employeeId: employee.id, type, year: from.getUTCFullYear() },
        _sum: { days: true },
      });
      if ((totals._sum.days ?? new Prisma.Decimal(0)).lt(days))
        throw new ConflictException(
          'مانده مرخصی کافی نیست؛ سهمیه مصوب باید ابتدا ثبت شود.',
        );
      await tx.hrLeaveEntry.create({
        data: {
          employeeId: employee.id,
          recordId: row.id,
          type,
          year: from.getUTCFullYear(),
          days: days.negated(),
          action: 'CONSUME',
        },
      });
      await tx.hrRecord.update({
        where: { id: row.id },
        data: { appliedAt: new Date() },
      });
    }
    if (schema.key === 'contracts.active' && employee) {
      const from = validate.isoDate(values[4]),
        to = validate.isoDate(values[5]);
      if (to < from) throw new BadRequestException('بازه قرارداد معتبر نیست.');
      const existing = await tx.hrRecord.findMany({
        where: {
          employeeId: employee.id,
          section: 'contracts',
          tab: 'active',
          status: { in: [...validate.APPROVED] },
          deletedAt: null,
          id: { not: row.id },
        },
        take: 2000,
      });
      if (
        existing.some((item) => {
          const v = item.values as string[];
          return (
            v[3]?.trim() === values[3]?.trim() &&
            (item.data as HrWorkflowData).contractState !== 'ENDED' &&
            v[4]! <= values[5]! &&
            v[5]! >= values[4]!
          );
        })
      )
        throw new ConflictException('قرارداد فعال هم‌پوشان وجود دارد.');
    }
    if (['time.corrections', 'requests.attendance'].includes(schema.key)) {
      if (!employee || !data.startsAt || !data.endsAt)
        throw new BadRequestException(
          'اصلاح حضور نیازمند زمان شروع و پایان UTC معتبر است.',
        );
      await this.assertOpenPeriod(tx, row.branchId, values[1]!);
      for (const [at, kind] of [
        [data.startsAt, 'ورود'],
        [data.endsAt, 'خروج'],
      ] as const) {
        const moment = new Date(at);
        const { date, time } = validate.localClockParts(moment);
        await this.assertOpenPeriod(tx, row.branchId, date);
        await tx.hrRecord.create({
          data: {
            branchId: row.branchId,
            employeeId: employee.id,
            parentId: row.id,
            section: 'time',
            tab: 'checkins',
            code: `HR-COR-${randomUUID().slice(0, 12)}`,
            values: [
              employee.name,
              date,
              time,
              kind,
              'اصلاح مصوب',
              row.branchId,
            ],
            data: { startsAt: at },
            effectiveAt: validate.isoDate(date),
            status: 'معتبر',
          },
        });
      }
      await tx.hrRecord.update({
        where: { id: row.id },
        data: { appliedAt: new Date() },
      });
    }
  }
  private async applyJob(
    tx: Tx,
    row: RecordRow,
    employee: Employee,
    actor: AuthenticatedActor,
  ) {
    if (row.appliedAt) return;
    const values = row.values as string[],
      data = row.data as HrWorkflowData;
    const targetBranch =
      row.tab === 'transfer'
        ? this.branch(actor, data.targetBranchId ?? values[3])
        : employee.branchId;
    const managerId =
      data.managerId === undefined
        ? targetBranch === employee.branchId
          ? employee.managerId
          : null
        : await this.manager(
            tx,
            data.managerId,
            targetBranch,
            actor,
            employee.id,
          );
    const change: Prisma.HrEmployeeUncheckedUpdateInput = {
      version: { increment: 1 },
    };
    if (data.managerId !== undefined) change.managerId = managerId;
    if (row.tab === 'promotion') {
      change.position = validate.text(values[3], 'سمت');
      change.jobTitleId = null;
      change.grade = validate.text(values[4], 'رده', 40);
    }
    if (row.tab === 'transfer') {
      change.branchId = targetBranch;
      change.organizationBranchId = data.organizationBranchId
        ? await this.organizationBranch(
            tx,
            data.organizationBranchId,
            targetBranch,
            actor,
          )
        : targetBranch === employee.branchId
          ? employee.organizationBranchId
          : null;
      change.unit = validate.text(values[4], 'واحد');
      change.managerId = managerId;
    }
    if (row.tab === 'separation') {
      if (
        await tx.hrEmployee.count({
          where: { managerId: employee.id, deletedAt: null, status: 'فعال' },
        })
      )
        throw new ConflictException(
          'ابتدا مدیر کارکنان زیرمجموعه را تعیین کنید.',
        );
      const assets = await tx.hrRecord.count({
        where: {
          employeeId: employee.id,
          section: 'assets',
          tab: 'list',
          deletedAt: null,
          status: {
            notIn: ['تحویل‌شده', 'بازگردانده‌شده', 'غیرفعال', 'لغوشده'],
          },
        },
      });
      if (assets)
        throw new ConflictException(
          'دارایی‌های تحویل‌داده‌نشده مانع پایان همکاری هستند.',
        );
      change.status = 'پایان همکاری';
    }
    const updated = await tx.hrEmployee.update({
      where: { id: employee.id, version: employee.version },
      data: change,
    });
    await tx.hrRecord.update({
      where: { id: row.id },
      data: { appliedAt: new Date() },
    });
    await tx.hrRecord.create({
      data: {
        branchId: updated.branchId,
        employeeId: updated.id,
        jobTitleId: updated.jobTitleId,
        section: 'employee',
        tab: 'assignment',
        code: `HR-ASG-${randomUUID().slice(0, 12)}`,
        values: [
          updated.branchId,
          updated.unit,
          updated.position,
          updated.managerId ?? '',
          row.effectiveAt!.toISOString().slice(0, 10),
        ],
        status: updated.status,
        effectiveAt: row.effectiveAt,
        appliedAt: new Date(),
      },
    });
    await this.audit(
      tx,
      actor,
      { branchId: row.branchId, employeeId: employee.id, recordId: row.id },
      'assignment.apply',
      {
        before: {
          branchId: employee.branchId,
          unit: employee.unit,
          position: employee.position,
          grade: employee.grade,
          managerId: employee.managerId,
          status: employee.status,
        },
        after: {
          branchId: updated.branchId,
          unit: updated.unit,
          position: updated.position,
          grade: updated.grade,
          managerId: updated.managerId,
          status: updated.status,
        },
        iamAccessReviewRequired: row.tab === 'separation',
      },
      updated.version,
    );
  }
  private async applyDue(actor: AuthenticatedActor) {
    const rows = await this.database.client.hrRecord.findMany({
      where: {
        branchId: { in: actor.branchIds },
        section: 'lifecycle',
        tab: { in: ['promotion', 'transfer', 'separation'] },
        status: { in: [...validate.APPROVED] },
        deletedAt: null,
        appliedAt: null,
        effectiveAt: { lte: new Date() },
      },
      orderBy: [{ effectiveAt: 'asc' }, { createdAt: 'asc' }],
      take: 200,
    });
    const warnings: { recordId: string; message: string }[] = [];
    for (const candidate of rows) {
      try {
        await this.transaction(async (tx) => {
          const row = await this.record(tx, candidate.id, actor);
          if (
            row.appliedAt ||
            !validate.APPROVED.has(row.status) ||
            !row.effectiveAt ||
            row.effectiveAt > new Date()
          )
            return;
          const employee = await this.employee(tx, row.employeeId!, actor);
          await this.applyJob(tx, row, employee, actor);
        });
      } catch (error) {
        if (
          error instanceof ConflictException ||
          error instanceof BadRequestException ||
          error instanceof ForbiddenException ||
          error instanceof NotFoundException
        )
          warnings.push({ recordId: candidate.id, message: error.message });
        else throw error;
      }
    }
    return warnings;
  }
  private async cancelEffects(
    tx: Tx,
    row: RecordRow,
    schema: HrResourceDefinition,
  ) {
    if (['time.leave', 'requests.leave'].includes(schema.key)) {
      const values = row.values as string[];
      await this.assertOpenPeriod(tx, row.branchId, values[2]!);
      await this.assertOpenPeriod(tx, row.branchId, values[3]!);
      const entry = await tx.hrLeaveEntry.findUnique({
        where: { recordId_action: { recordId: row.id, action: 'CONSUME' } },
      });
      if (entry)
        await tx.hrLeaveEntry.create({
          data: {
            employeeId: entry.employeeId,
            recordId: row.id,
            type: entry.type,
            year: entry.year,
            days: entry.days.negated(),
            action: 'REVERSE',
          },
        });
    }
    if (
      ['time.corrections', 'requests.attendance'].includes(schema.key) &&
      row.appliedAt
    )
      throw new ConflictException(
        'اصلاح حضور اعمال‌شده با درخواست اصلاحی جدید جبران می‌شود.',
      );
    if (schema.key === 'lifecycle.onboarding' && row.appliedAt)
      throw new ConflictException(
        'ورود اعمال‌شده فقط از مسیر پایان همکاری تغییر می‌کند.',
      );
  }
  async processWorkflows(
    body: unknown,
    key: unknown,
    actor: AuthenticatedActor,
  ) {
    this.require(actor, 'hr.manage');
    this.require(actor, 'hr.approve');
    const input = validate.object(body, ['branchId']);
    const branchId = this.branch(actor, input.branchId);
    return this.command(
      actor,
      key,
      { operation: 'workflows.process', input },
      async (tx) => {
        const rows = await tx.hrRecord.findMany({
          where: {
            branchId,
            section: 'lifecycle',
            tab: { in: ['promotion', 'transfer', 'separation'] },
            status: { in: [...validate.APPROVED] },
            deletedAt: null,
            appliedAt: null,
            effectiveAt: { lte: new Date() },
          },
          orderBy: [{ effectiveAt: 'asc' }, { createdAt: 'asc' }],
          take: 200,
        });
        for (const row of rows) {
          const employee = await this.employee(tx, row.employeeId!, actor);
          await this.applyJob(tx, row, employee, actor);
        }
        return { processed: rows.length };
      },
    );
  }
  async leaveBalances(
    input: Record<string, unknown>,
    actor: AuthenticatedActor,
  ) {
    validate.object(input, ['employeeId', 'asOf']);
    const employee = await this.employee(
      this.database.client,
      validate.uuid(input.employeeId),
      actor,
    );
    const asOf = input.asOf ? validate.isoDate(input.asOf) : new Date();
    const year = asOf.getUTCFullYear();
    const rows = await this.database.client.hrLeaveEntry.findMany({
      where: {
        employeeId: employee.id,
        year,
        createdAt: { lte: new Date(asOf.getTime() + 86400000) },
      },
    });
    const totals = new Map<
      string,
      { granted: Prisma.Decimal; used: Prisma.Decimal }
    >();
    for (const row of rows) {
      const t = totals.get(row.type) ?? {
        granted: new Prisma.Decimal(0),
        used: new Prisma.Decimal(0),
      };
      if (row.action === 'GRANT') t.granted = t.granted.plus(row.days);
      else t.used = t.used.minus(row.days);
      totals.set(row.type, t);
    }
    return {
      employeeId: employee.id,
      year,
      items: [...totals.entries()].map(([type, value]) => ({
        type,
        granted: value.granted.toFixed(2),
        used: value.used.toFixed(2),
        balance: value.granted.minus(value.used).toFixed(2),
      })),
    };
  }
  async grantLeave(body: unknown, key: unknown, actor: AuthenticatedActor) {
    this.require(actor, 'hr.manage');
    this.require(actor, 'hr.approve');
    const input = validate.object(body, [
      'employeeId',
      'type',
      'days',
      'year',
      'reason',
    ]);
    const type = validate.text(input.type, 'نوع مرخصی', 80),
      reason = validate.text(input.reason, 'دلیل', 1000);
    const days = validate.text(input.days, 'روز', 8);
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(days) || Number(days) <= 0)
      throw new BadRequestException('روز سهمیه معتبر نیست.');
    const year = Number(input.year);
    if (!Number.isInteger(year) || year < 2000 || year > 2200)
      throw new BadRequestException('سال میلادی سهمیه معتبر نیست.');
    return this.command(
      actor,
      key,
      { operation: 'leave.grant', input },
      async (tx) => {
        const employee = await this.employee(
          tx,
          validate.uuid(input.employeeId),
          actor,
        );
        const record = await tx.hrRecord.create({
          data: {
            branchId: employee.branchId,
            employeeId: employee.id,
            section: 'time',
            tab: 'leaveGrants',
            code: `HR-LVG-${randomUUID().slice(0, 12)}`,
            values: [employee.name, type, days, String(year), reason],
            status: 'تأییدشده',
            appliedAt: new Date(),
          },
        });
        await tx.hrLeaveEntry.create({
          data: {
            employeeId: employee.id,
            recordId: record.id,
            type,
            days: new Prisma.Decimal(days),
            year,
            action: 'GRANT',
          },
        });
        await this.audit(
          tx,
          actor,
          {
            branchId: employee.branchId,
            employeeId: employee.id,
            recordId: record.id,
          },
          'leave.grant',
          { days, type, year, reason },
          1,
        );
        return { id: record.id, granted: days };
      },
    );
  }
  private async assertOpenPeriod(tx: Tx, branchId: string, date: string) {
    validate.isoDate(date);
    const closed = await tx.hrRecord.findMany({
      where: {
        branchId,
        section: 'time',
        tab: 'periods',
        status: 'بسته‌شده',
        deletedAt: null,
      },
      take: 1000,
    });
    if (
      closed.some((row) => {
        const values = row.values as string[];
        return values[1]! <= date && values[2]! >= date;
      })
    )
      throw new ConflictException(
        'دوره حضور بسته شده است؛ ابتدا گردش بازگشایی مجاز لازم است.',
      );
  }
  private attendanceView(
    source: RecordRow[],
    employeeId: string,
    date: string,
  ) {
    let shift = source.find((row) => {
      const values = row.values as string[];
      return (
        row.tab === 'shift' &&
        row.employeeId === employeeId &&
        values[7]! <= date &&
        values[8]! >= date &&
        row.status === 'فعال'
      );
    });
    if (shift && (shift.data as HrWorkflowData).templateSchedule) {
      const day = (shift.data as HrWorkflowData).templateSchedule![date];
      if (!day) shift = undefined;
      else {
        const d = day.values;
        const values = [...(shift.values as string[])];
        values[1] = d[0]!;
        values[2] = d[1]!;
        shift = {
          ...shift,
          values,
          data: json({
            ...(shift.data as HrWorkflowData),
            shiftEndDayOffset: ['همان روز', 'یک روز بعد', 'دو روز بعد'].indexOf(
              d[2]!,
            ),
            attendanceBeforeHours: Number(d[3]),
            attendanceAfterHours: Number(d[4]),
          }) as Prisma.JsonValue,
        };
      }
    }
    const shiftValues = shift?.values as string[] | undefined;
    const nextDate = new Date(validate.isoDate(date).getTime() + 86400000)
      .toISOString()
      .slice(0, 10);
    const schedule = (shift?.data ?? {}) as HrWorkflowData;
    const explicitOffset = schedule.shiftEndDayOffset;
    const overnight = Boolean(
      shiftValues &&
      validate.digits(shiftValues[2]!) <= validate.digits(shiftValues[1]!),
    );
    const shiftStart = shiftValues
      ? validate.localClockToUtc(date, shiftValues[1]!)
      : null;
    const shiftEnd = shiftValues
      ? validate.localClockToUtc(
          explicitOffset !== undefined
            ? new Date(
                validate.isoDate(date).getTime() + explicitOffset * 86400000,
              )
                .toISOString()
                .slice(0, 10)
            : overnight
              ? nextDate
              : date,
          shiftValues[2]!,
        )
      : null;
    const lower =
      shiftStart && explicitOffset !== undefined
        ? shiftStart.getTime() - (schedule.attendanceBeforeHours ?? 0) * 3600000
        : overnight
          ? shiftStart!.getTime() - 6 * 3600000
          : validate.localClockToUtc(date, '00:00').getTime();
    const upper =
      shiftEnd && explicitOffset !== undefined
        ? shiftEnd.getTime() + (schedule.attendanceAfterHours ?? 0) * 3600000
        : overnight
          ? shiftEnd!.getTime() + 6 * 3600000
          : validate.localClockToUtc(nextDate, '00:00').getTime();
    const punches = source.filter((row) => {
      if (row.tab !== 'checkins' || row.employeeId !== employeeId) return false;
      const v = row.values as string[];
      const at = new Date(
        (row.data as HrWorkflowData).startsAt ??
          validate.localClockToUtc(v[1]!, v[2]!),
      );
      return (
        at.getTime() >= lower &&
        (explicitOffset !== undefined
          ? at.getTime() <= upper
          : at.getTime() < upper)
      );
    });
    const corrected = punches
      .filter((row) => row.parentId !== null)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const selected = corrected.length
      ? corrected.filter((row) => row.parentId === corrected[0]!.parentId)
      : punches;
    const events = selected.map((row) => {
      const v = row.values as string[],
        data = row.data as HrWorkflowData;
      return {
        kind: v[3]!,
        at: new Date(data.startsAt ?? validate.localClockToUtc(v[1]!, v[2]!)),
      };
    });
    const result = validate.attendanceMinutes(events);
    return {
      shift,
      shiftValues,
      shiftStart,
      shiftEnd,
      events,
      result,
      selected,
    };
  }
  async processAttendance(
    body: unknown,
    key: unknown,
    actor: AuthenticatedActor,
  ) {
    this.require(actor, 'hr.manage');
    const input = validate.object(body, ['branchId', 'date']);
    const date = validate.isoDate(input.date).toISOString().slice(0, 10),
      branchId = this.branch(actor, input.branchId);
    return this.command(
      actor,
      key,
      { operation: 'attendance.process', input },
      async (tx) => {
        await this.assertOpenPeriod(tx, branchId, date);
        const employees = await tx.hrEmployee.findMany({
          where: {
            branchId,
            deletedAt: null,
            startedAt: { lte: validate.isoDate(date) },
            status: 'فعال',
          },
          take: 2000,
        });
        const source = await tx.hrRecord.findMany({
          where: {
            branchId,
            OR: [
              {
                section: 'time',
                tab: {
                  in: [
                    'checkins',
                    'shift',
                    'calculationSettings',
                    'remote',
                    'holidays',
                    'mission',
                    'leave',
                  ],
                },
              },
              {
                section: 'requests',
                tab: { in: ['radanLeave', 'radanMission', 'leave'] },
              },
            ],
            deletedAt: null,
          },
          take: 10001,
        });
        if (source.length > 10000)
          throw new ConflictException('حجم داده کارکرد بیش از حد مجاز است.');
        const settings = source.find(
          (r) => r.tab === 'calculationSettings' && r.status === 'فعال',
        );
        let exceptions = 0;
        for (const employee of employees) {
          const {
            shift,
            shiftValues,
            shiftStart,
            shiftEnd,
            events,
            result,
            selected,
          } = this.attendanceView(source, employee.id, date);
          let late = '—',
            early = '—',
            overtime: number | null = null;
          if (shiftStart && shiftEnd && shiftValues) {
            const ins = events
              .filter((event) => event.kind === 'ورود')
              .sort((a, b) => a.at.getTime() - b.at.getTime());
            const outs = events
              .filter((event) => event.kind === 'خروج')
              .sort((a, b) => a.at.getTime() - b.at.getTime());
            const grace =
              Number(validate.digits(shiftValues[3]!).replace(/[^\d.]/g, '')) ||
              0;
            if (ins.length)
              late = String(
                Math.max(
                  0,
                  Math.floor(
                    (ins[0]!.at.getTime() - shiftStart.getTime()) / 60000,
                  ) - grace,
                ),
              );
            if (outs.length)
              early = String(
                Math.max(
                  0,
                  Math.floor(
                    (shiftEnd.getTime() - outs.at(-1)!.at.getTime()) / 60000,
                  ),
                ),
              );
            overtime = Math.max(
              0,
              result.worked -
                Math.floor((shiftEnd.getTime() - shiftStart.getTime()) / 60000),
            );
          } else result.exceptions.push('شیفت مصوب تعیین نشده');
          let calculationMetrics: Record<string, number> | undefined;
          if (settings && shiftStart && shiftEnd && overtime !== null) {
            const projected = configuredAttendance({
              settings: settings.values as string[],
              start: shiftStart,
              end: shiftEnd,
              worked: result.worked,
              overtime,
              events,
              requests: source
                .filter(
                  (r) =>
                    r.employeeId === employee.id &&
                    validate.APPROVED.has(r.status),
                )
                .map((r) => ({
                  tab: r.tab,
                  values: r.values as string[],
                  data: r.data as HrWorkflowData,
                })),
              holiday: source.some(
                (r) =>
                  r.tab === 'holidays' &&
                  (r.values as string[])[1] === date &&
                  r.status === 'فعال',
              ),
            });
            result.worked = projected.worked;
            overtime = projected.overtime;
            calculationMetrics = projected.metrics;
          }
          if (result.exceptions.length) exceptions++;
          const rows = await tx.hrRecord.findMany({
            where: {
              branchId,
              employeeId: employee.id,
              section: 'time',
              tab: 'attendance',
              deletedAt: null,
            },
            take: 1000,
          });
          const existing = rows.find(
            (row) => (row.values as string[])[1] === date,
          );
          const values = [
            employee.name,
            date,
            shift ? (shift.values as string[])[0]! : '—',
            `${Math.floor(result.worked / 60)}:${String(result.worked % 60).padStart(2, '0')}`,
            late,
            early,
          ];
          const status = result.exceptions.length
            ? 'نیازمند بررسی'
            : result.worked
              ? 'حاضر'
              : 'غایب';
          const row = existing
            ? await tx.hrRecord.update({
                where: { id: existing.id },
                data: {
                  values,
                  effectiveAt: validate.isoDate(date),
                  searchText: values.join(' '),
                  status,
                  data: {
                    ...(settings
                      ? {
                          calculationSettingsId: settings.id,
                          calculationBasis: (settings.values as string[])[9],
                          calculationMetrics,
                        }
                      : {}),
                    reason: result.exceptions.join('، '),
                    minutes: result.worked,
                    workedMinutes: result.worked,
                    lateMinutes: late === '—' ? null : Number(late),
                    earlyMinutes: early === '—' ? null : Number(early),
                    overtimeMinutes: overtime,
                    exceptionCodes: result.exceptions,
                  },
                  version: { increment: 1 },
                },
              })
            : await tx.hrRecord.create({
                data: {
                  branchId,
                  employeeId: employee.id,
                  section: 'time',
                  tab: 'attendance',
                  code: `HR-ATT-${randomUUID().slice(0, 12)}`,
                  values,
                  status,
                  data: {
                    ...(settings
                      ? {
                          calculationSettingsId: settings.id,
                          calculationBasis: (settings.values as string[])[9],
                          calculationMetrics,
                        }
                      : {}),
                    reason: result.exceptions.join('، '),
                    minutes: result.worked,
                    workedMinutes: result.worked,
                    lateMinutes: late === '—' ? null : Number(late),
                    earlyMinutes: early === '—' ? null : Number(early),
                    overtimeMinutes: overtime,
                    exceptionCodes: result.exceptions,
                  },
                },
              });
          await this.audit(
            tx,
            actor,
            { branchId, employeeId: employee.id, recordId: row.id },
            'attendance.process',
            {
              sourceIds: selected.map((r) => r.id),
              exceptions: result.exceptions,
            },
            row.version,
          );
        }
        return { processed: employees.length, exceptions, date };
      },
    );
  }
  async closeAttendance(
    body: unknown,
    key: unknown,
    actor: AuthenticatedActor,
  ) {
    this.require(actor, 'hr.manage');
    this.require(actor, 'hr.approve');
    const input = validate.object(body, ['branchId', 'from', 'to']);
    const from = validate.isoDate(input.from),
      to = validate.isoDate(input.to),
      branchId = this.branch(actor, input.branchId);
    if (to < from || (to.getTime() - from.getTime()) / 86400000 > 31)
      throw new BadRequestException('بازه بستن دوره باید حداکثر ۳۲ روز باشد.');
    return this.command(
      actor,
      key,
      { operation: 'attendance.close', input },
      async (tx) => {
        const rows = await tx.hrRecord.findMany({
          where: {
            branchId,
            section: 'time',
            tab: 'attendance',
            deletedAt: null,
          },
          take: 10000,
        });
        const selected = rows.filter((row) => {
          const d = (row.values as string[])[1]!;
          return d >= String(input.from) && d <= String(input.to);
        });
        if (
          !selected.length ||
          selected.some((row) => row.status === 'نیازمند بررسی')
        )
          throw new ConflictException(
            'دوره بدون کارکرد پردازش‌شده یا دارای استثنا بسته نمی‌شود.',
          );
        const employees = await tx.hrEmployee.findMany({
          where: {
            branchId,
            deletedAt: null,
            status: 'فعال',
            startedAt: { lte: to },
          },
          take: 2000,
        });
        for (
          let time = from.getTime();
          time <= to.getTime();
          time += 86400000
        ) {
          const date = new Date(time).toISOString().slice(0, 10);
          for (const employee of employees)
            if (
              employee.startedAt.getTime() <= time &&
              !selected.some(
                (row) =>
                  row.employeeId === employee.id &&
                  (row.values as string[])[1] === date,
              )
            )
              throw new ConflictException(
                'برای تمام کارکنان و تمام روزهای دوره کارکرد پردازش‌شده لازم است.',
              );
        }
        for (let date = from.getTime(); date <= to.getTime(); date += 86400000)
          await this.assertOpenPeriod(
            tx,
            branchId,
            new Date(date).toISOString().slice(0, 10),
          );
        const pending = await tx.hrRecord.count({
          where: {
            branchId,
            section: { in: ['time', 'requests'] },
            tab: {
              in: [
                'corrections',
                'attendance',
                'leave',
                'overtime',
                'shiftRequests',
                'radanLeave',
                'radanMission',
                'remote',
              ],
            },
            status: {
              in: ['در انتظار تأیید', 'در انتظار بررسی', 'در انتظار مدیر'],
            },
            deletedAt: null,
          },
        });
        if (pending)
          throw new ConflictException(
            'درخواست‌های در انتظار باید پیش از بستن دوره تعیین تکلیف شوند.',
          );
        const record = await tx.hrRecord.create({
          data: {
            branchId,
            section: 'time',
            tab: 'periods',
            code: `HR-PER-${randomUUID().slice(0, 12)}`,
            values: [
              `${String(input.from)} – ${String(input.to)}`,
              String(input.from),
              String(input.to),
              String(selected.length),
              '0',
            ],
            status: 'بسته‌شده',
            appliedAt: new Date(),
          },
        });
        await this.audit(
          tx,
          actor,
          { branchId, recordId: record.id },
          'attendance.close',
          {
            from: input.from,
            to: input.to,
            recordIds: selected.map((r) => r.id),
          },
          1,
        );
        return { id: record.id, closed: true, records: selected.length };
      },
    );
  }
  private notificationScope(
    actor: AuthenticatedActor,
  ): Prisma.HrNotificationWhereInput {
    this.readable(actor);
    return {
      branchId: { in: actor.branchIds },
      ...(this.has(actor, 'hr.read') || this.has(actor, 'hr.manage')
        ? {}
        : {
            OR: [
              { targetUserId: actor.userId },
              { employee: this.employeeScope(actor) },
            ],
          }),
      ...(this.has(actor, 'hr.sensitive') ? {} : { sensitive: false }),
    };
  }
  async notifications(actor: AuthenticatedActor) {
    const rows = await this.database.client.hrNotification.findMany({
      where: this.notificationScope(actor),
      include: { reads: { where: { userId: actor.userId } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      recordId: row.recordId,
      employeeId: row.employeeId,
      title: row.title,
      createdAt: row.createdAt.toISOString(),
      readAt: row.reads[0]?.readAt.toISOString() ?? null,
    }));
  }
  async readNotification(id: string, actor: AuthenticatedActor) {
    const row = await this.database.client.hrNotification.findFirst({
      where: {
        AND: [this.notificationScope(actor), { id: validate.uuid(id) }],
      },
    });
    if (!row) throw new NotFoundException('اعلان پیدا نشد.');
    const result = await this.database.client.hrNotificationRead.upsert({
      where: {
        notificationId_userId: { notificationId: id, userId: actor.userId },
      },
      create: { notificationId: id, userId: actor.userId },
      update: {},
    });
    return { id, readAt: result.readAt.toISOString() };
  }
  async auditEvents(input: Record<string, unknown>, actor: AuthenticatedActor) {
    this.require(actor, 'hr.audit');
    this.readable(actor);
    validate.object(input, ['employeeId', 'recordId']);
    const employeeId = input.employeeId
        ? validate.uuid(input.employeeId)
        : undefined,
      recordId = input.recordId ? validate.uuid(input.recordId) : undefined;
    if (employeeId)
      await this.employee(this.database.client, employeeId, actor);
    if (recordId) await this.record(this.database.client, recordId, actor);
    const rows = await this.database.client.hrAuditEvent.findMany({
      where: {
        branchId: { in: actor.branchIds },
        ...(employeeId ? { employeeId } : {}),
        ...(recordId ? { recordId } : {}),
        ...(this.has(actor, 'hr.read') || this.has(actor, 'hr.manage')
          ? {}
          : { employee: this.employeeScope(actor) }),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map((row) => ({
      ...row,
      changes: this.has(actor, 'hr.sensitive') ? row.changes : { masked: true },
      createdAt: row.createdAt.toISOString(),
    }));
  }
  async getRecord(id: string, actor: AuthenticatedActor) {
    const row = await this.record(this.database.client, id, actor);
    await this.database.client.hrAuditEvent.create({
      data: {
        branchId: row.branchId,
        actorId: actor.userId,
        recordId: row.id,
        employeeId: row.employeeId,
        action: 'record.read',
        changes: {
          source: 'detail',
          sensitive: this.has(actor, 'hr.sensitive'),
        },
      },
    });
    return this.recordDto(row, actor);
  }
  private async validateRadanRelations(
    tx: Tx,
    schema: HrResourceDefinition,
    branchId: string,
    employee: Employee | null,
    parentId: string | null,
    values: string[],
    actor: AuthenticatedActor,
    id?: string,
  ) {
    if (
      ['employee.identity', 'time.calculationSettings'].includes(schema.key)
    ) {
      const count = await tx.hrRecord.count({
        where: {
          branchId,
          section: schema.section,
          tab: schema.tab,
          employeeId: employee?.id ?? null,
          parentId,
          deletedAt: null,
          ...(id ? { id: { not: id } } : {}),
        },
      });
      if (count)
        throw new ConflictException(
          'برای این مرجع رکورد وجود دارد؛ همان رکورد را ویرایش کنید.',
        );
    }
    if (
      schema.key === 'requests.approvalStages' &&
      (!employee?.userId || employee.status !== 'فعال')
    )
      throw new BadRequestException(
        'تأییدکننده باید کارمند فعال دارای حساب کاربری باشد.',
      );
    if (schema.key === 'time.templateDays') {
      validate.isoDate(values[0]);
      const duplicate = await tx.hrRecord.findMany({
        where: {
          parentId,
          section: 'time',
          tab: 'templateDays',
          deletedAt: null,
          ...(id ? { id: { not: id } } : {}),
        },
        take: 1101,
      });
      if (
        duplicate.length > 1100 ||
        duplicate.some((r) => (r.values as string[])[0] === values[0])
      )
        throw new ConflictException(
          'برای این روز در تقویم شیفت رکورد وجود دارد.',
        );
      const mock = getHrResource('time', 'workingHours')!;
      validate.recordValues(['روز تقویم', '', ...values.slice(1)], mock);
    }
    if (schema.key === 'employee.identity' && employee) {
      const name = validate.text(
        `${validate.text(values[0], 'نام', 80)} ${validate.text(values[1], 'نام خانوادگی', 100)}`,
        'نام',
        160,
      );
      if (name !== employee.name) {
        const changed = await tx.hrEmployee.updateMany({
          where: {
            id: employee.id,
            branchId,
            version: employee.version,
            deletedAt: null,
          },
          data: { name, version: { increment: 1 } },
        });
        if (changed.count !== 1)
          throw new ConflictException('نسخه کارمند تغییر کرده است.');
        employee.name = name;
        employee.version += 1;
        await this.audit(
          tx,
          actor,
          { branchId, employeeId: employee.id },
          'employee.identity.name',
          { fields: ['نام', 'نام خانوادگی'] },
          employee.version,
        );
      }
    }
  }
  private async attachRadanRoute(
    tx: Tx,
    schema: HrResourceDefinition,
    branchId: string,
    employee: Employee,
    values: string[],
    data: HrWorkflowData,
  ) {
    const subtype =
      schema.key === 'time.remote'
        ? `دورکاری ${values[3]}`
        : schema.key === 'time.overtime'
          ? 'اضافه‌کار ساعتی'
          : ['time.corrections', 'requests.attendance'].includes(schema.key)
            ? 'اصلاح تردد'
            : (data.requestSubtype ?? '');
    if (!subtype) return;
    const members = await tx.hrRecord.findMany({
      where: {
        branchId,
        section: 'requests',
        tab: 'procedureMembers',
        employeeId: employee.id,
        status: 'فعال',
        deletedAt: null,
      },
    });
    const procedures = await tx.hrRecord.findMany({
      where: {
        id: { in: members.map((m) => m.parentId!).filter(Boolean) },
        branchId,
        section: 'requests',
        tab: 'procedures',
        status: 'فعال',
        deletedAt: null,
      },
    });
    const eligible = procedures.filter((r) =>
      selection((r.values as string[])[2]!, HR_RADAN_REQUEST_TYPES).includes(
        subtype,
      ),
    );
    if (eligible.length > 1)
      throw new ConflictException('چند روند فعال برای این درخواست وجود دارد.');
    if (!eligible.length) return;
    const stages = await tx.hrRecord.findMany({
      where: {
        parentId: eligible[0]!.id,
        section: 'requests',
        tab: 'approvalStages',
        status: 'فعال',
        deletedAt: null,
      },
    });
    if (!stages.length || stages.length > 20)
      throw new ConflictException(
        'روند باید یک تا بیست مرحله تأیید داشته باشد.',
      );
    const route = stages
      .map((r) => ({
        employeeId: r.employeeId!,
        senior: (r.values as string[])[2] === 'بله',
        priority: Number((r.values as string[])[1]),
      }))
      .sort((a, b) => a.priority - b.priority);
    if (
      new Set(route.map((r) => r.priority)).size !== route.length ||
      route.some((r) => r.employeeId === employee.id)
    )
      throw new ConflictException(
        'اولویت تکراری یا تأیید درخواست خود مجاز نیست.',
      );
    data.approvalRoute = route;
    data.approvalStep = 0;
    data.requestSubtype = subtype;
  }
  private async minuteEntry(
    tx: Tx,
    employee: Employee,
    year: number,
    month: number,
    type: string,
    minutes: number,
    action: string,
    parentId: string | null,
    actor: AuthenticatedActor,
  ) {
    const row = await tx.hrRecord.create({
      data: {
        branchId: employee.branchId,
        employeeId: employee.id,
        parentId,
        section: 'time',
        tab: 'minuteLedger',
        code: `HR-MIN-${randomUUID().slice(0, 16)}`,
        values: [
          employee.name,
          String(year),
          String(month),
          type,
          action,
          String(minutes),
          parentId ?? '',
        ],
        data: {},
        status: 'تأییدشده',
        appliedAt: new Date(),
      },
    });
    await this.audit(
      tx,
      actor,
      {
        branchId: employee.branchId,
        employeeId: employee.id,
        recordId: row.id,
      },
      'leave.minutes',
      { year, month, type, minutes, action },
      1,
    );
    return row;
  }
  private async minuteBalance(
    tx: Tx,
    employeeId: string,
    year: number,
    type: string,
  ) {
    const rows = await tx.hrRecord.findMany({
      where: {
        employeeId,
        section: 'time',
        tab: 'minuteLedger',
        status: 'تأییدشده',
        deletedAt: null,
      },
      take: 10001,
    });
    if (rows.length > 10000)
      throw new ConflictException('حجم کاردکس بیش از حد مجاز است.');
    return rows.reduce((total, r) => {
      const v = r.values as string[];
      return Number(v[1]) === year && v[3] === type
        ? total + Number(v[5])
        : total;
    }, 0);
  }
  async minuteLeave(body: unknown, key: unknown, actor: AuthenticatedActor) {
    this.require(actor, 'hr.manage');
    this.require(actor, 'hr.approve');
    const input = validate.object(body, [
      'employeeIds',
      'year',
      'months',
      'duration',
      'type',
      'ruleId',
      'transfer',
    ]);
    if (
      !Array.isArray(input.employeeIds) ||
      !input.employeeIds.length ||
      input.employeeIds.length > 100 ||
      new Set(input.employeeIds).size !== input.employeeIds.length
    )
      throw new BadRequestException('یک تا صد کارمند یکتا انتخاب کنید.');
    const employeeIds = input.employeeIds.map((id: unknown) =>
      validate.uuid(id).toLowerCase(),
    );
    if (new Set(employeeIds).size !== employeeIds.length)
      throw new BadRequestException('یک تا صد کارمند یکتا انتخاب کنید.');
    const year = jalaliYear(input.year),
      type = validate.text(input.type, 'نوع مرخصی', 80);
    if (input.ruleId && input.transfer)
      throw new BadRequestException('یک روش انتقال انتخاب کنید.');
    let inlineRule: string[] | undefined;
    if (input.transfer !== undefined) {
      const transfer = validate.object(input.transfer, [
        'greaterThan',
        'lessThan',
        'greaterCarry',
        'greaterBurn',
        'greaterBuyback',
        'lessCarry',
        'lessBurn',
        'lessBuyback',
      ]);
      inlineRule = [
        'انتقال عمومی مرخصی',
        String(year),
        ...[
          'greaterThan',
          'greaterCarry',
          'greaterBurn',
          'greaterBuyback',
          'lessCarry',
          'lessBurn',
          'lessBuyback',
          'lessThan',
        ].map((field) => validate.text(transfer[field], field, 12)),
      ];
      validateCompletionValues(
        'time.leaveTransferRules',
        getHrResource('time', 'leaveTransferRules')!.columns,
        inlineRule,
      );
    }
    if ((inlineRule || input.ruleId) && year === 1600)
      throw new BadRequestException('سال مقصد خارج از محدوده مجاز است.');
    return this.command(
      actor,
      key,
      { operation: 'leave.minutes', input },
      async (tx) => {
        const ids: string[] = [];
        const inlineRules = new Map<string, RecordRow>();
        for (const id of [...employeeIds].sort()) {
          const employee = await this.employee(tx, validate.uuid(id), actor);
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${employee.id + ':minute-leave'}, 0))::text`;
          if (input.ruleId || inlineRule) {
            let rule = inlineRules.get(employee.branchId);
            if (!rule && inlineRule) {
              rule = await tx.hrRecord.create({
                data: {
                  branchId: employee.branchId,
                  section: 'time',
                  tab: 'leaveTransferRules',
                  code: `HR-TRANSFER-${randomUUID()}`,
                  values: inlineRule,
                  data: {},
                  status: 'فعال',
                },
              });
              inlineRules.set(employee.branchId, rule);
              await this.audit(
                tx,
                actor,
                { branchId: employee.branchId, recordId: rule.id },
                'leave.transfer.configure',
                { year },
                1,
              );
            }
            rule ??= await this.record(tx, validate.uuid(input.ruleId), actor);
            if (
              rule.branchId !== employee.branchId ||
              rule.section !== 'time' ||
              rule.tab !== 'leaveTransferRules' ||
              rule.status !== 'فعال' ||
              Number((rule.values as string[])[1]) !== year
            )
              throw new BadRequestException(
                'قاعده انتقال فعال و هم‌شعبه برای سال انتخابی لازم است.',
              );
            const applied = await tx.hrRecord.findMany({
              where: {
                employeeId: employee.id,
                section: 'time',
                tab: 'minuteLedger',
                parentId: rule.id,
                deletedAt: null,
              },
            });
            if (applied.length)
              throw new ConflictException(
                'این قاعده برای کارمند قبلاً اجرا شده است.',
              );
            const balance = await this.minuteBalance(
              tx,
              employee.id,
              year,
              type,
            );
            if (inlineRule && balance === 0)
              throw new ConflictException('مانده صفر قابل انتقال نیست.');
            if (balance < 0)
              throw new ConflictException('مانده منفی قابل انتقال نیست.');
            const split = transferSplit(balance, rule.values as string[]);
            for (const [action, amount] of [
              ['انتقال خروجی', split.carry],
              ['سوخت', split.burn],
              ['بازخرید', split.buyback],
            ] as const)
              if (amount)
                ids.push(
                  (
                    await this.minuteEntry(
                      tx,
                      employee,
                      year,
                      12,
                      type,
                      -amount,
                      action,
                      rule.id,
                      actor,
                    )
                  ).id,
                );
            if (split.carry)
              ids.push(
                (
                  await this.minuteEntry(
                    tx,
                    employee,
                    year + 1,
                    1,
                    type,
                    split.carry,
                    'انتقال ورودی',
                    rule.id,
                    actor,
                  )
                ).id,
              );
          } else {
            const amount = durationMinutes(input.duration);
            if (!amount)
              throw new BadRequestException('سهمیه باید بیشتر از صفر باشد.');
            if (
              !Array.isArray(input.months) ||
              !input.months.length ||
              input.months.length > 12 ||
              input.months.some(
                (m) => !Number.isInteger(m) || m < 1 || m > 12,
              ) ||
              new Set(input.months).size !== input.months.length
            )
              throw new BadRequestException(
                'ماه‌های معتبر و یکتا انتخاب کنید.',
              );
            for (const month of input.months as number[])
              ids.push(
                (
                  await this.minuteEntry(
                    tx,
                    employee,
                    year,
                    month,
                    type,
                    amount,
                    'تخصیص',
                    null,
                    actor,
                  )
                ).id,
              );
          }
        }
        return { ids };
      },
    );
  }
  async attendanceReportData(
    query: Record<string, unknown>,
    actor: AuthenticatedActor,
  ) {
    validate.object(query, ['from', 'to']);
    this.readable(actor);
    const from = query.from
      ? validate.isoDate(query.from).toISOString().slice(0, 10)
      : '';
    const to = query.to
      ? validate.isoDate(query.to).toISOString().slice(0, 10)
      : '';
    if (from && to && from > to)
      throw new BadRequestException('پایان باید پس از شروع باشد.');
    return this.database.client.$transaction(
      async (tx) => {
        const employees = await tx.hrEmployee.findMany({
          where: this.employeeScope(actor),
          take: 10001,
          orderBy: [{ personnelCode: 'asc' }, { id: 'asc' }],
        });
        if (employees.length > 10000)
          throw new ConflictException('فهرست پرسنل بیش از حد مجاز است.');
        const scope: Prisma.HrRecordWhereInput = {
          AND: [
            this.recordScope(actor),
            {
              OR: [
                { employeeId: null },
                { employee: this.employeeScope(actor) },
              ],
            },
          ],
        };
        const eventSources = [
          ['time', 'attendance'],
          ['time', 'checkins'],
          ['time', 'leave'],
          ['time', 'remote'],
          ['time', 'overtime'],
          ['time', 'mission'],
          ['requests', 'leave'],
          ['requests', 'radanLeave'],
          ['requests', 'radanMission'],
          ['expenses', 'mission'],
        ];
        const eventFilters: Prisma.HrRecordWhereInput[] = eventSources.map(
          ([section, tab]) => {
            const columns = getHrResource(section!, tab!)!.columns;
            const startIndex = columns.findIndex((label) =>
              [
                'از تاریخ',
                'تاریخ رفت',
                'تاریخ کارکرد',
                'تاریخ تردد',
                'تاریخ',
              ].includes(label),
            );
            const endLabel = ['تا تاریخ', 'تاریخ برگشت'].find((label) =>
              columns.includes(label),
            );
            const endIndex = endLabel ? columns.indexOf(endLabel) : startIndex;
            const dates: Prisma.HrRecordWhereInput[] = [];
            if (from)
              dates.push(
                endIndex >= 0
                  ? { values: { path: [String(endIndex)], gte: from } }
                  : { effectiveAt: { gte: new Date(from) } },
              );
            if (to)
              dates.push(
                startIndex >= 0
                  ? { values: { path: [String(startIndex)], lte: to } }
                  : { effectiveAt: { lte: new Date(to) } },
              );
            return { section: section!, tab: tab!, AND: dates };
          },
        );
        const [operational, references] = await Promise.all([
          tx.hrRecord.findMany({
            where: { AND: [scope, { OR: eventFilters }] },
            take: 100001,
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          }),
          tx.hrRecord.findMany({
            where: {
              AND: [scope],
              OR: [
                {
                  section: 'time',
                  tab: {
                    in: [
                      'shift',
                      'calculationSettings',
                      'leavePolicies',
                      'biometric',
                    ],
                  },
                },
                {
                  section: 'requests',
                  tab: { in: ['patterns', 'patternAssignments'] },
                },
                { section: 'contracts', tab: 'active' },
                {
                  section: 'organization',
                  tab: { in: ['groups', 'groupMembers'] },
                },
              ],
            },
            take: 50001,
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          }),
        ]);
        if (operational.length > 100000 || references.length > 50000)
          throw new ConflictException('حجم گزارش بیش از حد مجاز است.');
        return {
          employees: employees.map((employee) => this.employeeDto(employee)),
          records: await this.recordDtos(operational, actor),
          references: await this.recordDtos(references, actor),
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        maxWait: 10000,
        timeout: 30000,
      },
    );
  }
  async leavePersonnel(actor: AuthenticatedActor) {
    const items = await this.database.client.hrEmployee.findMany({
      where: this.employeeScope(actor),
      take: 10001,
      orderBy: [{ personnelCode: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        name: true,
        personnelCode: true,
        unit: true,
        branchId: true,
      },
    });
    if (items.length > 10000)
      throw new ConflictException('فهرست پرسنل بیش از حد مجاز است.');
    return { items };
  }
  async leaveReport(query: Record<string, unknown>, actor: AuthenticatedActor) {
    validate.object(query, ['employeeIds', 'year']);
    this.readable(actor);
    const year = jalaliYear(query.year);
    const ids = validate
      .text(query.employeeIds, 'پرسنل', 3700)
      .split(',')
      .map((id) => validate.uuid(id).toLowerCase());
    if (!ids.length || ids.length > 100 || new Set(ids).size !== ids.length)
      throw new BadRequestException('یک تا صد کارمند یکتا انتخاب کنید.');
    return this.database.client.$transaction(
      async (tx) => {
        const employees = await tx.hrEmployee.findMany({
          where: { AND: [this.employeeScope(actor), { id: { in: ids } }] },
          select: { id: true, name: true, personnelCode: true },
        });
        if (employees.length !== ids.length)
          throw new NotFoundException('پرسنل انتخاب‌شده در دسترس نیست.');
        const records = await tx.hrRecord.findMany({
          where: {
            AND: [
              this.recordScope(actor),
              { employee: this.employeeScope(actor) },
            ],
            employeeId: { in: ids },
            section: 'time',
            tab: 'minuteLedger',
            status: 'تأییدشده',
            deletedAt: null,
          },
          take: 100001,
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        });
        if (records.length > 100000)
          throw new ConflictException('حجم گزارش بیش از حد مجاز است.');
        const selected = records.filter(
          (row) => Number((row.values as string[])[1]) === year,
        );
        return {
          year,
          items: employees.map((employee) => ({
            ...employee,
            balanceMinutes: selected
              .filter((row) => row.employeeId === employee.id)
              .reduce(
                (sum, row) => sum + Number((row.values as string[])[5]),
                0,
              ),
          })),
          records: await this.recordDtos(selected, actor),
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        maxWait: 10000,
        timeout: 30000,
      },
    );
  }
  async minuteCardex(
    query: Record<string, unknown>,
    actor: AuthenticatedActor,
  ) {
    validate.object(query, ['employeeId', 'year']);
    const employee = await this.employee(
      this.database.client,
      validate.uuid(query.employeeId),
      actor,
    );
    const year = jalaliYear(query.year);
    const rows = await this.database.client.hrRecord.findMany({
      where: {
        employeeId: employee.id,
        branchId: employee.branchId,
        section: 'time',
        tab: 'minuteLedger',
        deletedAt: null,
        status: 'تأییدشده',
        AND: [this.recordScope(actor)],
      },
      take: 10001,
      orderBy: { createdAt: 'asc' },
    });
    if (rows.length > 10000)
      throw new ConflictException('حجم کاردکس بیش از حد مجاز است.');
    const selected = rows.filter(
      (r) => Number((r.values as string[])[1]) === year,
    );
    return {
      year,
      employeeId: employee.id,
      items: await this.recordDtos(selected, actor),
      balanceMinutes: selected.reduce(
        (sum, r) => sum + Number((r.values as string[])[5]),
        0,
      ),
    };
  }
  async backup(actor: AuthenticatedActor) {
    this.require(actor, 'hr.manage');
    this.require(actor, 'hr.sensitive');
    this.require(actor, 'hr.audit');
    return this.transaction(async (tx) => {
      const [employees, records, ledger] = await Promise.all([
        tx.hrEmployee.findMany({
          where: this.employeeScope(actor),
          take: 10001,
        }),
        tx.hrRecord.findMany({ where: this.recordScope(actor), take: 50001 }),
        tx.hrLeaveEntry.findMany({
          where: { employee: this.employeeScope(actor) },
          take: 50001,
        }),
      ]);
      if (
        employees.length > 10000 ||
        records.length > 50000 ||
        ledger.length > 50000
      )
        throw new ConflictException('حجم پشتیبان نیازمند عملیات زیرساخت است.');
      const snapshot = {
        format: 'nora-hr-backup-v1',
        createdAt: new Date().toISOString(),
        branchIds: actor.branchIds,
        employees,
        records,
        ledger,
      };
      await this.audit(
        tx,
        actor,
        { branchId: this.branch(actor) },
        'backup.export',
        { employees: employees.length, records: records.length },
        1,
      );
      return snapshot;
    });
  }

  async importPayslips(
    file: { buffer: Buffer; originalname: string } | undefined,
    body: unknown,
    key: unknown,
    actor: AuthenticatedActor,
  ) {
    this.require(actor, 'hr.manage');
    this.require(actor, 'hr.sensitive');
    if (!file) throw new BadRequestException('فایل اکسل را انتخاب کنید.');
    const input = validate.object(body, ['branchId', 'year', 'month']);
    const branchId = this.branch(actor, input.branchId),
      year = jalaliYear(input.year),
      month = Number(input.month);
    if (!Number.isInteger(month) || month < 1 || month > 12)
      throw new BadRequestException('ماه معتبر نیست.');
    const [headerRow, ...rows] = readPayslipWorkbook(
      file.buffer,
      file.originalname,
    );
    const headers = headerRow
      ? Array.from(headerRow, (header) => String(header ?? '').trim())
      : undefined;
    if (headers?.[0]?.toLowerCase() === 'personnel code')
      headers[0] = 'کد پرسنلی';
    if (
      !headers ||
      headers[0] !== 'کد پرسنلی' ||
      headers.length < 2 ||
      new Set(headers).size !== headers.length ||
      headers.some((h) => !h?.trim() || h.length > 160)
    )
      throw new BadRequestException(
        'ستون اول باید کد پرسنلی باشد و عنوان ستون‌ها یکتا باشد.',
      );
    const actual = rows.filter((row) => row.some((value) => value?.trim()));
    if (
      !actual.length ||
      actual.length > 1000 ||
      new Set(actual.map((row) => row[0])).size !== actual.length
    )
      throw new BadRequestException('ردیف خالی، تکراری یا بیش از حد مجاز است.');
    const hash = createHash('sha256').update(file.buffer).digest('hex');
    return this.command(
      actor,
      key,
      { operation: 'payslips.import', input, hash },
      async (tx) => {
        const employees = await tx.hrEmployee.findMany({
          where: {
            branchId,
            deletedAt: null,
            personnelCode: { in: actual.map((row) => row[0]!) },
          },
        });
        const ids: string[] = [];
        for (const row of actual) {
          const employee = employees.find((e) => e.personnelCode === row[0]);
          if (
            !employee ||
            row.length > headers.length ||
            row.some(
              (cell) => cell && (cell.length > 500 || /^[=+@]/.test(cell)),
            )
          )
            throw new BadRequestException(
              'کد پرسنلی یا مقدار ردیف معتبر نیست.',
            );
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${employee.id + ':payslip:' + year + ':' + month}, 0))::text`;
          const previous = await tx.hrRecord.findMany({
            where: {
              employeeId: employee.id,
              section: 'payroll',
              tab: 'importedPayslips',
              deletedAt: null,
            },
          });
          if (
            previous.some((r) => {
              const v = r.values as string[];
              return Number(v[1]) === year && Number(v[2]) === month;
            })
          )
            throw new ConflictException(
              'فیش این دوره قبلاً وارد شده است؛ بازنویسی مجاز نیست.',
            );
          for (let i = 1; i < headers.length; i++) {
            const record = await tx.hrRecord.create({
              data: {
                branchId,
                employeeId: employee.id,
                section: 'payroll',
                tab: 'importedPayslips',
                code: `HR-SLIP-${randomUUID().slice(0, 16)}`,
                values: [
                  employee.name,
                  String(year),
                  String(month),
                  headers[i]!,
                  row[i] ?? '',
                ],
                status: 'ثبت‌شده',
                appliedAt: new Date(),
              },
            });
            ids.push(record.id);
          }
        }
        await this.audit(
          tx,
          actor,
          { branchId },
          'payslips.import',
          { year, month, count: actual.length, hash },
          1,
        );
        return { ids, employees: actual.length };
      },
    );
  }

  async saveTemplateCalendar(
    id: string,
    body: unknown,
    key: unknown,
    actor: AuthenticatedActor,
  ) {
    this.require(actor, 'hr.manage');
    const input = validate.object(body, [
      'version',
      'dates',
      'workingHoursId',
      'remove',
    ]);
    const version = validate.version(input.version);
    if (
      !Array.isArray(input.dates) ||
      !input.dates.length ||
      input.dates.length > 366 ||
      new Set(input.dates).size !== input.dates.length ||
      (input.remove !== undefined && typeof input.remove !== 'boolean')
    )
      throw new BadRequestException('روزهای تقویم معتبر نیستند.');
    const dates = input.dates.map((d) =>
      validate.isoDate(d).toISOString().slice(0, 10),
    );
    return this.command(
      actor,
      key,
      { operation: 'shift.calendar', id, input },
      async (tx) => {
        const template = await this.record(tx, id, actor);
        if (
          template.section !== 'time' ||
          template.tab !== 'shiftTemplates' ||
          template.version !== version
        )
          throw new ConflictException('نسخه شیفت تعریف‌شده تغییر کرده است.');
        let values: string[] = [];
        if (!input.remove) {
          const hours = await this.record(
            tx,
            validate.uuid(input.workingHoursId),
            actor,
          );
          if (
            hours.branchId !== template.branchId ||
            hours.section !== 'time' ||
            hours.tab !== 'workingHours' ||
            hours.status !== 'فعال'
          )
            throw new BadRequestException(
              'ساعت کاری فعال همان شعبه انتخاب کنید.',
            );
          values = (hours.values as string[]).slice(2, 8);
        }
        const existing = await tx.hrRecord.findMany({
          where: {
            parentId: id,
            section: 'time',
            tab: 'templateDays',
            deletedAt: null,
          },
          take: 1101,
        });
        if (existing.length > 1100)
          throw new ConflictException('تقویم بیش از حد مجاز است.');
        for (const date of dates) {
          const previous = existing.find(
            (r) => (r.values as string[])[0] === date,
          );
          if (input.remove) {
            if (previous)
              await tx.hrRecord.update({
                where: { id: previous.id },
                data: { deletedAt: new Date(), version: { increment: 1 } },
              });
          } else if (previous)
            await tx.hrRecord.update({
              where: { id: previous.id },
              data: {
                values: [date, ...values],
                status: 'فعال',
                version: { increment: 1 },
              },
            });
          else
            await tx.hrRecord.create({
              data: {
                branchId: template.branchId,
                parentId: id,
                section: 'time',
                tab: 'templateDays',
                code: `HR-DAY-${randomUUID().slice(0, 16)}`,
                values: [date, ...values],
                status: 'فعال',
                effectiveAt: validate.isoDate(date),
              },
            });
        }
        await tx.hrRecord.update({
          where: { id },
          data: { version: { increment: 1 } },
        });
        await this.audit(
          tx,
          actor,
          { branchId: template.branchId, recordId: id },
          'shift.calendar',
          {
            dates,
            remove: Boolean(input.remove),
            workingHoursId: input.workingHoursId,
          },
          version + 1,
        );
        return { id, version: version + 1 };
      },
    );
  }
  async assignTemplate(
    id: string,
    body: unknown,
    key: unknown,
    actor: AuthenticatedActor,
  ) {
    this.require(actor, 'hr.manage');
    const input = validate.object(body, ['positionIds', 'from', 'to']);
    const from = validate.isoDate(input.from).toISOString().slice(0, 10),
      to = validate.isoDate(input.to).toISOString().slice(0, 10);
    if (
      to < from ||
      Date.parse(to) - Date.parse(from) > 366 * 86400000 ||
      !Array.isArray(input.positionIds) ||
      !input.positionIds.length ||
      input.positionIds.length > 100
    )
      throw new BadRequestException(
        'بازه و جایگاه‌های سازمانی معتبر انتخاب کنید.',
      );
    return this.command(
      actor,
      key,
      { operation: 'shift.assign-template', id, input },
      async (tx) => {
        const template = await this.record(tx, id, actor);
        if (
          template.section !== 'time' ||
          template.tab !== 'shiftTemplates' ||
          template.status !== 'فعال'
        )
          throw new BadRequestException('شیفت تعریف‌شده فعال انتخاب کنید.');
        const selected = await Promise.all(
          (input.positionIds as unknown[]).map((position) =>
            this.record(tx, validate.uuid(position), actor),
          ),
        );
        if (
          selected.some(
            (p) =>
              p.branchId !== template.branchId ||
              p.section !== 'organization' ||
              p.tab !== 'positions' ||
              p.status !== 'فعال',
          )
        )
          throw new BadRequestException('جایگاه فعال همان شعبه انتخاب کنید.');
        const people = await tx.hrEmployee.findMany({
          where: {
            branchId: template.branchId,
            status: 'فعال',
            deletedAt: null,
          },
        });
        const employees = people.filter((e) =>
          selected.some((p) => {
            const v = p.values as string[];
            const company = (p.data as HrWorkflowData).organizationBranchId;
            return (
              e.position === v[0] &&
              e.unit === v[2] &&
              (!company || company === e.organizationBranchId)
            );
          }),
        );
        if (!employees.length || employees.length > 500)
          throw new BadRequestException(
            'کارمند فعال متناظر با جایگاه‌ها یافت نشد یا تعداد بیش از حد مجاز است.',
          );
        const ids: string[] = [];
        for (const employee of employees) {
          const conflicts = await tx.hrRecord.findMany({
            where: {
              employeeId: employee.id,
              section: 'time',
              tab: 'shift',
              status: 'فعال',
              deletedAt: null,
            },
          });
          if (
            conflicts.some((r) => {
              const v = r.values as string[];
              return v[7]! <= to && v[8]! >= from;
            })
          )
            throw new ConflictException(
              'کارمند در بازه انتخابی شیفت فعال دارد.',
            );
          const data: HrWorkflowData = {};
          const schema = getHrResource('time', 'shift')!;
          const values = await this.values(
            tx,
            schema,
            [
              (template.values as string[])[0]!,
              '',
              '',
              '0',
              '0',
              '',
              '',
              from,
              to,
            ],
            employee,
            template.branchId,
            data,
            template.id,
          );
          const row = await tx.hrRecord.create({
            data: {
              branchId: template.branchId,
              employeeId: employee.id,
              parentId: template.id,
              section: 'time',
              tab: 'shift',
              code: `HR-SHF-${randomUUID().slice(0, 16)}`,
              values,
              data: json(data),
              status: 'فعال',
              effectiveAt: validate.isoDate(from),
            },
          });
          ids.push(row.id);
          await this.audit(
            tx,
            actor,
            {
              branchId: template.branchId,
              employeeId: employee.id,
              recordId: row.id,
            },
            'shift.assign-template',
            { from, to, templateId: id },
            1,
          );
        }
        return { ids };
      },
    );
  }

  private async setEmployeeGroup(
    tx: Tx,
    employee: Employee,
    id: unknown,
    actor: AuthenticatedActor,
  ) {
    if (id !== null && id !== '') {
      const group = await this.record(tx, validate.uuid(id), actor);
      if (
        group.branchId !== employee.branchId ||
        group.section !== 'organization' ||
        group.tab !== 'groups' ||
        group.status !== 'فعال'
      )
        throw new BadRequestException('گروه فعال همان شعبه را انتخاب کنید.');
    }
    await tx.hrRecord.updateMany({
      where: {
        employeeId: employee.id,
        section: 'organization',
        tab: 'groupMembers',
        status: 'فعال',
        deletedAt: null,
      },
      data: { status: 'غیرفعال', version: { increment: 1 } },
    });
    if (id)
      await tx.hrRecord.create({
        data: {
          branchId: employee.branchId,
          employeeId: employee.id,
          parentId: String(id),
          section: 'organization',
          tab: 'groupMembers',
          code: `HR-GRP-${randomUUID().slice(0, 16)}`,
          values: [employee.name],
          status: 'فعال',
        },
      });
  }
  private async syncRadanReviewers(
    tx: Tx,
    request: RecordRow,
    data: HrWorkflowData,
  ) {
    await tx.hrRecord.updateMany({
      where: {
        parentId: request.id,
        section: 'requests',
        tab: 'approvalAssignments',
        deletedAt: null,
      },
      data: { status: 'غیرفعال', version: { increment: 1 } },
    });
    if (!/انتظار|بررسی/.test(request.status)) return;
    const stage = data.approvalRoute?.[data.approvalStep ?? 0];
    if (!stage) return;
    const employee = await tx.hrEmployee.findFirst({
      where: {
        id: stage.employeeId,
        branchId: request.branchId,
        status: 'فعال',
        deletedAt: null,
      },
    });
    if (!employee)
      throw new ConflictException('تأییدکننده فعال در شعبه درخواست نیست.');
    await tx.hrRecord.create({
      data: {
        branchId: request.branchId,
        parentId: request.id,
        employeeId: employee.id,
        section: 'requests',
        tab: 'approvalAssignments',
        code: `HR-REV-${randomUUID().slice(0, 16)}`,
        values: [employee.name, String(stage.priority)],
        data: { senior: stage.senior },
        status: 'فعال',
      },
    });
  }
  private nameParts(
    input: Record<string, unknown>,
  ): [string, string] | undefined {
    if (input.firstName === undefined && input.lastName === undefined) return;
    const parts: [string, string] = [
      validate.text(input.firstName, 'نام', 80),
      validate.text(input.lastName, 'نام خانوادگی', 100),
    ];
    validate.text(parts.join(' '), 'نام', 160);
    if (
      input.name !== undefined &&
      validate.text(input.name, 'نام', 160) !== parts.join(' ')
    )
      throw new BadRequestException(
        'نام و نام خانوادگی با نام پرونده یکسان نیست.',
      );
    return parts;
  }
  private async syncIdentityNames(
    tx: Tx,
    employee: Employee,
    name: string,
    parts: [string, string] | undefined,
    actor: AuthenticatedActor,
  ) {
    const record = await tx.hrRecord.findFirst({
      where: {
        employeeId: employee.id,
        branchId: employee.branchId,
        section: 'employee',
        tab: 'identity',
        deletedAt: null,
      },
    });
    if (!record) return;
    const context = `${record.branchId}:${employee.id}:employee.identity`;
    const values = revealHrValues(record.data, context);
    const split = name.split(' ');
    const first =
      parts?.[0] ?? (name.startsWith(values[0] + ' ') ? values[0]! : split[0]!);
    const last = parts?.[1] ?? name.slice(first.length).trim();
    if (values[0] === first && values[1] === last) return;
    validate.text(first, 'نام', 80);
    validate.text(last, 'نام خانوادگی', 100);
    values[0] = first;
    values[1] = last;
    const changed = await tx.hrRecord.updateMany({
      where: { id: record.id, version: record.version, deletedAt: null },
      data: {
        data: json({
          ...publicHrData(record.data),
          ...protectHrValues(values, context),
        }),
        version: { increment: 1 },
      },
    });
    if (changed.count !== 1)
      throw new ConflictException('نسخه رکورد تغییر کرده است.');
    await this.audit(
      tx,
      actor,
      {
        branchId: employee.branchId,
        employeeId: employee.id,
        recordId: record.id,
      },
      'employee.identity.name',
      { fields: ['نام', 'نام خانوادگی'] },
      record.version + 1,
    );
  }
  private devicePassword(
    value: unknown,
    schema: HrResourceDefinition,
    actor: AuthenticatedActor,
  ) {
    if (value === undefined) return;
    if (schema.key !== 'time.biometric')
      throw new BadRequestException('فیلد ناشناخته در درخواست وجود دارد.');
    const input = validate.object(value, ['networkPassword']);
    if (input.networkPassword === undefined || input.networkPassword === '')
      return;
    this.require(actor, 'hr.sensitive');
    if (
      typeof input.networkPassword !== 'string' ||
      input.networkPassword.length > 500 ||
      input.networkPassword.includes(String.fromCharCode(0))
    )
      throw new BadRequestException('رمز عبور شبکه معتبر نیست.');
    return input.networkPassword;
  }
}
