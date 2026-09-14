import { createHash } from 'node:crypto';
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleInit,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@nora/database';
import { NotificationsService } from '../notifications/notifications.service';
import { CustomerAffairsRepository } from './customer-affairs.repository';

/** Durable command keys prevent duplicate delivery across restarts/API replicas. */
@Injectable()
export class CustomerAffairsRemindersService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(CustomerAffairsRemindersService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private stopped = false;
  private cursors: Partial<Record<'lead' | 'ticket', string>> = {};
  constructor(
    @Inject(CustomerAffairsRepository)
    private readonly repository: CustomerAffairsRepository,
    @Inject(NotificationsService)
    private readonly notifications: NotificationsService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}
  onModuleInit() {
    if (
      this.config.get<string>('CUSTOMER_AFFAIRS_REMINDERS_ENABLED') !== 'true'
    )
      return;
    this.timer = setInterval(() => {
      void this.tick();
    }, 60_000);
    this.timer.unref();
  }
  onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
  }
  async tick(now = new Date()) {
    if (this.running || this.stopped) return;
    this.running = true;
    try {
      for (const kind of ['lead', 'ticket'] as const) {
        const rows = await this.repository.dueReminderIds(
          kind,
          now,
          this.cursors[kind],
        );
        for (const row of rows) {
          if (this.stopped) return;
          await this.deliver(kind, row.id, now);
          this.cursors[kind] = row.id;
        }
        if (rows.length < 100) delete this.cursors[kind];
      }
    } catch {
      // No payload/PII or database error details in application logs. Retry next tick.
      this.logger.error('Customer Affairs reminder batch failed; will retry.');
    } finally {
      this.running = false;
    }
  }
  async deliver(kind: 'lead' | 'ticket', id: string, now: Date) {
    await this.repository.transaction(async (tx) => {
      // Lock only CA-owned rows. Concurrent reassignment/closure cannot race delivery.
      const table =
        kind === 'lead'
          ? Prisma.sql`customer_affairs_leads`
          : Prisma.sql`customer_affairs_tickets`;
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM ${table} WHERE id = ${id}::uuid FOR UPDATE`,
      );
      const lead =
        kind === 'lead'
          ? await tx.customerAffairsLead.findUnique({ where: { id } })
          : null;
      const ticket =
        kind === 'ticket'
          ? await tx.customerAffairsTicket.findUnique({ where: { id } })
          : null;
      const row = lead ?? ticket;
      if (
        !row ||
        (lead && ['LOST', 'HANDED_OFF'].includes(lead.stage)) ||
        (ticket && ['CLOSED', 'CANCELLED', 'RESOLVED'].includes(ticket.status))
      )
        return;
      const recipient = lead
        ? (lead.assigneeUserId ?? lead.createdByUserId)
        : ticket!.customerOwnerUserId;
      const events: Array<{ type: string; due: Date; title: string }> = [];
      if (row.nextActionAt <= now)
        events.push({
          type: 'followup.due',
          due: row.nextActionAt,
          title: 'موعد پیگیری مشتری رسیده است',
        });
      if (ticket) {
        if (!ticket.firstRespondedAt && ticket.firstResponseDueAt <= now)
          events.push({
            type: 'sla.first-response',
            due: ticket.firstResponseDueAt,
            title: 'مهلت اولین پاسخ گذشته است',
          });
        if (
          !ticket.pausedAt &&
          !ticket.resolvedAt &&
          ticket.resolutionDueAt <= now
        )
          events.push({
            type: 'sla.resolution',
            due: ticket.resolutionDueAt,
            title: 'مهلت حل تیکت گذشته است',
          });
      }
      for (const event of events) {
        const key = createHash('sha256')
          .update(
            `${kind}:${id}:${event.type}:${event.due.toISOString()}:${recipient}`,
          )
          .digest('hex');
        const scope = 'automation.reminder.v1';
        const claim = await tx.customerAffairsCommand.createMany({
          data: [
            {
              actorUserId: row.createdByUserId,
              scope,
              idempotencyKey: key,
              requestFingerprint: key,
              resultEntityId: id,
            },
          ],
          skipDuplicates: true,
        });
        if (!claim.count) continue;
        await this.notifications.createWithinTransaction(tx, {
          recipientUserIds: [
            recipient,
            ...(ticket?.executionOwnerUserId && event.type.startsWith('sla.')
              ? [ticket.executionOwnerUserId]
              : []),
          ],
          actorUserId: null,
          sourceModule: 'customer-affairs',
          eventType: event.type,
          title: event.title,
          message: `${row.trackingNumber}: پرونده را بررسی کنید.`,
          entityType: `customer-affairs-${kind}`,
          entityId: id,
          href: `/customer-affairs?view=${kind === 'lead' ? 'leads' : 'tickets'}&${kind}=${id}`,
        });
        if (
          ticket &&
          event.type === 'sla.first-response' &&
          !ticket.firstResponseBreachedAt
        )
          await tx.customerAffairsTicket.update({
            where: { id },
            data: { firstResponseBreachedAt: event.due },
          });
        if (
          ticket &&
          event.type === 'sla.resolution' &&
          !ticket.resolutionBreachedAt
        )
          await tx.customerAffairsTicket.update({
            where: { id },
            data: { resolutionBreachedAt: event.due },
          });
        await tx.customerAffairsAuditEvent.create({
          data: {
            branchId: row.branchId,
            actorUserId: null,
            entityType: kind === 'lead' ? 'LEAD' : 'TICKET',
            entityId: id,
            action: event.type,
            version: row.version,
            afterSnapshot: {
              dueAt: event.due.toISOString(),
              recipientUserId: recipient,
            },
          },
        });
      }
    });
  }
}
