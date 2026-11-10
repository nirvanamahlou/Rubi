import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import type { Prisma } from '@nora/database';
import type { DatabaseService } from '../../database/database.service';
import {
  netReceiptAllocations,
  salesSettlementBalances,
} from '../../sales/sales-financial-settlement';
import {
  applySalesReceiptVoid,
  readSalesReceiptForVoid,
} from '../../sales/sales-receipt-void.public';
import { lockReceiptFunds } from '../accounting/receipt-funds.public';

export async function voidSalesReceipt(
  database: DatabaseService,
  actor: AuthenticatedActor,
  companyScope: Prisma.SalesContractWhereInput,
  contractId: string,
  paymentId: string,
  command?: { reason: string; version: number },
) {
  if (
    !actor.permissions.includes('finance.read') ||
    !actor.permissions.includes('finance.receipt.approve')
  )
    throw new ForbiddenException('مجوز تأیید دریافت لازم است.');
  const reason =
    typeof command?.reason === 'string' ? command.reason.trim() : '';
  if (
    command &&
    (reason.length < 3 ||
      reason.length > 500 ||
      !Number.isSafeInteger(command.version))
  )
    throw new BadRequestException('دلیل ابطال را وارد کنید.');
  return database.client.$transaction(
    async (tx) => {
      const read = () =>
        readSalesReceiptForVoid(
          tx,
          contractId,
          paymentId,
          actor.branchIds,
          companyScope,
        );
      let payment = await read();
      if (command) {
        await lockReceiptFunds(tx, paymentId);
        await tx.$queryRaw`SELECT id FROM accounting_books WHERE "branchId"=${payment.contract.branchId}::uuid ORDER BY id FOR SHARE`;
        await tx.$queryRaw`SELECT id FROM sales_contracts WHERE id=${contractId}::uuid FOR UPDATE`;
        payment = await read();
        if (payment.status === 'FINANCE_VOIDED') return { voided: true };
        if (payment.contract.version !== command.version)
          throw new ConflictException(
            'قرارداد هم‌زمان تغییر کرده است. پیش‌نمایش را دوباره باز کنید.',
          );
      }
      if (payment.status !== 'FINANCE_CONFIRMED')
        throw new ConflictException('فقط دریافت تأییدشده قابل ابطال است.');
      const sourceKey = `SALES:${paymentId}`;
      if (command)
        await tx.$queryRaw`SELECT id FROM finance_accounting_events WHERE "sourceKey"=${sourceKey} FOR UPDATE`;
      const event = await tx.financeAccountingEvent.findFirst({
        where: {
          sourceKey,
          branchId: payment.contract.branchId,
          requestId: contractId,
          source: 'SALES',
          kind: 'CUSTOMER_RECEIPT',
        },
        include: {
          _count: { select: { financialWorkflows: true } },
          derivedEvents: { select: { journal: { select: { status: true } } } },
          journal: {
            select: {
              status: true,
              number: true,
              id: true,
              bookId: true,
              reversal: { select: { id: true, status: true } },
            },
          },
        },
      });
      const journal = event?.journal;
      let blocker: string | null = null;
      if (
        Object.values(payment._count).some(Boolean) ||
        !netReceiptAllocations(payment.allocations).isZero() ||
        event?._count.financialWorkflows ||
        event?.derivedEvents.some(
          (derived) => derived.journal?.status !== 'POSTED',
        )
      )
        blocker =
          'ابتدا تخصیص‌ها و استردادهای مرتبط با دریافت را تعیین تکلیف کنید.';
      else if (
        journal?.status === 'POSTED' &&
        journal.reversal?.status !== 'POSTED'
      )
        blocker = 'ابتدا سند معکوس دریافت را در حسابداری ثبت قطعی کنید.';
      else if (
        journal &&
        journal.status !== 'POSTED' &&
        journal.status !== 'CANCELLED'
      )
        blocker = 'ابتدا سند مرتبط با دریافت را در حسابداری لغو کنید.';
      if (command) {
        if (blocker) throw new ConflictException(blocker);
        await applySalesReceiptVoid(tx, payment, actor.userId, reason);
        return { voided: true };
      }
      return {
        version: payment.contract.version,
        amount: payment.amount.toString(),
        currency: payment.currencyCode,
        reference: payment.paymentReference,
        journalNumber: journal?.number ?? null,
        journal: journal
          ? { id: journal.reversal?.id ?? journal.id, bookId: journal.bookId }
          : null,
        blocker,
        balances: await salesSettlementBalances(tx, contractId, paymentId),
      };
    },
    { isolationLevel: 'Serializable' },
  );
}
