import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { canViewRoute, type AuthenticatedActor } from '@nora/contracts';
import type { Prisma } from '@nora/database';
import { DatabaseService } from '../database/database.service';
import { IamCallCenterDirectory } from '../iam/iam-call-center-directory';
import { CallCenterTasksService } from '../tasks/call-center-tasks.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CallCenterCrypto } from './call-center.crypto';
import { CallCenterAccessService } from './call-center-access.service';
import type {
  CallCenterFollowUpDto,
  CallCenterRequestDto,
  CallCenterLinkDto,
  CallCenterReferralDto,
} from './call-center-workflow.dto';

const CATEGORY = 'CALL_CENTER_REQUEST';
type TaskPrivate = {
  action: string;
  result: string;
  priority: string;
  ownerName?: string;
};
@Injectable()
export class CallCenterWorkflowService
  implements OnModuleInit, OnModuleDestroy
{
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private reminderCursor: string | undefined;
  private readonly logger = new Logger(CallCenterWorkflowService.name);
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(CallCenterCrypto) private readonly crypto: CallCenterCrypto,
    @Inject(IamCallCenterDirectory)
    private readonly directory: IamCallCenterDirectory,
    @Inject(CallCenterTasksService)
    private readonly tasks: CallCenterTasksService,
    @Inject(NotificationsService)
    private readonly notifications: NotificationsService,
    @Inject(CallCenterAccessService)
    readonly access: CallCenterAccessService = new CallCenterAccessService(
      db,
      undefined as never,
    ),
  ) {}
  onModuleInit() {
    this.timer = setInterval(() => {
      void this.remind();
    }, 60_000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  scope(actor: AuthenticatedActor, branch: string | undefined, write = false) {
    const id = branch ?? actor.branchIds[0];
    if (
      !id ||
      !actor.branchIds.includes(id) ||
      !actor.permissions.includes('customer_affairs.call_center.read') ||
      !canViewRoute(actor.permissions, '/customer-affairs/call-center') ||
      (write &&
        !actor.permissions.includes(
          'customer_affairs.call_center.workflow.manage',
        ))
    )
      throw new ForbiddenException('دسترسی مدیریت پیگیری کال سنتر مجاز نیست.');
    return id;
  }
  private async contact(
    tx: Prisma.TransactionClient,
    id: string,
    branchId: string,
  ) {
    const contact = await tx.callCenterContact.findFirst({
      where: { id, branchId },
    });
    if (!contact) throw new NotFoundException('مخاطب پیدا نشد.');
    return contact;
  }
  private async lock(tx: Prisma.TransactionClient, id: string) {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${'cc-request:' + id},0))`;
    await tx.$queryRaw`SELECT id FROM customer_affairs_tickets WHERE id = ${id}::uuid FOR UPDATE`;
  }
  private async command(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedActor,
    branchId: string,
    id: string,
    entityId: string,
    input: unknown,
  ) {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${'cc-workflow:' + actor.userId + ':' + id},0))`;
    const fingerprint = this.crypto.fingerprint(
      JSON.stringify({ branchId, entityId, input }),
    );
    const where = {
      actorUserId_scope_idempotencyKey: {
        actorUserId: actor.userId,
        scope: 'cc.workflow.v1',
        idempotencyKey: id,
      },
    };
    const prior = await tx.customerAffairsCommand.findUnique({ where });
    if (prior && prior.requestFingerprint !== fingerprint)
      throw new ConflictException(
        'شناسه عملیات برای اطلاعات دیگری استفاده شده است.',
      );
    if (prior) return false;
    await tx.customerAffairsCommand.create({
      data: {
        actorUserId: actor.userId,
        scope: 'cc.workflow.v1',
        idempotencyKey: id,
        requestFingerprint: fingerprint,
        resultEntityId: entityId,
      },
    });
    return true;
  }
  async refer(
    actor: AuthenticatedActor,
    branch: string | undefined,
    id: string,
    input: CallCenterReferralDto,
  ) {
    const branchId = this.scope(actor, branch, true);
    return this.db.client.$transaction(async (tx) => {
      await this.lock(tx, id);
      const row = await tx.customerAffairsTicket.findFirst({
        where: { id, branchId, category: CATEGORY },
      });
      if (!row) throw new NotFoundException();
      if (this.access.scoped(actor)) {
        await this.access.request(actor, branchId, id, tx);
        await this.access.contact(
          actor,
          branchId,
          row.callCenterContactId!,
          'workflow',
          tx,
        );
        await this.access.recipient(actor, branchId, input.ownerId, tx);
      }
      await this.directory.referral(
        tx,
        branchId,
        input.ownerId,
        input.destination,
      );
      if (
        !(await this.command(tx, actor, branchId, input.commandId, id, input))
      )
        return { data: { id } };
      if (row.version !== input.expectedVersion)
        throw new ConflictException(
          'درخواست تغییر کرده است؛ اطلاعات را تازه‌سازی کنید.',
        );
      if (row.status === 'CLOSED')
        throw new BadRequestException('درخواست بسته را نمی‌توان ارجاع داد.');
      const existing = await tx.customerAffairsReferral.findFirst({
        where: {
          ticketId: id,
          destinationModule: input.destination,
          assignedUserId: input.ownerId,
          status: 'OPEN',
        },
      });
      if (existing)
        throw new ConflictException(
          'ارجاع باز برای این گیرنده و مقصد وجود دارد.',
        );
      const referral = await tx.customerAffairsReferral.create({
        data: {
          ticketId: id,
          destinationModule: input.destination,
          assignedUserId: input.ownerId,
          title: 'ارجاع درخواست کال سنتر',
          description:
            'شرح درخواست فقط در پرونده مجاز کال سنتر قابل مشاهده است.',
          dueAt: new Date(input.dueAt),
          idempotencyKey: input.commandId,
          requestFingerprint: this.crypto.fingerprint(JSON.stringify(input)),
          createdByUserId: actor.userId,
        },
      });
      await this.audit(
        tx,
        actor.userId,
        branchId,
        id,
        'REFERRED',
        row.version,
        {
          referralId: referral.id,
          destination: input.destination,
          ownerId: input.ownerId,
        },
      );
      await this.notify(
        tx,
        input.ownerId,
        actor.userId,
        id,
        'درخواست کال سنتر برای بررسی ارجاع شد',
      );
      return { data: { id, referralId: referral.id } };
    });
  }
  async options(actor: AuthenticatedActor, branch?: string) {
    const branchId = this.scope(actor, branch);
    const users = this.access.scoped(actor)
      ? await this.access.users(actor, branchId, 'workflow')
      : null;
    return {
      data: (await this.directory.list(branchId)).filter(
        (u) => !users || users.includes(u.id),
      ),
    };
  }
  async requestOptions(actor: AuthenticatedActor, branch?: string) {
    return {
      data: await this.directory.requestAssignees(
        actor,
        this.scope(actor, branch, true),
      ),
    };
  }
  async link(
    actor: AuthenticatedActor,
    branch: string | undefined,
    callId: string,
    input: CallCenterLinkDto,
  ) {
    const branchId = this.scope(actor, branch, true);
    return this.db.client.$transaction(async (tx) => {
      await this.lock(tx, input.ticketId);
      await tx.$queryRaw`SELECT id FROM customer_affairs_calls WHERE id = ${callId}::uuid FOR UPDATE`;
      const call = await tx.callCenterCall.findFirst({
        where: { id: callId, contact: { branchId } },
      });
      if (!call) throw new NotFoundException();
      if (this.access.scoped(actor))
        await this.access.contact(
          actor,
          branchId,
          call.contactId,
          'workflow',
          tx,
        );
      const ticket = await tx.customerAffairsTicket.findFirst({
        where: {
          id: input.ticketId,
          branchId,
          callCenterContactId: call.contactId,
          category: CATEGORY,
        },
      });
      if (!ticket)
        throw new NotFoundException('درخواست متعلق به این مخاطب نیست.');
      if (this.access.scoped(actor))
        await this.access.request(actor, branchId, ticket.id, tx);
      if (
        await this.command(tx, actor, branchId, input.commandId, callId, input)
      ) {
        if (ticket.status === 'CLOSED')
          throw new BadRequestException('ابتدا درخواست را بازگشایی کنید.');
        if (call.ticketId !== (input.expectedTicketId ?? null))
          throw new ConflictException(
            'ارتباط تماس تغییر کرده است؛ اطلاعات را دوباره دریافت کنید.',
          );
        await tx.callCenterCall.update({
          where: { id: callId },
          data: { ticketId: ticket.id },
        });
        await this.audit(
          tx,
          actor.userId,
          branchId,
          ticket.id,
          'CALL_LINKED',
          ticket.version,
          { callId, previousTicketId: call.ticketId, ticketId: ticket.id },
        );
      }
      return { data: { id: callId, ticketId: input.ticketId } };
    });
  }
  async queue(
    actor: AuthenticatedActor,
    branch: string | undefined,
    view: string,
    page: number,
  ) {
    this.scope(actor, undefined);
    const branchIds = [...new Set(actor.branchIds)];
    const scopedBranches = this.access.scoped(actor)
      ? await Promise.all(
          branchIds.map(async (branchId) => ({
            branchId,
            AND: [await this.access.requestWhere(actor, branchId)],
          })),
        )
      : null;
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const part = (type: string) =>
      parts.find((item) => item.type === type)!.value;
    const start = new Date(
      `${part('year')}-${part('month')}-${part('day')}T00:00:00+03:30`,
    );
    const now = new Date();
    const forView = (
      value: string,
    ): Prisma.CustomerAffairsTicketWhereInput => ({
      branchId: { in: branchIds },
      category: CATEGORY,
      callCenterContactId: { not: null },
      ...(scopedBranches ? { AND: [{ OR: scopedBranches }] } : {}),
      ...(value === 'CLOSED'
        ? { status: 'CLOSED' }
        : value !== 'ALL'
          ? { status: { not: 'CLOSED' } }
          : {}),
      ...(value === 'MINE'
        ? {
            OR: [
              { executionOwnerUserId: actor.userId },
              this.tasks.requestPredicate(
                branchIds,
                value,
                actor.userId,
                start,
                now,
              ),
            ],
          }
        : ['TODAY', 'OVERDUE', 'NO_ACTION'].includes(value)
          ? this.tasks.requestPredicate(
              branchIds,
              value,
              actor.userId,
              start,
              now,
            )
          : {}),
      ...(value === 'UNASSIGNED' ? { executionOwnerUserId: null } : {}),
      ...(value === 'NO_ACTION'
        ? { status: { in: ['NEW', 'IN_PROGRESS'] } }
        : {}),
    });
    const where = forView(view);
    const views = [
      'ALL',
      'OPEN',
      'CLOSED',
      'MINE',
      'TODAY',
      'OVERDUE',
      'UNASSIGNED',
      'NO_ACTION',
    ];
    return this.db.client.$transaction(
      async (tx) => {
        const counts = Object.fromEntries(
          await Promise.all(
            views.map(async (value) => [
              value,
              await tx.customerAffairsTicket.count({ where: forView(value) }),
            ]),
          ),
        );
        const total = counts[view] ?? 0;
        const rows = await tx.customerAffairsTicket.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          skip: (page - 1) * 50,
          take: 50,
          include: {
            executionOwner: { select: { displayName: true } },
            branch: { select: { name: true } },
          },
        });
        const deadlines = await this.tasks.deadlines(
          tx,
          branchIds,
          rows.filter((row) => row.status !== 'CLOSED').map((row) => row.id),
        );
        return {
          data: rows.map((row) => ({
            id: row.id,
            branchId: row.branchId,
            branchName: row.branch.name,
            dueAt:
              deadlines
                .find((item) => item.callCenterTicketId === row.id)
                ?._min.dueAt?.toISOString() ?? null,
            contactId: row.callCenterContactId!,
            title: this.crypto.decrypt<{ title: string }>(
              row.callCenterPayload!,
              row.callCenterKeyVersion!,
              `request:${row.id}:${row.callCenterContactId}`,
            ).title,
            ownerName: row.executionOwner?.displayName ?? null,
            status: row.status,
            priority: row.priority,
            createdAt: row.createdAt.toISOString(),
          })),
          meta: { total, page, pageSize: 50, counts, asOf: now.toISOString() },
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async nextAction(
    actor: AuthenticatedActor,
    branch: string | undefined,
    contactId: string,
  ) {
    const branchId = this.scope(actor, branch);
    return this.db.client.$transaction(async (tx) => {
      await this.contact(tx, contactId, branchId);
      if (this.access.scoped(actor))
        await this.access.contact(actor, branchId, contactId, 'workflow', tx);
      const requestWhere = {
        ...(this.access.scoped(actor)
          ? await this.access.requestWhere(actor, branchId, tx)
          : {}),
        branchId,
        category: CATEGORY,
        callCenterContactId: contactId,
        status: { not: 'CLOSED' },
      };
      const task = await this.tasks.next(
        tx,
        [branchId],
        requestWhere,
        this.access.scoped(actor)
          ? await this.access.users(actor, branchId, 'workflow', tx)
          : null,
      );
      if (!task) return { data: null };
      const request = await tx.customerAffairsTicket.findFirst({
        where: { ...requestWhere, id: task.callCenterTicketId! },
      });
      if (!request) return { data: null };
      const payload = task.payload as { encrypted: string; keyVersion: number };
      const detail = this.crypto.decrypt<TaskPrivate>(
        payload.encrypted,
        payload.keyVersion,
        `followup:${task.id}:${request.id}`,
      );
      return {
        data: {
          id: task.id,
          requestId: request.id,
          requestTitle: this.crypto.decrypt<{ title: string }>(
            request.callCenterPayload!,
            request.callCenterKeyVersion!,
            `request:${request.id}:${contactId}`,
          ).title,
          requestStatus: request.status,
          action: detail.action,
          ownerName: detail.ownerName ?? null,
          dueAt: task.dueAt!.toISOString(),
          overdue: task.dueAt!.getTime() < Date.now(),
        },
      };
    });
  }
  async list(
    actor: AuthenticatedActor,
    branch: string | undefined,
    contactId: string,
    page = 1,
    taskPage = 1,
    requestId?: string,
    openOnly = false,
  ) {
    const branchId = this.scope(actor, branch);
    return this.db.client.$transaction(async (tx) => {
      await this.contact(tx, contactId, branchId);
      if (this.access.scoped(actor))
        await this.access.contact(actor, branchId, contactId, 'workflow', tx);
      const rows = await tx.customerAffairsTicket.findMany({
        where: {
          ...(this.access.scoped(actor)
            ? await this.access.requestWhere(actor, branchId, tx)
            : {}),
          branchId,
          callCenterContactId: contactId,
          category: CATEGORY,
          ...(requestId ? { id: requestId } : {}),
          ...(openOnly ? { status: { not: 'CLOSED' } } : {}),
        },
        include: { executionOwner: { select: { displayName: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * 10,
        take: 10,
      });
      const taskResult = await this.tasks.pages(
        tx,
        branchId,
        rows.map((row) => row.id),
        taskPage,
        this.access.scoped(actor)
          ? await this.access.users(actor, branchId, 'workflow', tx)
          : null,
      );
      const tasks = taskResult.rows;
      const total = await tx.customerAffairsTicket.count({
        where: {
          ...(this.access.scoped(actor)
            ? await this.access.requestWhere(actor, branchId, tx)
            : {}),
          branchId,
          callCenterContactId: contactId,
          category: CATEGORY,
          ...(requestId ? { id: requestId } : {}),
          ...(openOnly ? { status: { not: 'CLOSED' } } : {}),
        },
      });
      const history = await tx.customerAffairsAuditEvent.findMany({
        where: {
          branchId,
          entityId: { in: rows.map((row) => row.id) },
          entityType: 'CALL_CENTER_REQUEST',
        },
        orderBy: { occurredAt: 'desc' },
        take: 100,
      });
      return {
        meta: {
          page,
          taskPage,
          total,
          hasMoreTasks: taskResult.hasMore,
          ...(requestId
            ? {
                contactCallCount: await tx.callCenterCall.count({
                  where: { contactId },
                }),
              }
            : {}),
        },
        data: await Promise.all(
          rows.map(async (row) => ({
            canEditManagement: await this.directory.canManageRequest(
              actor,
              branchId,
              row.executionOwnerUserId ?? row.createdByUserId,
              tx,
            ),
            id: row.id,
            version: row.version,
            customerId: actor.permissions.includes('customers.read')
              ? row.customerId
              : null,
            title: this.crypto.decrypt<{ title: string; reason: string }>(
              row.callCenterPayload!,
              row.callCenterKeyVersion!,
              `request:${row.id}:${contactId}`,
            ).title,
            privateHistory:
              this.crypto.decrypt<{ history?: unknown[] }>(
                row.callCenterPayload!,
                row.callCenterKeyVersion!,
                `request:${row.id}:${contactId}`,
              ).history ?? [],
            reason: this.crypto.decrypt<{ reason: string }>(
              row.callCenterPayload!,
              row.callCenterKeyVersion!,
              `request:${row.id}:${contactId}`,
            ).reason,
            result:
              this.crypto.decrypt<{ result?: string }>(
                row.callCenterPayload!,
                row.callCenterKeyVersion!,
                `request:${row.id}:${contactId}`,
              ).result ?? '',
            status: row.status,
            priority: row.priority,
            ownerId: row.executionOwnerUserId,
            ownerName: row.executionOwner?.displayName ?? null,
            createdAt: row.createdAt.toISOString(),
            followUps: tasks
              .filter((task) => task.sourceReference === row.id)
              .map((task) => {
                const payload = task.payload as {
                  version: number;
                  encrypted: string;
                  keyVersion: number;
                  history?: unknown[];
                };
                return {
                  id: task.id,
                  version: payload.version,
                  ownerId: task.assigneeUserId,
                  dueAt: task.dueAt!.toISOString(),
                  status: task.status,
                  ...this.crypto.decrypt<TaskPrivate>(
                    payload.encrypted,
                    payload.keyVersion,
                    `followup:${task.id}:${row.id}`,
                  ),
                  history: payload.history ?? [],
                };
              }),
            history: history
              .filter((event) => event.entityId === row.id)
              .map((event) => ({
                id: event.id,
                action: event.action,
                at: event.occurredAt.toISOString(),
                actorId: event.actorUserId,
                version: event.version,
                changes: event.afterSnapshot,
              })),
          })),
        ),
      };
    });
  }
  async saveRequest(
    actor: AuthenticatedActor,
    branch: string | undefined,
    contactId: string,
    input: CallCenterRequestDto,
  ) {
    const branchId = this.scope(actor, branch, true);
    if (!input.title.trim())
      throw new BadRequestException('عنوان درخواست را وارد کنید.');
    if (typeof input.reason !== 'string' || !input.reason.trim())
      throw new BadRequestException(
        'دلیل تغییر، بستن یا بازگشایی را وارد کنید.',
      );
    await this.db.client.$transaction(async (tx) => {
      await this.contact(tx, contactId, branchId);
      if (this.access.scoped(actor)) {
        await this.access.contact(actor, branchId, contactId, 'workflow', tx);
        if (input.expectedVersion === 0 && !input.ownerId)
          input = { ...input, ownerId: actor.userId };
      }
      await this.lock(tx, input.id);
      if (
        !(await this.command(tx, actor, branchId, input.commandId, input.id, {
          contactId,
          ...input,
        }))
      )
        return;
      // Preserve the original command fingerprint for retries from older clients.
      // NEW no longer represents a separate operational request state.
      if (input.status === 'NEW') input = { ...input, status: 'IN_PROGRESS' };
      const current = await tx.customerAffairsTicket.findFirst({
        where: { id: input.id },
      });
      if (current && this.access.scoped(actor))
        await this.access.request(actor, branchId, current.id, tx);
      if (
        current &&
        (current.branchId !== branchId ||
          current.callCenterContactId !== contactId ||
          current.category !== CATEGORY)
      )
        throw new NotFoundException();
      if ((current?.version ?? 0) !== input.expectedVersion)
        throw new ConflictException(
          'درخواست تغییر کرده است؛ اطلاعات را دوباره دریافت کنید.',
        );

      if (current) {
        const saved = this.crypto.decrypt<{ title: string }>(
          current.callCenterPayload!,
          current.callCenterKeyVersion!,
          `request:${input.id}:${contactId}`,
        );
        const changed =
          saved.title !== input.title.trim() ||
          (current.executionOwnerUserId ?? null) !== (input.ownerId ?? null) ||
          current.priority !== input.priority;
        if (
          (changed ||
            ((current.status === 'NEW' ? 'IN_PROGRESS' : current.status) !==
              input.status &&
              (current.status === 'CLOSED' ||
                !['IN_PROGRESS', 'WAITING_CUSTOMER'].includes(
                  input.status,
                )))) &&
          !(await this.directory.canManageRequest(
            actor,
            branchId,
            current.executionOwnerUserId ?? current.createdByUserId,
            tx,
          ))
        )
          throw new ForbiddenException(
            'ویرایش عنوان، مسئول، وضعیت و اولویت درخواست فقط برای مدیر واحد مجاز است.',
          );
      }
      if (current?.status === 'CLOSED' && input.status === 'WAITING_CUSTOMER')
        throw new BadRequestException('ابتدا درخواست را بازگشایی کنید.');
      if (!current && input.status !== 'IN_PROGRESS')
        throw new BadRequestException(
          'درخواست تازه باید منتظر اقدام کارشناس باشد.',
        );
      if (
        input.status === 'CLOSED' &&
        input.result !== undefined &&
        !input.result.trim()
      )
        throw new BadRequestException('نتیجه رسیدگی را وارد کنید.');
      if (
        input.ownerId &&
        (!current || current.executionOwnerUserId !== input.ownerId)
      )
        await this.directory.resolveRequestAssignee(
          tx,
          actor,
          branchId,
          input.ownerId,
        );
      const openTasks = current
        ? await this.tasks.list(tx, branchId, [current.id])
        : [];
      if (
        input.status === 'CLOSED' &&
        openTasks.some((task) => task.status === 'OPEN')
      )
        throw new BadRequestException(
          'ابتدا پیگیری‌های باز را انجام دهید یا لغو کنید.',
        );
      const now = new Date();
      const previousPrivate = current
        ? this.crypto.decrypt<{
            history?: Prisma.InputJsonValue[];
            result?: string;
          }>(
            current.callCenterPayload!,
            current.callCenterKeyVersion!,
            `request:${input.id}:${contactId}`,
          )
        : null;
      const privateHistory = [
        ...(previousPrivate?.history ?? []),
        {
          at: now.toISOString(),
          actorId: actor.userId,
          title: input.title.trim(),
          reason: input.reason.trim(),
          result: input.result?.trim() ?? previousPrivate?.result ?? '',
          status: input.status,
          ownerId: input.ownerId ?? null,
          version: (current?.version ?? 0) + 1,
        },
      ];
      if (privateHistory.length > 200)
        throw new BadRequestException(
          'حد تغییرات این درخواست رسیده است؛ درخواست جدید بسازید.',
        );
      const data = {
        executionOwnerUserId: input.ownerId ?? null,
        status: input.status,
        priority: input.priority,
        callCenterPayload: this.crypto.encrypt(
          {
            title: input.title.trim(),
            reason: input.reason.trim(),
            result: input.result?.trim() ?? previousPrivate?.result ?? '',
            history: privateHistory,
          },
          `request:${input.id}:${contactId}`,
        ),
        callCenterKeyVersion: this.crypto.keyVersion,
        updatedByUserId: actor.userId,
        closedAt: input.status === 'CLOSED' ? now : null,
      };
      if (current)
        await tx.customerAffairsTicket.update({
          where: { id: input.id },
          data: {
            ...data,
            version: { increment: 1 },
            ...(current.status === 'CLOSED' && input.status !== 'CLOSED'
              ? { reopenCount: { increment: 1 } }
              : {}),
          },
        });
      else
        await tx.customerAffairsTicket.create({
          data: {
            ...data,
            id: input.id,
            callCenterContactId: contactId,
            branchId,
            trackingNumber: input.id.replace(/-/g, ''),
            subject: 'درخواست کال سنتر',
            description:
              'محتوا در پرونده رمزنگاری‌شده کال سنتر نگهداری می‌شود.',
            channel: 'PHONE',
            contactOccurredAt: now,
            category: CATEGORY,
            impact: 'NORMAL',
            urgency: 'NORMAL',
            customerOwnerUserId: actor.userId,
            references: [],
            slaPolicyVersion: 'CALL_CENTER_NO_SLA',
            firstResponseDueAt: now,
            resolutionDueAt: now,
            nextAction: 'پیگیری در کال سنتر',
            nextActionAt: now,
            createdByUserId: actor.userId,
          },
        });
      await this.audit(
        tx,
        actor.userId,
        branchId,
        input.id,
        current ? 'REQUEST_UPDATED' : 'REQUEST_CREATED',
        (current?.version ?? 0) + 1,
        {
          status: input.status,
          ownerId: input.ownerId ?? null,
          previousOwnerId: current?.executionOwnerUserId ?? null,
          previousStatus: current?.status ?? null,
        },
      );
      if (input.ownerId && current?.executionOwnerUserId !== input.ownerId)
        await this.notify(
          tx,
          input.ownerId,
          actor.userId,
          input.id,
          'درخواست کال سنتر به شما ارجاع شد',
        );
      if (current && current.status !== 'CLOSED' && input.status === 'CLOSED') {
        const recipients = await this.directory.closureRecipients(tx, branchId);
        for (const recipient of recipients)
          await this.notify(
            tx,
            recipient.id,
            actor.userId,
            input.id,
            'درخواست کال سنتر رسیدگی و بسته شد',
          );
      }
    });
    return this.list(actor, branchId, contactId);
  }
  async followUp(
    actor: AuthenticatedActor,
    branch: string | undefined,
    ticketId: string,
    input: CallCenterFollowUpDto,
  ) {
    const branchId = this.scope(actor, branch, true);
    let contactId = '';
    await this.db.client.$transaction(async (tx) => {
      await this.lock(tx, ticketId);
      const ticket = await tx.customerAffairsTicket.findFirst({
        where: {
          id: ticketId,
          branchId,
          category: CATEGORY,
          callCenterContactId: { not: null },
        },
      });
      if (!ticket) throw new NotFoundException();
      contactId = ticket.callCenterContactId!;
      if (this.access.scoped(actor)) {
        await this.access.request(actor, branchId, ticketId, tx);
        await this.access.contact(actor, branchId, contactId, 'workflow', tx);
        await this.access.recipient(actor, branchId, input.ownerId, tx);
      }
      if (
        !(await this.command(
          tx,
          actor,
          branchId,
          input.commandId,
          ticketId,
          input,
        ))
      )
        return;
      if (ticket.status === 'CLOSED')
        throw new BadRequestException('ابتدا درخواست را بازگشایی کنید.');
      if (
        !input.action.trim() ||
        (input.status !== 'OPEN' && !input.result.trim())
      )
        throw new BadRequestException(
          'شرح اقدام و نتیجه انجام یا لغو را کامل کنید.',
        );
      if (input.expectedVersion === 0 && input.status !== 'OPEN')
        throw new BadRequestException('پیگیری تازه باید باز باشد.');
      const prior = (await this.tasks.list(tx, branchId, [ticketId])).find(
        (task) => task.id === input.id,
      );
      if (prior && this.access.scoped(actor))
        await this.access.recipient(actor, branchId, prior.assigneeUserId, tx);
      if (prior && prior.status !== 'OPEN')
        throw new BadRequestException(
          'پیگیری پایان‌یافته قابل بازنویسی نیست؛ اقدام جدید بسازید.',
        );
      const owner =
        !prior ||
        prior.assigneeUserId !== input.ownerId ||
        input.status === 'OPEN'
          ? await this.directory.resolve(tx, branchId, input.ownerId)
          : null;
      const priorPrivate = prior
        ? this.crypto.decrypt<TaskPrivate>(
            (prior.payload as { encrypted: string }).encrypted,
            (prior.payload as { keyVersion: number }).keyVersion,
            `followup:${input.id}:${ticketId}`,
          )
        : null;
      const priorPayload = prior?.payload as
        { history?: Prisma.InputJsonValue[] } | undefined;
      const history = [
        ...(priorPayload?.history ?? []),
        {
          at: new Date().toISOString(),
          actorId: actor.userId,
          ownerId: input.ownerId,
          dueAt: new Date(input.dueAt).toISOString(),
          status: input.status,
          version: input.expectedVersion + 1,
        },
      ];
      if (history.length > 200)
        throw new BadRequestException(
          'حد تغییرات این پیگیری رسیده است؛ اقدام جدید بسازید.',
        );
      await this.notifications.retireCallCenterTaskWithinTransaction(
        tx,
        input.id,
      );
      await this.tasks.save(tx, {
        id: input.id,
        ticketId,
        branchId,
        ownerId: input.ownerId,
        dueAt: new Date(input.dueAt),
        status: input.status,
        expectedVersion: input.expectedVersion,
        payload: {
          version: input.expectedVersion + 1,
          encrypted: this.crypto.encrypt(
            {
              action: input.action.trim(),
              result: input.result.trim(),
              priority: input.priority,
              ownerName:
                owner?.displayName ?? priorPrivate?.ownerName ?? 'مسئول قبلی',
            },
            `followup:${input.id}:${ticketId}`,
          ),
          keyVersion: this.crypto.keyVersion,
          history,
        },
      });
      await this.audit(
        tx,
        actor.userId,
        branchId,
        ticketId,
        'FOLLOW_UP_' + input.status,
        ticket.version,
        {
          taskId: input.id,
          ownerId: input.ownerId,
          dueAt: input.dueAt,
          taskVersion: input.expectedVersion + 1,
        },
      );
      if (!prior || prior.assigneeUserId !== input.ownerId)
        await this.notify(
          tx,
          input.ownerId,
          actor.userId,
          ticketId,
          'پیگیری کال سنتر به شما ارجاع شد',
        );
    });
    return this.list(actor, branchId, contactId);
  }
  private audit(
    tx: Prisma.TransactionClient,
    actorUserId: string | null,
    branchId: string,
    id: string,
    action: string,
    version: number,
    afterSnapshot: Prisma.InputJsonValue,
  ) {
    return tx.customerAffairsAuditEvent.create({
      data: {
        actorUserId,
        branchId,
        entityType: 'CALL_CENTER_REQUEST',
        entityId: id,
        action,
        version,
        afterSnapshot,
      },
    });
  }
  private notify(
    tx: Prisma.TransactionClient,
    recipient: string,
    actor: string | null,
    id: string,
    title: string,
    taskId?: string,
  ) {
    return this.notifications.createWithinTransaction(tx, {
      recipientUserIds: [recipient],
      actorUserId: actor,
      sourceModule: 'customer-affairs',
      eventType: 'call-center.followup',
      title,
      message: 'برای بررسی به پنل کال سنتر مراجعه کنید.',
      entityType: taskId ? 'CALL_CENTER_FOLLOW_UP' : 'CALL_CENTER_REQUEST',
      entityId: taskId ?? id,
      href: '/customer-affairs/call-center',
    });
  }
  async remind(now = new Date()) {
    if (this.running) return;
    this.running = true;
    try {
      const candidates = await this.tasks.dueIds(now, this.reminderCursor);
      for (const candidate of candidates) {
        this.reminderCursor = candidate.id;
        await this.db.client.$transaction(async (tx) => {
          await this.lock(tx, candidate.sourceReference);
          const ticket = await tx.customerAffairsTicket.findFirst({
            where: {
              id: candidate.sourceReference,
              category: CATEGORY,
              status: { not: 'CLOSED' },
            },
          });
          if (!ticket) return;
          const task = (
            await this.tasks.list(tx, candidate.branchId, [ticket.id])
          ).find((row) => row.id === candidate.id);
          if (
            !task ||
            task.status !== 'OPEN' ||
            !task.dueAt ||
            task.dueAt > now
          )
            return;
          if (
            !(await this.directory.list(candidate.branchId, tx)).some(
              (user) => user.id === task.assigneeUserId,
            )
          )
            return;
          const payload = task.payload as {
            version: number;
            reminded?: boolean;
          };
          if (payload.reminded) return;
          const key = `cc-due:${task.id}:${payload.version}`;
          const claimed = await tx.customerAffairsCommand.createMany({
            data: [
              {
                actorUserId: ticket.createdByUserId,
                scope: 'cc.reminder.v1',
                idempotencyKey: key,
                requestFingerprint: this.crypto.fingerprint(key),
                resultEntityId: ticket.id,
              },
            ],
            skipDuplicates: true,
          });
          if (claimed.count)
            await this.notify(
              tx,
              task.assigneeUserId,
              null,
              ticket.id,
              'موعد پیگیری کال سنتر رسیده است',
              task.id,
            );
          await this.tasks.markReminded(tx, task.id, task.payload);
        });
      }
      if (candidates.length < 100) this.reminderCursor = undefined;
    } catch {
      this.logger.error(
        'Call Center reminder processing failed; retrying on next tick.',
      );
    } finally {
      this.running = false;
    }
  }
}
