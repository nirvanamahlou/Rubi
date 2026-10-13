import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type { AuthenticatedActor, FinanceInboxQueryV1 } from '@nora/contracts';
import { DatabaseService } from '../../database/database.service';
import { IamFinanceDirectory } from '../../iam/iam-finance-directory';
import { NotificationsService } from '../../notifications/notifications.service';
import { validateInboxQuery } from '../finance-inbox-query';
import { isClosedFinanceItem } from '../finance-inbox-query';
import { FinanceInboxService } from '../finance-inbox.service';
import * as validate from '../../hr/hr.validation';

@Injectable()
export class FinanceFollowupService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private readonly logger = new Logger(FinanceFollowupService.name);
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(IamFinanceDirectory) private readonly identity: IamFinanceDirectory,
    @Inject(NotificationsService)
    private readonly notifications: NotificationsService,
    @Inject(FinanceInboxService) private readonly inbox: FinanceInboxService,
  ) {}
  onModuleInit() {
    this.timer = setInterval(() => {
      void this.deliverDue().catch(() =>
        this.logger.error(
          'Finance deadline delivery failed; pending reminders will retry.',
        ),
      );
    }, 60000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  private require(actor: AuthenticatedActor, administration = false) {
    if (
      !actor.permissions.includes('finance.read') ||
      (administration && !actor.permissions.includes('finance.account.manage'))
    )
      throw new ForbiddenException('مجوز مدیریت پیگیری مالی لازم است.');
  }
  branches(actor: AuthenticatedActor) {
    this.require(actor);
    return this.identity.branches(actor.branchIds);
  }
  async views(actor: AuthenticatedActor) {
    this.require(actor);
    const rows = await this.database.client.financeSavedView.findMany({
      where: { ownerId: actor.userId },
      orderBy: { createdAt: 'asc' },
    });
    return rows
      .filter((row) => {
        try {
          validateInboxQuery(row.query as FinanceInboxQueryV1, actor);
          return true;
        } catch {
          return false;
        }
      })
      .map((row) => ({ id: row.id, title: row.title, query: row.query }));
  }
  async saveView(body: unknown, actor: AuthenticatedActor) {
    this.require(actor);
    const input = validate.object(body, ['title', 'query']);
    const title = validate.text(input.title, 'نام نمای ذخیره‌شده', 80);
    const allowed = [
      'search',
      'source',
      'status',
      'branchId',
      'person',
      'currencyCode',
      'minAmount',
      'maxAmount',
      'fromDate',
      'toDate',
      'dueFrom',
      'dueTo',
    ];
    const query = validate.object(input.query, allowed) as FinanceInboxQueryV1;
    validateInboxQuery(query, actor);
    return this.database.client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`finance-view:${actor.userId}`}, 0))::text`;
      const existing = await tx.financeSavedView.findUnique({
        where: { ownerId_title: { ownerId: actor.userId, title } },
      });
      if (
        !existing &&
        (await tx.financeSavedView.count({
          where: { ownerId: actor.userId },
        })) >= 20
      )
        throw new BadRequestException('حداکثر ۲۰ نمای شخصی مجاز است.');
      return tx.financeSavedView.upsert({
        where: { ownerId_title: { ownerId: actor.userId, title } },
        create: {
          ownerId: actor.userId,
          title,
          query: JSON.parse(JSON.stringify(query)),
        },
        update: { query: JSON.parse(JSON.stringify(query)) },
      });
    });
  }
  async removeView(id: string, actor: AuthenticatedActor) {
    this.require(actor);
    await this.database.client.financeSavedView.deleteMany({
      where: { id: validate.uuid(id), ownerId: actor.userId },
    });
    return { removed: true };
  }
  async policy(branchId: string, actor: AuthenticatedActor) {
    this.require(actor, true);
    if (!actor.branchIds.includes(branchId))
      throw new ForbiddenException('شعبه خارج از دسترسی است.');
    const [policy, candidates] = await Promise.all([
      this.database.client.financeReminderPolicy.findUnique({
        where: { branchId },
      }),
      this.identity.candidates(branchId),
    ]);
    return {
      policy,
      candidates,
      reminderDaysBefore: 1,
      escalationDaysAfter: 1,
    };
  }
  async setPolicy(body: unknown, actor: AuthenticatedActor) {
    this.require(actor, true);
    const input = validate.object(body, [
      'branchId',
      'managerId',
      'expectedVersion',
    ]);
    const branchId = validate.uuid(input.branchId),
      managerId = validate.uuid(input.managerId);
    const expectedVersion = Number(input.expectedVersion);
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0)
      throw new BadRequestException('نسخه تنظیمات معتبر نیست.');
    if (!actor.branchIds.includes(branchId))
      throw new ForbiddenException('شعبه خارج از دسترسی است.');
    if (!(await this.identity.eligible(managerId, branchId)))
      throw new BadRequestException(
        'مدیر باید کاربر فعال همان شعبه با مجوز مشاهده مالی باشد.',
      );
    try {
      return await this.database.client.$transaction(async (tx) => {
        const current = await tx.financeReminderPolicy.findUnique({
          where: { branchId },
        });
        if ((current?.version ?? 0) !== expectedVersion)
          throw new ConflictException('تنظیمات هم‌زمان تغییر کرده است.');
        if (!current)
          return tx.financeReminderPolicy.create({
            data: { branchId, managerId, updatedById: actor.userId },
          });
        const updated = await tx.financeReminderPolicy.updateMany({
          where: { branchId, version: expectedVersion },
          data: {
            managerId,
            updatedById: actor.userId,
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1)
          throw new ConflictException('تنظیمات هم‌زمان تغییر کرده است.');
        return tx.financeReminderPolicy.findUniqueOrThrow({
          where: { branchId },
        });
      });
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      )
        throw new ConflictException('تنظیمات هم‌زمان تغییر کرده است.');
      throw error;
    }
  }
  async deliverDue(now = new Date()) {
    if (this.running) return;
    this.running = true;
    try {
      const policies =
        await this.database.client.financeReminderPolicy.findMany();
      for (const policy of policies) {
        const principal = await this.identity.reminderPrincipal(
          policy.managerId,
          policy.branchId,
        );
        if (!principal) continue;
        const queue = await this.inbox.list(principal);
        const rows = queue.items
          .filter(
            (item) =>
              item.branchReference === policy.branchId &&
              !isClosedFinanceItem(item) &&
              item.dueAt &&
              Date.parse(item.dueAt) <= now.getTime() + 86400000,
          )
          .map((item) => ({
            sourceKey: `${item.id}:${policy.managerId}:${Date.parse(item.dueAt!)}`,
            id: item.sourceReference,
            requestId: ['PAYROLL_REQUEST', 'OPERATIONAL_REQUEST'].includes(
              item.kind,
            )
              ? item.sourceReference
              : null,
            dueAt: new Date(item.dueAt!),
          }));
        for (const row of rows) {
          const phase =
            now.getTime() >= row.dueAt.getTime() + 86400000
              ? 'ESCALATION'
              : now < row.dueAt
                ? 'REMINDER'
                : null;
          if (!phase) continue;
          if (
            !(await this.identity.eligible(policy.managerId, policy.branchId))
          )
            break;
          await this.database.client.$transaction(async (tx) => {
            const activePolicy = await tx.financeReminderPolicy.findUnique({
              where: { branchId: policy.branchId },
            });
            if (
              !activePolicy ||
              activePolicy.version !== policy.version ||
              activePolicy.managerId !== policy.managerId
            )
              return;
            if (row.requestId) {
              await tx.$queryRaw`SELECT id FROM finance_operational_requests WHERE id = ${row.requestId}::uuid FOR UPDATE`;
            }
            const current = row.requestId
              ? await tx.financeOperationalRequest.findUnique({
                  where: { id: row.requestId },
                  select: { status: true },
                })
              : null;
            if (
              row.requestId &&
              (!current ||
                ['PAID', 'REJECTED', 'CANCELLED'].includes(current.status))
            )
              return;
            const claim = await tx.financeReminderDelivery.createMany({
              data: {
                requestId: row.requestId,
                sourceKey: row.sourceKey,
                phase,
              },
              skipDuplicates: true,
            });
            if (!claim.count) return;
            await this.notifications.createWithinTransaction(tx, {
              recipientUserIds: [policy.managerId],
              actorUserId: null,
              sourceModule: 'finance',
              eventType:
                phase === 'ESCALATION'
                  ? 'finance.request.overdue'
                  : 'finance.request.due-soon',
              title:
                phase === 'ESCALATION'
                  ? 'ارجاع درخواست مالی عقب‌افتاده'
                  : 'یادآوری سررسید درخواست مالی',
              message: 'برای مشاهده جزئیات، کارتابل مالی شعبه را بررسی کنید.',
              entityType: 'finance-request',
              entityId: row.id,
              href: '/finance',
            });
          });
        }
      }
    } finally {
      this.running = false;
    }
  }
}
