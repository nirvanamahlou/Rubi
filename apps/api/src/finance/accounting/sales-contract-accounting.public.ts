import { createHash } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { Prisma } from '@nora/database';
import { salesContractAccountingSource } from '../../sales/accounting-workflow.public';
import { financialDate, recordFinancialEvent } from './financial-event.public';

export const SALES_CONTRACT_EVENT = 'SALES_CONTRACT_CONFIRMED';
type Tx = Prisma.TransactionClient;
type Event = Prisma.FinanceAccountingEventGetPayload<object>;
const eligible = (status: string) =>
  ['CONFIRMED', 'SENT_TO_RESERVATIONS', 'IN_PROGRESS', 'COMPLETED'].includes(
    status,
  );
function signature(party: string, currency: string, amount: string) {
  return createHash('sha256')
    .update(
      JSON.stringify([party, currency, new Prisma.Decimal(amount).toFixed(4)]),
    )
    .digest('hex');
}
function recordId(id: string, version: number, currency: string) {
  const hex = createHash('sha256')
    .update(`${id}:${version}:${currency}`)
    .digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Sales captures only a confirmed contract with a real Finance-approved receipt, in the same transaction. */
export async function captureSalesContractAccounting(
  tx: Tx,
  id: string,
  actorId: string,
  activateAfterApproval = false,
) {
  const row = await salesContractAccountingSource(tx, id);
  if (!row) throw new ConflictException('قرارداد این شعبه یافت نشد.');
  if (!eligible(row.status) || !row.hasFinanceApproval) return;
  if (
    !activateAfterApproval &&
    !(await tx.financeAccountingEvent.findFirst({
      where: {
        source: 'SALES',
        kind: SALES_CONTRACT_EVENT,
        requestId: id,
        branchId: row.branchId,
      },
      select: { id: true },
    }))
  )
    return;
  const balances = row.balances;
  if (balances.some((b) => new Prisma.Decimal(b.amount).isNegative()))
    throw new ConflictException(
      'مبلغ خالص قرارداد برای ثبت حسابداری منفی نیست.',
    );
  for (const balance of balances) {
    if (new Prisma.Decimal(balance.amount).isZero()) continue;
    const sourceRecordId = recordId(row.id, row.version, balance.currencyCode);
    const sourceKey = `SALES:${SALES_CONTRACT_EVENT}:${sourceRecordId}`;
    if (await tx.financeAccountingEvent.findUnique({ where: { sourceKey } }))
      continue;
    // Repeated nonfinancial edits do not accrue the same obligation again.
    const previous = await tx.financeAccountingEvent.findMany({
      where: {
        source: 'SALES',
        kind: SALES_CONTRACT_EVENT,
        requestId: id,
        currency: balance.currencyCode,
      },
      include: {
        journal: { include: { reversal: { select: { status: true } } } },
      },
    });
    const digest = signature(
      row.payerCustomerId,
      balance.currencyCode,
      balance.amount,
    );
    if (
      previous.some(
        (e) =>
          e.reference?.endsWith(`:${digest}`) &&
          (!e.journal ||
            (e.journal.status !== 'CANCELLED' &&
              e.journal.reversal?.status !== 'POSTED')),
      )
    )
      continue;
    const occurredAt = new Date();
    await recordFinancialEvent(tx, {
      source: 'SALES',
      kind: SALES_CONTRACT_EVENT,
      recordId: sourceRecordId,
      requestId: row.id,
      branchId: row.branchId,
      actorId,
      occurredAt,
      amount: balance.amount,
      currency: balance.currencyCode,
      partyId: row.payerCustomerId,
      trackingNumber: row.contractNumber,
      trackingDate: financialDate(occurredAt),
      reference: `SC:${row.version}:${digest}`,
    });
  }
}

/** Pending events may be superseded; a live journal must first be cancelled or reversed. */
export async function assertSalesContractAccountingEditable(
  tx: Tx,
  id: string,
  branchIds: readonly string[],
) {
  const events = await tx.financeAccountingEvent.findMany({
    where: {
      source: 'SALES',
      kind: SALES_CONTRACT_EVENT,
      requestId: id,
      branchId: { in: [...branchIds] },
      journalId: { not: null },
    },
    include: {
      journal: { include: { reversal: { select: { status: true } } } },
    },
  });
  if (
    events.some(
      (e) =>
        e.journal &&
        e.journal.status !== 'CANCELLED' &&
        e.journal.reversal?.status !== 'POSTED',
    )
  )
    throw new ConflictException(
      'پیش از اصلاح یا ابطال قرارداد، پیش‌نویس تعهد را لغو یا سند ثبت‌شده آن را برگشت دهید.',
    );
}

/** Superseded unposted facts remain auditable but cannot create a second obligation. */
export async function isCurrentSalesContractAccountingSource(
  tx: Tx,
  event: Event,
) {
  if (event.kind !== SALES_CONTRACT_EVENT) return true;
  const row = await salesContractAccountingSource(tx, event.requestId);
  if (event.source !== 'SALES' || !row || row.branchId !== event.branchId)
    throw new ConflictException('قرارداد این شعبه یافت نشد.');
  const version = Number(event.reference?.split(':')[1]);
  if (
    !Number.isSafeInteger(version) ||
    version < 1 ||
    event.recordId !== recordId(row.id, version, event.currency)
  )
    throw new ConflictException('نسخه قرارداد تغییر کرده است.');
  const balance = row.balances.find((b) => b.currencyCode === event.currency);
  if (
    !eligible(row.status) ||
    !row.hasFinanceApproval ||
    row.payerCustomerId !== event.partyId ||
    !balance ||
    !event.amount.eq(balance.amount) ||
    !event.reference?.endsWith(
      `:${signature(row.payerCustomerId, event.currency, balance.amount)}`,
    )
  )
    return false;
  const newer = await tx.financeAccountingEvent.findMany({
    where: {
      source: 'SALES',
      kind: SALES_CONTRACT_EVENT,
      requestId: row.id,
      currency: event.currency,
    },
    select: { reference: true },
  });
  return !newer.some((e) => Number(e.reference?.split(':')[1]) > version);
}
/** Rechecked both when generating the draft and before each approval/posting. */
export async function validateSalesContractAccountingSource(
  tx: Tx,
  event: Event,
) {
  if (!(await isCurrentSalesContractAccountingSource(tx, event)))
    throw new ConflictException(
      'مبنای تعهد قرارداد تغییر کرده یا ابطال شده است؛ فقط آخرین رویداد معتبر قابل ثبت است.',
    );
}
export async function hasPendingSalesContractAccounting(
  tx: Tx,
  branchId: string,
  start: string,
  end: string,
) {
  let after: string | null = null;
  for (;;) {
    const events: Event[] = await tx.$queryRaw<
      Event[]
    >`SELECT e.* FROM finance_accounting_events e
      LEFT JOIN accounting_journals j ON j.id=e."journalId"
      WHERE e.kind=${SALES_CONTRACT_EVENT} AND e."branchId"=${branchId}::uuid
      AND (e."journalId" IS NULL OR j.status='CANCELLED')
      AND (${after}::uuid IS NULL OR e.id>${after}::uuid)
      AND (e."occurredAt" AT TIME ZONE 'Asia/Tehran')::date BETWEEN ${start}::date AND ${end}::date
      ORDER BY e.id LIMIT 250`;
    for (const event of events)
      if (await isCurrentSalesContractAccountingSource(tx, event)) return true;
    if (events.length < 250) return false;
    after = events.at(-1)!.id;
  }
}

/** Returns the actual deferred-obligation line to release when revenue is earned. */
export async function salesContractDeferredBasis(
  tx: Tx,
  contractId: string,
  currency: string,
  bookId: string,
) {
  const events = await tx.financeAccountingEvent.findMany({
    where: {
      source: 'SALES',
      kind: SALES_CONTRACT_EVENT,
      requestId: contractId,
      currency,
    },
    include: {
      journal: {
        include: { lines: true, reversal: { select: { status: true } } },
      },
    },
  });
  if (!events.length) return null;
  const live = events.filter(
    (e) =>
      e.journal &&
      e.journal.status !== 'CANCELLED' &&
      e.journal.reversal?.status !== 'POSTED',
  );
  if (
    live.length !== 1 ||
    live[0]!.journal!.status !== 'POSTED' ||
    live[0]!.journal!.bookId !== bookId
  )
    throw new ConflictException(
      'ابتدا سند تعهد قرارداد را در همین دفتر ثبت نهایی کنید.',
    );
  const event = live[0]!;
  await validateSalesContractAccountingSource(tx, event);
  const line = event.journal!.lines.find((l) => l.credit.gt(0));
  if (!line || event.journal!.lines.length !== 2)
    throw new ConflictException(
      'مبنای تعهد قرارداد باید دو قلم معتبر داشته باشد.',
    );
  await validateSalesContractAccounts(
    tx,
    event,
    bookId,
    event.journal!.lines.find((l) => l.debit.gt(0))?.accountId ?? '',
    line.accountId ?? '',
  );
  return { event, line };
}

/** Validate the existing GROUP → GENERAL → SUBSIDIARY chart; never infer codes/titles. */
export async function validateSalesContractAccounts(
  tx: Tx,
  event: Event,
  bookId: string,
  debitId: string,
  creditId: string,
) {
  if (event.kind !== SALES_CONTRACT_EVENT) return;
  for (const [id, nature] of [
    [debitId, 'DEBIT'],
    [creditId, 'CREDIT'],
  ] as const) {
    const account = await tx.accountingAccount.findFirst({
      where: {
        id,
        bookId,
        active: true,
        level: 'SUBSIDIARY',
        permanent: true,
        nature,
      },
    });
    if (
      nature === 'CREDIT' &&
      (account?.attributes as Record<string, unknown> | undefined)
        ?.revaluable === true
    )
      throw new ConflictException(
        'حساب تعهد ارائه خدمت باید غیرقابل تسعیر باشد؛ آزادسازی درآمد بر مبلغ تاریخی انجام می‌شود.',
      );
    const general = account?.parentId
      ? await tx.accountingAccount.findFirst({
          where: {
            id: account.parentId,
            bookId,
            active: true,
            level: 'GENERAL',
            permanent: true,
          },
        })
      : null;
    const group = general?.parentId
      ? await tx.accountingAccount.findFirst({
          where: {
            id: general.parentId,
            bookId,
            active: true,
            level: 'GROUP',
            permanent: true,
          },
        })
      : null;
    if (!group)
      throw new ConflictException(
        'تعهد قرارداد به معین دائمی بدهکار/بستانکار با کل و گروه فعال همین دفتر نیاز دارد.',
      );
  }
}
export async function assertSalesContractJournalReversible(
  tx: Tx,
  journalId: string,
) {
  const event = await tx.financeAccountingEvent.findFirst({
    where: { journalId, kind: SALES_CONTRACT_EVENT },
  });
  if (!event) return;
  const rows = await tx.accountingWorkflow.findMany({
    where: {
      contractId: event.requestId,
      currency: event.currency,
      kind: 'REVENUE',
      cancelled: false,
    },
    include: {
      journal: { include: { reversal: { select: { status: true } } } },
    },
  });
  if (
    rows.some(
      (r) =>
        !r.journal ||
        (r.journal.status !== 'CANCELLED' &&
          r.journal.reversal?.status !== 'POSTED'),
    )
  )
    throw new ConflictException(
      'پیش از برگشت تعهد قرارداد، مبنا و سند درآمد وابسته را لغو یا برگشت دهید.',
    );
}
