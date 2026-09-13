import { createHash, randomUUID } from 'node:crypto';
import {
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PROCUREMENT_PERMISSION_CODES,
  PROCUREMENT_REQUEST_STATUSES,
  type AuthenticatedActor,
  type ProcurementDraftV1,
  type ProcurementPermission,
  type ProcurementRequestV1,
} from '@rubi/contracts';
import { Prisma } from '@rubi/database';
import { DatabaseService } from '../database/database.service';
import { DocumentsService } from '../documents/documents.service';
import { HrProcurementDirectory } from '../hr/hr-procurement-directory';
import { IamProcurementDirectory } from '../iam/iam-procurement-directory';
import { MasterProcurementDirectory } from '../master-data/master-procurement-directory';
import { ProcurementPolicyPort } from './procurement.ports';
import {
  ProcurementRuleError,
  decimal,
  requireRule,
  validatePolicy,
  validateSubmission,
} from './domain/procurement.rules';
import * as v from './procurement.validation';
import {
  ProcurementOperations,
  type CommitmentPolicy,
} from './procurement.operations';
import { operationalQueue, procurementReport } from './procurement.reporting';
import { NotificationsService } from '../notifications/notifications.service';

export type ProcurementTx = Prisma.TransactionClient;
export type ProcurementRow = Prisma.ProcurementRequestGetPayload<null>;
export const json = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
function fingerprint(value: unknown): string {
  const canonical = (input: unknown): unknown =>
    Array.isArray(input)
      ? input.map(canonical)
      : input && typeof input === 'object'
        ? Object.fromEntries(
            Object.entries(input)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, val]) => [key, canonical(val)]),
          )
        : input;
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
}
export function requestDto(row: ProcurementRow): ProcurementRequestV1 {
  return {
    id: row.id,
    number: row.number,
    version: row.version,
    status: row.status as ProcurementRequestV1['status'],
    requesterUserId: row.requesterUserId,
    ownerUserId: row.ownerUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    draft: row.data as unknown as ProcurementDraftV1,
  };
}
export async function procurementBoundary<T>(
  work: () => Promise<T>,
): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof ProcurementRuleError) {
      const status = [
        'FORBIDDEN',
        'NO_VALID_APPROVER',
        'APPROVAL_LIMIT_EXCEEDED',
      ].includes(error.code)
        ? 403
        : [
              'CONCURRENT_MODIFICATION',
              'IDEMPOTENCY_CONFLICT',
              'DUPLICATE_INVOICE',
              'INVALID_STATE',
            ].includes(error.code)
          ? 409
          : error.code.endsWith('NOT_CONNECTED') ||
              error.code.endsWith('UNAVAILABLE')
            ? 503
            : 422;
      throw new HttpException(
        { code: error.code, message: error.message, field: error.field },
        status,
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ['P2002', 'P2003', 'P2034'].includes(error.code)
    )
      throw new HttpException(
        {
          code:
            error.code === 'P2002'
              ? 'CONFLICT'
              : error.code === 'P2034'
                ? 'CONCURRENT_MODIFICATION'
                : 'INVALID_REFERENCE',
          message:
            'اطلاعات یا نسخه مرجع تغییر کرده است. پرونده را تازه‌سازی کنید.',
        },
        409,
      );
    throw error;
  }
}

@Injectable()
export class ProcurementService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(MasterProcurementDirectory)
    private readonly master: MasterProcurementDirectory,
    @Inject(HrProcurementDirectory) private readonly hr: HrProcurementDirectory,
    @Inject(IamProcurementDirectory)
    private readonly iam: IamProcurementDirectory,
    @Inject(DocumentsService) private readonly documents: DocumentsService,
    @Inject(ProcurementPolicyPort)
    private readonly policy: ProcurementPolicyPort,
    @Inject(ProcurementOperations)
    private readonly operations: ProcurementOperations,
    @Inject(NotificationsService)
    private readonly notifications: NotificationsService,
  ) {}
  private require(
    actor: AuthenticatedActor,
    permission: ProcurementPermission,
  ) {
    if (!actor.permissions.includes(permission))
      throw new ForbiddenException('مجوز این اقدام خرید وجود ندارد.');
  }
  private async scope(
    actor: AuthenticatedActor,
  ): Promise<Prisma.ProcurementRequestWhereInput> {
    const where: Prisma.ProcurementRequestWhereInput = {
      branchId: { in: actor.branchIds },
    };
    if (actor.permissions.includes('procurement.read.all')) return where;
    const choices: Prisma.ProcurementRequestWhereInput[] = [];
    if (actor.permissions.includes('procurement.read.own'))
      choices.push(
        { requesterUserId: actor.userId },
        { ownerUserId: actor.userId },
      );
    if (actor.permissions.includes('procurement.read.unit')) {
      const self = await this.hr.self(actor);
      if (self?.unitId)
        choices.push({ branchId: self.branchId, unitId: self.unitId });
    }
    if (!choices.length)
      throw new ForbiddenException('دسترسی مشاهده خرید وجود ندارد.');
    return { ...where, OR: choices };
  }
  private branch(actor: AuthenticatedActor, id: string) {
    if (!actor.branchIds.includes(id))
      throw new ForbiddenException('شعبه خارج از محدوده دسترسی است.');
  }
  private async sqlScope(actor: AuthenticatedActor): Promise<Prisma.Sql> {
    await this.scope(actor);
    if (!actor.branchIds.length) return Prisma.sql`false`;
    const branch = Prisma.sql`r."branchId" IN (${Prisma.join(actor.branchIds.map((id) => Prisma.sql`${id}::uuid`))})`;
    if (actor.permissions.includes('procurement.read.all')) return branch;
    const choices: Prisma.Sql[] = [];
    if (actor.permissions.includes('procurement.read.own'))
      choices.push(
        Prisma.sql`(r."requesterUserId" = ${actor.userId}::uuid OR r."ownerUserId" = ${actor.userId}::uuid)`,
      );
    if (actor.permissions.includes('procurement.read.unit')) {
      const self = await this.hr.self(actor);
      if (self?.unitId)
        choices.push(
          Prisma.sql`(r."branchId" = ${self.branchId}::uuid AND r."unitId" = ${self.unitId})`,
        );
    }
    return Prisma.sql`${branch} AND (${Prisma.join(choices, ' OR ')})`;
  }
  async report(query: Record<string, unknown>, actor: AuthenticatedActor) {
    v.object(query, ['dimension', 'page']);
    const dimension = v.text(query.dimension ?? 'currency', 'dimension', 20);
    requireRule(
      ['currency', 'unit', 'category', 'supplier'].includes(dimension),
      'VALIDATION_ERROR',
      'گروه‌بندی معتبر نیست.',
    );
    return procurementReport(
      this.database.client,
      await this.sqlScope(actor),
      dimension,
      v.integer(Number(query.page ?? 1), 'page', 100000),
    );
  }
  async owners(query: Record<string, unknown>, actor: AuthenticatedActor) {
    this.require(actor, 'procurement.assign');
    v.object(query, ['branchId', 'search', 'page']);
    const branchId = v.uuid(query.branchId);
    this.branch(actor, branchId);
    return this.iam.candidates(
      branchId,
      v.text(query.search, 'search', 100, true),
      v.integer(Number(query.page ?? 1), 'page', 100000),
    );
  }
  async bootstrap(actor: AuthenticatedActor) {
    if (
      !actor.permissions.some((code) =>
        (PROCUREMENT_PERMISSION_CODES as readonly string[]).includes(code),
      )
    )
      throw new ForbiddenException('دسترسی خرید وجود ندارد.');
    const [currencies, branches, requester] = await Promise.all([
      this.master.currencies(),
      this.master.branches(actor.branchIds),
      this.hr.self(actor),
    ]);
    return {
      permissions: PROCUREMENT_PERMISSION_CODES.filter((code) =>
        actor.permissions.includes(code),
      ),
      currencies,
      branches: branches.map((branch) => ({
        id: branch.id,
        label: branch.name,
      })),
      requester,
      policy: 'POLICY_NOT_CONFIGURED' as const,
      finance: 'NOT_CONNECTED' as const,
      documents: 'AVAILABLE' as const,
      travel: 'NOT_CONNECTED' as const,
    };
  }
  async list(query: Record<string, unknown>, actor: AuthenticatedActor) {
    v.object(query, ['page', 'search', 'status', 'queue']);
    const page = v.integer(Number(query.page ?? 1), 'page', 100000);
    const search = v.text(query.search, 'search', 100, true);
    const status = v.text(query.status, 'status', 40, true);
    requireRule(
      !status ||
        (PROCUREMENT_REQUEST_STATUSES as readonly string[]).includes(status),
      'VALIDATION_ERROR',
      'وضعیت معتبر نیست.',
    );
    const queue = v.text(query.queue, 'queue', 30, true);
    requireRule(
      !queue ||
        [
          'own',
          'unit',
          'unassigned',
          'approvals',
          'returned',
          'late',
          'partial',
          'discrepant',
          'finance',
        ].includes(queue),
      'VALIDATION_ERROR',
      'صف معتبر نیست.',
    );
    const operational = operationalQueue(queue);
    if (operational) {
      const filters = [await this.sqlScope(actor), operational];
      if (status) filters.push(Prisma.sql`r.status = ${status}`);
      if (search)
        filters.push(
          Prisma.sql`(r.title ILIKE ${`%${search.replace(/[\\%_]/g, '\\$&')}%`} OR r.number ILIKE ${`%${search.replace(/[\\%_]/g, '\\$&')}%`})`,
        );
      const rows = await this.database.client.$queryRaw<ProcurementRow[]>(
        Prisma.sql`WITH selected AS MATERIALIZED (SELECT r.id, r."createdAt" FROM procurement_request r WHERE ${Prisma.join(filters, ' AND ')} ORDER BY r."createdAt" DESC, r.id DESC LIMIT 51 OFFSET ${(page - 1) * 50}) SELECT r.* FROM selected s JOIN procurement_request r ON r.id = s.id ORDER BY s."createdAt" DESC, s.id DESC`,
      );
      return {
        items: rows.slice(0, 50).map(requestDto),
        page,
        pageSize: 50,
        hasMore: rows.length > 50,
      };
    }
    const and: Prisma.ProcurementRequestWhereInput[] = [
      await this.scope(actor),
    ];
    if (search)
      and.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { number: { contains: search, mode: 'insensitive' } },
        ],
      });
    if (status) and.push({ status });
    if (queue === 'own')
      and.push({
        OR: [{ requesterUserId: actor.userId }, { ownerUserId: actor.userId }],
      });
    if (queue === 'unit') {
      const self = await this.hr.self(actor);
      requireRule(self?.unitId, 'FORBIDDEN', 'واحد فعال کاربر مشخص نیست.');
      and.push({ branchId: self.branchId, unitId: self.unitId });
    }
    if (queue === 'unassigned')
      and.push({
        ownerUserId: null,
        status: { notIn: ['CLOSED', 'CANCELLED', 'REJECTED'] },
      });
    if (queue === 'returned') and.push({ status: 'CHANGES_REQUESTED' });
    if (queue === 'approvals')
      and.push({
        status: 'IN_REVIEW',
        procurementApprovalSnapshotRequestidRows: {
          some: {
            procurementApprovalStepSnapshotidRows: {
              some: { approverUserId: actor.userId, status: 'PENDING' },
            },
          },
        },
      });
    // Sort/skip narrow identities before loading immutable draft payloads on deep pages.
    // Reapply scope on the bounded second read so a concurrent reassignment cannot leak data.
    const selected =
      page > 1
        ? await this.database.client.procurementRequest.findMany({
            where: { AND: and },
            select: { id: true },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 51,
            skip: (page - 1) * 50,
          })
        : null;
    const rows = await this.database.client.procurementRequest.findMany({
      where: {
        AND: selected
          ? [...and, { id: { in: selected.map((row) => row.id) } }]
          : and,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 51,
    });
    return {
      items: rows.slice(0, 50).map(requestDto),
      page,
      pageSize: 50,
      hasMore: rows.length > 50,
    };
  }
  async detail(id: string, actor: AuthenticatedActor) {
    const row = await this.database.client.procurementRequest.findFirst({
      where: { AND: [await this.scope(actor), { id: v.uuid(id) }] },
    });
    if (!row) throw new NotFoundException('پرونده خرید پیدا نشد.');
    return requestDto(row);
  }
  async suppliers(query: Record<string, unknown>, actor: AuthenticatedActor) {
    await this.scope(actor);
    v.object(query, ['page', 'search']);
    return this.master.suppliers(
      v.text(query.search, 'search', 100, true),
      v.integer(Number(query.page ?? 1), 'page', 100000),
    );
  }
  private async validateReferences(
    draft: ProcurementDraftV1,
    actor: AuthenticatedActor,
    clean = false,
    requesterUserId = actor.userId,
  ) {
    this.branch(actor, draft.branchId);
    if (draft.currencyCode)
      await this.master.assertCurrency(draft.currencyCode);
    const self =
      requesterUserId === actor.userId
        ? await this.hr.self(actor, draft.branchId)
        : await this.hr.requester(actor, requesterUserId, draft.branchId);
    requireRule(
      !draft.unitId || self?.unitId === draft.unitId,
      'FORBIDDEN',
      'واحد درخواست باید واحد فعال درخواست‌کننده باشد.',
    );
    for (const reference of draft.documents) {
      this.requireDocumentPermission(actor);
      const { data } = await this.documents.detail(reference.id, actor, {});
      const version = data.versions.find(
        (version) => version.id === reference.versionId,
      );
      requireRule(
        data.branchId === draft.branchId &&
          data.type.domain === 'PROCUREMENT' &&
          version &&
          data.archiveStatus !== 'DELETED',
        'INVALID_DOCUMENT',
        'نسخه سند برای خرید یا شعبه معتبر نیست.',
      );
      if (clean)
        requireRule(
          version.scanStatus === 'CLEAN' && !data.isIncomplete,
          'DOCUMENTS_UNAVAILABLE',
          'مدرک سالم و کامل برای ارسال لازم است.',
        );
    }
  }
  private requireDocumentPermission(actor: AuthenticatedActor) {
    if (
      !actor.permissions.includes('documents.metadata.read') ||
      !actor.permissions.includes('documents.procurement.read')
    )
      throw new ForbiddenException('مجوز مدارک خرید وجود ندارد.');
  }
  private async storeItems(
    tx: ProcurementTx,
    requestId: string,
    draft: ProcurementDraftV1,
  ) {
    const existing = await tx.procurementRequestItem.findMany({
      where: { id: { in: draft.items.map((item) => item.id) } },
      select: { requestId: true },
    });
    requireRule(
      existing.every((item) => item.requestId === requestId),
      'INVALID_REFERENCE',
      'قلم متعلق به درخواست دیگری است.',
    );
    await tx.procurementRequestItem.updateMany({
      where: { requestId },
      data: { active: false },
    });
    if (!draft.items.length) return;
    const records = draft.items.map((item) => ({
      ...item,
      quantity:
        item.quantity && decimal(item.quantity) > 0n ? item.quantity : null,
      data: item,
    }));
    const affected = await tx.$executeRaw(Prisma.sql`
      INSERT INTO procurement_request_item (id, "requestId", kind, description, quantity, unit, "acceptanceCriteria", active, data, "updatedAt")
      SELECT x.id, ${requestId}::uuid, x.kind, x.description, x.quantity, NULLIF(x.unit, ''), NULLIF(x."acceptanceCriteria", ''), true, x.data, CURRENT_TIMESTAMP
      FROM jsonb_to_recordset(${JSON.stringify(records)}::jsonb)
        AS x(id uuid, kind text, description text, quantity numeric(24,4), unit text, "acceptanceCriteria" text, data jsonb)
      ON CONFLICT (id) DO UPDATE SET kind = EXCLUDED.kind, description = EXCLUDED.description,
        quantity = EXCLUDED.quantity, unit = EXCLUDED.unit, "acceptanceCriteria" = EXCLUDED."acceptanceCriteria",
        active = true, data = EXCLUDED.data, "updatedAt" = CURRENT_TIMESTAMP
      WHERE procurement_request_item."requestId" = EXCLUDED."requestId"`);
    requireRule(
      affected === draft.items.length,
      'INVALID_REFERENCE',
      'شناسه قلم هم‌زمان در درخواست دیگری استفاده شده است.',
    );
  }
  private columns(draft: ProcurementDraftV1) {
    return {
      title: draft.title,
      category: draft.category || null,
      priority: draft.priority,
      urgent: draft.urgent,
      unitId: draft.unitId,
      requiredAt: draft.requiredAt ? new Date(draft.requiredAt) : null,
      estimatedAmount: draft.currencyCode ? draft.estimatedAmount : null,
      currencyCode: draft.currencyCode,
      data: json(draft),
    };
  }
  private async idempotent(
    actor: AuthenticatedActor,
    branchId: string,
    operation: string,
    keyValue: unknown,
    input: unknown,
    work: (tx: ProcurementTx) => Promise<ProcurementRequestV1>,
  ): Promise<ProcurementRequestV1> {
    const key = v.text(keyValue, 'Idempotency-Key', 160);
    const requestHash = fingerprint(input);
    const where = {
      actorUserId_branchId_operation_key: {
        actorUserId: actor.userId,
        branchId,
        operation,
        key,
      },
    };
    const replay = async () => {
      const existing =
        await this.database.client.procurementIdempotency.findUnique({ where });
      if (!existing) return null;
      requireRule(
        existing.requestHash === requestHash,
        'IDEMPOTENCY_CONFLICT',
        'این کلید قبلاً برای ورودی دیگری استفاده شده است.',
      );
      return existing.response as unknown as ProcurementRequestV1;
    };
    const previous = await replay();
    if (previous) return previous;
    try {
      return await this.database.client.$transaction(
        async (tx) => {
          await tx.$queryRaw(
            Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${actor.userId}:${branchId}:${operation}:${key}`}, 0))::text`,
          );
          const committed = await tx.procurementIdempotency.findUnique({
            where,
          });
          if (committed) {
            requireRule(
              committed.requestHash === requestHash,
              'IDEMPOTENCY_CONFLICT',
              'این کلید قبلاً برای ورودی دیگری استفاده شده است.',
            );
            return committed.response as unknown as ProcurementRequestV1;
          }
          const response = await work(tx);
          await tx.procurementIdempotency.create({
            data: {
              actorUserId: actor.userId,
              branchId,
              operation,
              key,
              requestHash,
              response: json(response),
            },
          });
          return response;
        },
        { timeout: 30000 },
      );
    } catch (error) {
      if (
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002') ||
        (error instanceof ProcurementRuleError &&
          error.code === 'CONCURRENT_MODIFICATION')
      ) {
        const concurrent = await replay();
        if (concurrent) return concurrent;
      }
      throw error;
    }
  }
  async create(body: unknown, key: unknown, actor: AuthenticatedActor) {
    this.require(actor, 'procurement.request.create');
    const draft = v.draft(body);
    await this.validateReferences(draft, actor);
    return this.idempotent(
      actor,
      draft.branchId,
      'CREATE',
      key,
      draft,
      async (tx) => {
        const id = randomUUID();
        const row = await tx.procurementRequest.create({
          data: {
            id,
            number: `PR-${id}`,
            branchId: draft.branchId,
            requesterUserId: actor.userId,
            ...this.columns(draft),
          },
        });
        await this.storeItems(tx, id, draft);
        await tx.procurementRequestVersion.create({
          data: {
            requestId: id,
            version: 1,
            payload: json(draft),
            createdByUserId: actor.userId,
          },
        });
        await this.audit(tx, row, actor, 'CREATE');
        return requestDto(row);
      },
    );
  }
  async update(
    id: string,
    body: unknown,
    key: unknown,
    actor: AuthenticatedActor,
  ) {
    this.require(actor, 'procurement.request.update');
    const input = v.object(body, ['expectedVersion', 'draft', 'reason']);
    const version = v.integer(input.expectedVersion);
    const draft = v.draft(input.draft);
    const existing = await this.detail(id, actor);
    requireRule(
      existing.requesterUserId === actor.userId ||
        actor.permissions.includes('procurement.assign'),
      'FORBIDDEN',
      'ویرایش این درخواست مجاز نیست.',
    );
    requireRule(
      draft.branchId === existing.draft.branchId,
      'INVALID_REFERENCE',
      'انتقال شعبه درخواست مجاز نیست.',
    );
    const reason = v.text(input.reason, 'reason', 1000, true);
    await this.validateReferences(
      draft,
      actor,
      false,
      existing.requesterUserId,
    );
    return this.idempotent(
      actor,
      draft.branchId,
      `UPDATE:${id}`,
      key,
      { version, draft, reason },
      async (tx) => {
        const before = await this.claim(tx, id, version);
        requireRule(
          !['CANCELLED', 'CLOSED', 'REJECTED'].includes(before.status),
          'INVALID_STATE',
          'درخواست نهایی قابل ویرایش نیست.',
        );
        if (!['DRAFT', 'CHANGES_REQUESTED'].includes(before.status))
          requireRule(
            reason,
            'REASON_REQUIRED',
            'علت اصلاح پس از ارسال لازم است.',
          );
        await tx.procurementApprovalStep.updateMany({
          where: {
            status: 'PENDING',
            procurementApprovalStepSnapshotid: { requestId: id },
          },
          data: { status: 'SUPERSEDED', version: { increment: 1 } },
        });
        const row = await tx.procurementRequest.update({
          where: { id },
          data: { ...this.columns(draft), status: 'DRAFT' },
        });
        await this.storeItems(tx, id, draft);
        await tx.procurementRequestVersion.create({
          data: {
            requestId: id,
            version: row.version,
            payload: json(draft),
            createdByUserId: actor.userId,
          },
        });
        await this.audit(tx, row, actor, 'UPDATE', reason);
        return requestDto(row);
      },
    );
  }
  private async claim(tx: ProcurementTx, id: string, version: number) {
    const before = await tx.procurementRequest.findUniqueOrThrow({
      where: { id },
    });
    const claim = await tx.procurementRequest.updateMany({
      where: { id, version },
      data: { version: { increment: 1 } },
    });
    requireRule(
      claim.count === 1,
      'CONCURRENT_MODIFICATION',
      'پرونده هم‌زمان تغییر کرده است؛ آخرین نسخه را دریافت کنید.',
    );
    return before;
  }
  private async audit(
    tx: ProcurementTx,
    row: ProcurementRow,
    actor: AuthenticatedActor,
    action: string,
    reason?: string,
  ) {
    const audit = await tx.procurementAudit.create({
      data: {
        requestId: row.id,
        actorUserId: actor.userId,
        action,
        entityType: 'REQUEST',
        entityId: row.id,
        reason: reason || null,
        after: { version: row.version, status: row.status },
      },
    });
    await tx.procurementOutbox.create({
      data: {
        requestId: row.id,
        eventType: 'procurement.workflow-event.v1',
        status: 'BLOCKED',
        payload: {
          contract: 'procurement.workflow-event.v1',
          requestId: row.id,
          requestVersion: row.version,
          auditId: audit.id,
          action,
          status: row.status,
          ownerUserId: row.ownerUserId,
          connection: 'TASKS_NOT_CONNECTED',
        },
      },
    });
    if (action !== 'CREATE' && action !== 'UPDATE') {
      const pending =
        row.status === 'IN_REVIEW'
          ? await tx.procurementApprovalStep.findFirst({
              where: {
                status: 'PENDING',
                procurementApprovalStepSnapshotid: { requestId: row.id },
              },
              orderBy: [{ createdAt: 'desc' }, { position: 'asc' }],
            })
          : null;
      await this.notifications.createWithinTransaction(tx, {
        recipientUserIds: [
          ...new Set(
            [
              row.requesterUserId,
              row.ownerUserId,
              pending?.approverUserId,
            ].filter((id): id is string => Boolean(id) && id !== actor.userId),
          ),
        ],
        actorUserId: actor.userId,
        sourceModule: 'PROCUREMENT',
        eventType: 'procurement.workflow-event.v1',
        title: 'اقدام در پرونده خرید',
        message:
          'وضعیت پرونده خرید تغییر کرده است. تصمیم رسمی را در پرونده ثبت کنید.',
        entityType: 'ProcurementRequest',
        entityId: row.id,
        href: `/purchases?request=${row.id}`,
      });
    }
    return audit;
  }
  async command(
    id: string,
    body: unknown,
    key: unknown,
    actor: AuthenticatedActor,
  ) {
    const input = v.object(body);
    const action = v.text(input.action, 'action', 40);
    const permissions: Record<string, ProcurementPermission> = {
      SUBMIT: 'procurement.request.submit',
      CANCEL: 'procurement.request.cancel',
      ASSIGN: 'procurement.assign',
      DECIDE: 'procurement.approve',
      QUOTE: 'procurement.quote.manage',
      SELECT_QUOTE: 'procurement.quote.select',
      ORDER: 'procurement.order.manage',
      ISSUE_ORDER: 'procurement.order.issue',
      AMEND_ORDER: 'procurement.order.amend',
      CLOSE_REMAINDER: 'procurement.order.cancel',
      CLOSE_REQUEST: 'procurement.order.cancel',
      CANCEL_ORDER: 'procurement.order.cancel',
      RECEIVE: 'procurement.receipt.manage',
      ACCEPT_SERVICE: 'procurement.acceptance.manage',
      ADJUST_RECEIPT: 'procurement.acceptance.manage',
      DISCREPANCY: 'procurement.discrepancy.manage',
      RESOLVE_DISCREPANCY: 'procurement.discrepancy.manage',
      RETURN: 'procurement.return.manage',
      INVOICE: 'procurement.invoice.manage',
      MATCH_INVOICE: 'procurement.invoice.manage',
      SUBMIT_FINANCE: 'procurement.invoice.submit_finance',
    };
    const permission = permissions[action];
    requireRule(permission, 'VALIDATION_ERROR', 'اقدام معتبر نیست.');
    this.require(actor, permission);
    const version = v.integer(input.expectedVersion);
    const existing = await this.detail(id, actor);
    const reason = v.text(input.reason, 'reason', 1000, true);
    return this.idempotent(
      actor,
      existing.draft.branchId,
      `${action}:${id}`,
      key,
      input,
      async (tx) => {
        const before = await this.claim(tx, id, version);
        const draft = before.data as unknown as ProcurementDraftV1;
        if (action === 'SUBMIT') {
          requireRule(
            ['DRAFT', 'CHANGES_REQUESTED'].includes(before.status),
            'INVALID_STATE',
            'درخواست قابل ارسال نیست.',
          );
          const policy = await this.policy.resolve(draft);
          validatePolicy(policy, draft, before.requesterUserId);
          if (draft.urgent) this.require(actor, 'procurement.emergency');
          validateSubmission(draft);
          await this.validateReferences(
            draft,
            actor,
            true,
            before.requesterUserId,
          );
          requireRule(
            draft.origin.kind === 'GENERAL',
            'TRAVEL_NOT_CONNECTED',
            'قرارداد ارجاع تخصصی سفر هنوز متصل نیست.',
          );
          const candidates = await this.iam.authorizedUsers(
            policy.steps.map((step) => step.userId),
            before.branchId,
            'procurement.approve',
          );
          requireRule(
            candidates.length === policy.steps.length,
            'NO_VALID_APPROVER',
            'تأییدکننده فعال و مجاز وجود ندارد.',
          );
          const requestVersion =
            await tx.procurementRequestVersion.findFirstOrThrow({
              where: { requestId: id },
              orderBy: { version: 'desc' },
            });
          const snapshot = await tx.procurementApprovalSnapshot.create({
            data: {
              requestId: id,
              requestVersionId: requestVersion.id,
              policyReference: policy.id,
              policyVersion: String(policy.version),
              payload: json(policy),
            },
          });
          await tx.procurementApprovalStep.createMany({
            data: policy.steps.map((step, position) => ({
              snapshotId: snapshot.id,
              position: position + 1,
              approverUserId: step.userId,
              data: json(step),
            })),
          });
          await tx.procurementRequest.update({
            where: { id },
            data: { status: 'IN_REVIEW' },
          });
        } else if (action === 'CANCEL') {
          requireRule(reason, 'REASON_REQUIRED', 'دلیل لغو لازم است.');
          requireRule(
            !['CANCELLED', 'CLOSED'].includes(before.status),
            'INVALID_STATE',
            'درخواست نهایی است.',
          );
          requireRule(
            (await tx.procurementOrder.count({ where: { requestId: id } })) ===
              0,
            'INVALID_STATE',
            'درخواست دارای سفارش است؛ مانده سفارش را تعیین تکلیف کنید.',
          );
          await tx.procurementRequest.update({
            where: { id },
            data: { status: 'CANCELLED' },
          });
        } else if (action === 'ASSIGN') {
          const ownerUserId = v.uuid(input.ownerUserId);
          requireRule(
            (
              await this.iam.authorizedUsers(
                [ownerUserId],
                before.branchId,
                'procurement.quote.manage',
              )
            ).length === 1,
            'NO_VALID_APPROVER',
            'مسئول فعال و مجاز خرید پیدا نشد.',
          );
          await tx.procurementRequest.update({
            where: { id },
            data: { ownerUserId },
          });
        } else if (action === 'DECIDE') {
          requireRule(
            before.status === 'IN_REVIEW',
            'INVALID_STATE',
            'درخواست منتظر تأیید نیست.',
          );
          const decision = v.text(input.decision, 'decision', 30);
          requireRule(
            ['APPROVED', 'REJECTED', 'CHANGES_REQUESTED'].includes(decision),
            'VALIDATION_ERROR',
            'تصمیم معتبر نیست.',
          );
          requireRule(
            decision === 'APPROVED' || reason,
            'REASON_REQUIRED',
            'دلیل رد یا بازگشت لازم است.',
          );
          const snapshot =
            await tx.procurementApprovalSnapshot.findFirstOrThrow({
              where: { requestId: id },
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            });
          const step = await tx.procurementApprovalStep.findFirst({
            where: { snapshotId: snapshot.id, status: 'PENDING' },
            orderBy: { position: 'asc' },
          });
          requireRule(
            step &&
              step.approverUserId === actor.userId &&
              before.requesterUserId !== actor.userId,
            'NO_VALID_APPROVER',
            'این مرحله برای تأییدکننده مستقل دیگری است.',
          );
          const policy = snapshot.payload as unknown as CommitmentPolicy;
          const approvalDraft = policy.commitment
            ? {
                ...draft,
                estimatedAmount: policy.commitment.amount,
                currencyCode: policy.commitment.currencyCode,
              }
            : draft;
          validatePolicy(policy, approvalDraft, before.requesterUserId);
          const ceiling = v.object(step.data).maximumAmount;
          if (approvalDraft.estimatedAmount !== null)
            requireRule(
              decimal(approvalDraft.estimatedAmount) <= decimal(ceiling),
              'APPROVAL_LIMIT_EXCEEDED',
              'مبلغ از سقف تأیید بیشتر است.',
            );
          await tx.procurementApprovalDecision.create({
            data: {
              stepId: step.id,
              actorUserId: actor.userId,
              decision,
              reason: reason || null,
              data: { permission, requestVersion: before.version },
            },
          });
          await tx.procurementApprovalStep.update({
            where: { id: step.id },
            data: { status: decision, version: { increment: 1 } },
          });
          const remaining = await tx.procurementApprovalStep.count({
            where: { snapshotId: snapshot.id, status: 'PENDING' },
          });
          await tx.procurementRequest.update({
            where: { id },
            data: {
              status:
                decision === 'APPROVED' && remaining > 0
                  ? 'IN_REVIEW'
                  : decision,
            },
          });
          if (
            policy.commitment &&
            (decision !== 'APPROVED' || remaining === 0)
          ) {
            const changed = await tx.procurementOrder.updateMany({
              where: {
                id: policy.commitment.orderId,
                requestId: id,
                version: policy.commitment.version,
                status: 'PENDING_APPROVAL',
              },
              data: { status: decision },
            });
            requireRule(
              changed.count === 1,
              'CONCURRENT_MODIFICATION',
              'نسخه تعهد سفارش تغییر کرده است.',
            );
          }
        } else await this.operations.execute(tx, before, action, input, actor);
        const after = await tx.procurementRequest.findUniqueOrThrow({
          where: { id },
        });
        await this.audit(tx, after, actor, action, reason);
        return requestDto(after);
      },
    );
  }
  async records(
    id: string,
    query: Record<string, unknown>,
    actor: AuthenticatedActor,
  ) {
    await this.detail(id, actor);
    v.object(query, ['kind', 'page']);
    const kind = v.text(query.kind, 'kind', 30);
    const page = v.integer(Number(query.page ?? 1), 'page', 100000);
    if (kind === 'audit') this.require(actor, 'procurement.audit.read');
    return this.operations.records(this.database.client, id, kind, page);
  }
}
