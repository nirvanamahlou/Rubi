import { isReceiptAllocation } from './receipt-funds.public';
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { IamFinanceDirectory } from '../../iam/iam-finance-directory';
import { AccountingService } from './accounting.service';
import {
  FINANCIAL_RULE_KIND,
  ruleMatches,
} from './accounting.financial-events';
import * as v from './accounting.validation';

/** Durable, retryable draft creation. Never posts or approves a journal. */
@Injectable()
export class FinancialEventDispatcher implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private readonly logger = new Logger(FinancialEventDispatcher.name);
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(AccountingService) private readonly accounting: AccountingService,
    @Inject(IamFinanceDirectory) private readonly iam: IamFinanceDirectory,
  ) {}
  onModuleInit() {
    this.timer = setInterval(() => {
      void this.tick().catch(() =>
        this.logger.warn(
          'Financial event dispatch failed; durable sources retained.',
        ),
      );
    }, 30_000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const events = await this.database.client.financeAccountingEvent.findMany(
        {
          where: { journalId: null },
          orderBy: [
            { attemptedAt: { sort: 'asc', nulls: 'first' } },
            { id: 'asc' },
          ],
          take: 25,
        },
      );
      for (const event of events) {
        try {
          if (isReceiptAllocation(event.kind)) {
            const basis = event.basisEventId
              ? await this.database.client.financeAccountingEvent.findUnique({
                  where: { id: event.basisEventId },
                  include: { journal: { select: { bookId: true } } },
                })
              : null;
            if (!basis?.journal)
              throw new Error('سند دریافت اصلی تخصیص در دسترس نیست.');
            const actor = await this.iam.reminderPrincipal(
              event.actorId,
              event.branchId,
            );
            if (
              !actor ||
              !actor.permissions.includes('finance.journal.create') ||
              !actor.permissions.includes('finance.receipt.approve')
            )
              throw new Error('دسترسی ثبت‌کننده تخصیص معتبر نیست.');
            await this.accounting.command(
              basis.journal.bookId,
              'financial-event-journal',
              {
                key: `financial-allocation:${event.id}`,
                payload: { eventId: event.id },
              },
              { ...actor, sessionId: 'system:financial-allocation-draft' },
            );
            continue;
          }
          const candidates =
            await this.database.client.accountingConfiguration.findMany({
              where: {
                kind: FINANCIAL_RULE_KIND,
                active: true,
                book: {
                  branchId: event.branchId,
                  active: true,
                  allowsPosting: true,
                },
              },
            });
          const rules = candidates.filter((rule) =>
            ruleMatches(rule.attributes, event),
          );
          if (rules.length !== 1)
            throw new Error(
              rules.length
                ? 'چند قاعده منطبق وجود دارد؛ حسابدار باید یک قاعده را انتخاب کند.'
                : 'قاعده مصوب برای این رویداد تنظیم نشده است.',
            );
          const rule = rules[0]!;
          const actor = await this.iam.reminderPrincipal(
            String(v.attributes(rule.attributes).creatorId),
            event.branchId,
          );
          if (
            !actor ||
            !actor.permissions.includes('finance.journal.create') ||
            !actor.permissions.includes('finance.account.manage')
          )
            throw new Error('دسترسی تنظیم‌کننده قاعده معتبر نیست.');
          await this.accounting.command(
            rule.bookId,
            'financial-event-journal',
            {
              key: `financial-event:${event.id}:${rule.id}`,
              payload: { eventId: event.id, ruleId: rule.id },
            },
            { ...actor, sessionId: 'system:financial-event-draft' },
          );
        } catch (error) {
          await this.database.client.financeAccountingEvent.updateMany({
            where: { id: event.id, journalId: null },
            data: {
              attemptedAt: new Date(),
              lastError:
                error instanceof Error && !('code' in error)
                  ? error.message.slice(0, 1000)
                  : 'ثبت سند انجام نشد؛ تنظیمات و وضعیت رویداد بررسی شود.',
            },
          });
        }
      }
    } finally {
      this.running = false;
    }
  }
}
