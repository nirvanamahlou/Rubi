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
} from '@rubi/contracts';
import { Prisma } from '@rubi/database';

import { DatabaseService } from '../database/database.service';
import { DocumentsService } from '../documents/documents.service';
import { IamService } from '../iam/iam.service';
import * as validate from './hr.validation';

type Tx = Prisma.TransactionClient;
type Employee = Prisma.HrEmployeeGetPayload<null>;
type RecordRow = Prisma.HrRecordGetPayload<null>;
type AssignmentLabels = {
  branches: Map<string, string>;
  managers: Map<string, string>;
};
const employeeKeys = [
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
const systemResources = new Set(['time.periods', 'time.leaveGrants']);
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
  ) {}

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
      branchId: { in: actor.branchIds },
      deletedAt: null,
      ...(this.has(actor, 'hr.read') || this.has(actor, 'hr.manage')
        ? {}
        : { employee: this.employeeScope(actor) }),
    };
  }
  private async employee(tx: Tx, id: string, actor: AuthenticatedActor) {
    const result = await tx.hrEmployee.findFirst({
      where: { AND: [this.employeeScope(actor), { id: validate.uuid(id) }] },
      include: {
        manager: { select: { name: true } },
        organizationBranch: true,
      },
    });
    if (!result)
      throw new NotFoundException('کارمند در محدوده دسترسی پیدا نشد.');
    return result;
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
    },
  ): HrEmployeeDto {
    return {
      id: row.id,
      personnelCode: row.personnelCode,
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
    const assignments = rows.filter(
      (row) => row.section === 'employee' && row.tab === 'assignment',
    );
    if (!assignments.length)
      return { branches: new Map(), managers: new Map() };
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
    const sensitive = schema.sensitive && !this.has(actor, 'hr.sensitive');
    const values = [...(row.values as string[])];
    if (schema.key === 'employee.assignment') {
      const labels = display ?? (await this.assignmentLabels([row], actor));
      values[0] = labels.branches.get(values[0]!) ?? values[0]!;
      const managerId = values[3];
      if (managerId && /^[a-f0-9-]{36}$/i.test(managerId)) {
        values[3] = labels.managers.get(managerId) ?? 'مدیر پیشین';
      }
    }
    return {
      id: row.id,
      code: row.code,
      branchId: row.branchId,
      section: row.section,
      tab: row.tab,
      employeeId: row.employeeId,
      parentId: row.parentId,
      columns: [...schema.columns],
      values: sensitive ? schema.columns.map(() => '••••') : values,
      status: row.status,
      version: row.version,
      effectiveAt: row.effectiveAt?.toISOString().slice(0, 10) ?? null,
      appliedAt: row.appliedAt?.toISOString() ?? null,
      deletedAt: row.deletedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      data: sensitive ? {} : (row.data as HrWorkflowData),
    };
  }
  async bootstrap(actor: AuthenticatedActor): Promise<HrBootstrapDto> {
    this.readable(actor);
    // An authorized HR read advances already approved, due changes transactionally.
    // No new decision is made here; appliedAt prevents replay on refresh.
    const workflowWarnings =
      this.has(actor, 'hr.manage') && this.has(actor, 'hr.approve')
        ? await this.applyDue(actor)
        : [];
    const [employees, records, recordCount, options] = await Promise.all([
      this.database.client.hrEmployee.findMany({
        where: this.employeeScope(actor),
        include: {
          manager: { select: { name: true } },
          organizationBranch: true,
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
    ]);
    await this.auditRead(actor, 'bootstrap', records.length);
    return {
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
    const where = { AND: [this.recordScope(actor), filters] };
    const [rows, total] = await Promise.all([
      this.database.client.hrRecord.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
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
  private async insertEmployee(
    tx: Tx,
    input: Record<string, unknown>,
    actor: AuthenticatedActor,
    photoDocumentId: string | null = null,
  ) {
    const branchId = this.branch(actor, input.branchId);
    const row = await tx.hrEmployee.create({
      data: {
        branchId,
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
        unit: validate.text(input.unit, 'واحد'),
        position: validate.text(input.position, 'سمت'),
        grade: validate.text(input.grade, 'رده', 40),
        managerId: await this.manager(tx, input.managerId, branchId, actor),
        startedAt: validate.isoDate(input.startedAtValue),
        status: input.status ? validate.status(input.status, false) : 'فعال',
      },
    });
    const assignment = await tx.hrRecord.create({
      data: {
        branchId,
        employeeId: row.id,
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
    if (id && data.organizationBranchId) {
      let frontier = [id],
        inspected = 0;
      while (frontier.length) {
        const children = await tx.hrRecord.findMany({
          where: {
            parentId: { in: frontier },
            section: 'organization',
            tab: 'units',
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
            return company && company !== data.organizationBranchId;
          })
        )
          throw new BadRequestException(
            'واحد دارای زیرمجموعه متعلق به شرکت دیگر است.',
          );
        frontier = children.map((child) => child.id);
      }
    }
  }
  async createEmployee(body: unknown, key: unknown, actor: AuthenticatedActor) {
    this.require(actor, 'hr.manage');
    const input = validate.object(body, employeeKeys);
    const photo = input.photoDocumentId
      ? await this.documentReference(input.photoDocumentId, actor)
      : null;
    const result = await this.command(
      actor,
      key,
      { operation: 'employee.create', input },
      async (tx) => ({
        id: (await this.insertEmployee(tx, input, actor, photo)).id,
      }),
    );
    return this.employeeDto(
      await this.employee(this.database.client, result.id, actor),
    );
  }
  async updateEmployee(id: string, body: unknown, actor: AuthenticatedActor) {
    this.require(actor, 'hr.manage');
    const input = validate.object(body, [...employeeKeys, 'version']);
    const expected = validate.version(input.version);
    const photo = input.photoDocumentId
      ? await this.documentReference(input.photoDocumentId, actor)
      : undefined;
    const row = await this.transaction(async (tx) => {
      const existing = await this.employee(tx, id, actor);
      if (existing.version !== expected)
        throw new ConflictException('نسخه کارمند تغییر کرده است.');
      for (const key of [
        'branchId',
        'unit',
        'position',
        'grade',
        'managerId',
        'startedAtValue',
      ])
        if (input[key] !== undefined)
          throw new BadRequestException(
            'تغییر انتصاب باید از گردش ارتقا یا انتقال با تاریخ اثر ثبت شود.',
          );
      const data: Prisma.HrEmployeeUncheckedUpdateManyInput = {
        version: { increment: 1 },
      };
      for (const key of ['name', 'kind', 'personnelCode'] as const)
        if (input[key] !== undefined)
          data[key] = validate.text(
            input[key],
            key,
            key === 'personnelCode' ? 50 : key === 'kind' ? 80 : 160,
          );
      if (input.status !== undefined && input.status !== existing.status)
        throw new BadRequestException(
          'پایان همکاری باید از پرونده خروج ثبت شود.',
        );
      if (input.userId !== undefined)
        data.userId = await this.userReference(input.userId, existing.branchId);
      if (photo !== undefined) data.photoDocumentId = photo;
      if (input.organizationBranchId !== undefined) {
        if (
          existing.organizationBranchId &&
          existing.organizationBranchId !== input.organizationBranchId
        )
          throw new BadRequestException(
            'تغییر شرکت کارمند باید با انتقال و تاریخ اثر انجام شود.',
          );
        data.organizationBranchId = await this.organizationBranch(
          tx,
          input.organizationBranchId,
          existing.branchId,
          actor,
        );
      }
      const changed = await tx.hrEmployee.updateMany({
        where: { id, version: expected, deletedAt: null },
        data,
      });
      if (changed.count !== 1)
        throw new ConflictException('نسخه کارمند تغییر کرده است.');
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
  ) {
    const values = validate.recordValues(input, schema);
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
    const documentId = data.documentId
      ? await this.documentReference(data.documentId, actor)
      : null;
    const result = await this.command(
      actor,
      key,
      { operation: 'record.create', input },
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
        if (employee && employee.branchId !== branchId)
          throw new BadRequestException(
            'کارمند متعلق به شعبه انتخاب‌شده نیست.',
          );
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
            (parent.employeeId && parent.employeeId !== employee?.id))
        )
          throw new BadRequestException(
            'ارتباط پرونده والد با این رکورد معتبر نیست.',
          );
        if (schema.key === 'organization.units')
          await this.unitCompany(tx, branchId, parent?.id ?? null, data, actor);
        const values = await this.values(
          tx,
          schema,
          input.values,
          employee,
          branchId,
          data,
        );
        if (schema.key === 'recruitment.applicants' && parent) {
          const openingCompany = (parent.data as HrWorkflowData)
            .organizationBranchId;
          if (
            openingCompany &&
            data.organizationBranchId &&
            openingCompany !== data.organizationBranchId
          )
            throw new BadRequestException(
              'فرصت شغلی باید متعلق به شرکت انتخاب‌شده باشد.',
            );
          values[1] = (parent.values as string[])[0] ?? '';
        }
        const state = validate.status(input.status, schema.approval);
        if (schema.approval && validate.APPROVED.has(state))
          await this.approve(tx, schema, actor, employee);
        if (schema.key === 'finance.batch' && validate.APPROVED.has(state))
          throw new ConflictException(
            'قرارداد عمومی دریافت ورودی پرداخت Finance هنوز منتشر نشده است.',
          );
        const row = await tx.hrRecord.create({
          data: {
            branchId,
            employeeId: employee?.id ?? null,
            parentId: parent?.id ?? null,
            documentId,
            section: schema.section,
            tab: schema.tab,
            code: `HR-${randomUUID().slice(0, 16).toUpperCase()}`,
            values,
            searchText: values.join(' '),
            expiresAt: this.expiry(schema, values),
            data: json(data),
            status: state,
            effectiveAt: this.effective(schema, values, input.effectiveAt),
          },
        });
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
            values,
            data,
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
      ? await this.documentReference(providedData.documentId, actor)
      : undefined;
    return this.transaction(async (tx) => {
      const row = await this.record(tx, id, actor);
      if (row.version !== expected)
        throw new ConflictException('رکورد توسط کاربر دیگری تغییر کرده است.');
      const schema = validate.resource(row.section, row.tab);
      let parentId = row.parentId;
      if (input.parentId !== undefined) {
        if (
          !['organization.units', 'recruitment.applicants'].includes(schema.key)
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
          cursor = schema.key === 'organization.units' ? parent.parentId : null;
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
        ? await this.employee(tx, row.employeeId, actor)
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
      const state = validate.status(input.status, schema.approval, row.status);
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
      const approvalAction =
        schema.approval &&
        state !== row.status &&
        ['تأییدشده', 'تاییدشده', 'فعال', 'آماده شروع', 'ردشده'].includes(state);
      if (approvalAction) await this.approve(tx, schema, actor, employee);
      else this.writeResource(schema, actor, employee);
      const cancel = state === 'لغوشده' && validate.APPROVED.has(row.status);
      if (schema.approval && validate.FINAL.has(row.status) && !cancel)
        throw new ConflictException(
          'رکورد نهایی تغییرپذیر نیست؛ اصلاحیه مرتبط ثبت کنید.',
        );
      if (
        cancel &&
        (!providedData?.reason ||
          input.values !== undefined ||
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
        (input.values !== undefined || input.effectiveAt !== undefined)
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
      if (schema.key === 'organization.units')
        await this.unitCompany(tx, row.branchId, parentId, data, actor, row.id);
      const values =
        input.values === undefined &&
        (cancel ||
          !['time.corrections', 'requests.attendance'].includes(schema.key))
          ? (row.values as string[])
          : await this.values(
              tx,
              schema,
              input.values ?? row.values,
              employee,
              row.branchId,
              data,
            );
      if (schema.key === 'recruitment.applicants' && parentId) {
        const opening = await this.record(tx, parentId, actor);
        const openingCompany = (opening.data as HrWorkflowData)
          .organizationBranchId;
        if (
          openingCompany &&
          data.organizationBranchId &&
          openingCompany !== data.organizationBranchId
        )
          throw new BadRequestException(
            'فرصت شغلی باید متعلق به شرکت انتخاب‌شده باشد.',
          );
        values[1] = (opening.values as string[])[0] ?? '';
      }
      const changed = await tx.hrRecord.updateMany({
        where: { id, version: expected, deletedAt: null },
        data: {
          parentId,
          values,
          searchText: values.join(' '),
          expiresAt: this.expiry(schema, values),
          status: state,
          data: json(data),
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
      await this.amounts(tx, updated, schema, values, data);
      if (approvalAction && validate.APPROVED.has(state))
        await this.effects(tx, updated, schema, actor, employee);
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
            values: row.values,
            data: row.data,
            status: row.status,
            parentId: row.parentId,
          },
          after: { values, data, status: state, parentId },
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
    if (state === 'ENDED' && !reason)
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
      if (row.employeeId)
        throw new ConflictException('ورود این نیرو قبلاً انجام شده است.');
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
    const shift = source.find((row) => {
      const values = row.values as string[];
      return (
        row.tab === 'shift' &&
        row.employeeId === employeeId &&
        values[7]! <= date &&
        values[8]! >= date &&
        row.status === 'فعال'
      );
    });
    const shiftValues = shift?.values as string[] | undefined;
    const nextDate = new Date(validate.isoDate(date).getTime() + 86400000)
      .toISOString()
      .slice(0, 10);
    const overnight = Boolean(
      shiftValues &&
      validate.digits(shiftValues[2]!) <= validate.digits(shiftValues[1]!),
    );
    const shiftStart = shiftValues
      ? validate.localClockToUtc(date, shiftValues[1]!)
      : null;
    const shiftEnd = shiftValues
      ? validate.localClockToUtc(overnight ? nextDate : date, shiftValues[2]!)
      : null;
    const lower = overnight
      ? shiftStart!.getTime() - 6 * 3600000
      : validate.localClockToUtc(date, '00:00').getTime();
    const upper = overnight
      ? shiftEnd!.getTime() + 6 * 3600000
      : validate.localClockToUtc(nextDate, '00:00').getTime();
    const punches = source.filter((row) => {
      if (row.tab !== 'checkins' || row.employeeId !== employeeId) return false;
      const v = row.values as string[];
      const at = new Date(
        (row.data as HrWorkflowData).startsAt ??
          validate.localClockToUtc(v[1]!, v[2]!),
      );
      return at.getTime() >= lower && at.getTime() < upper;
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
            section: 'time',
            tab: { in: ['checkins', 'shift'] },
            deletedAt: null,
          },
          take: 10000,
        });
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
}
