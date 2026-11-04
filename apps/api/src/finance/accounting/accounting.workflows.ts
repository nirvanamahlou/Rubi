import {
  assertSalesContractAccountingEditable,
  salesContractDeferredBasis,
} from './sales-contract-accounting.public';
import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import { Prisma } from '@nora/database';
import {
  revenueSource,
  revenueSources,
} from '../../sales/accounting-workflow.public';
import {
  netPayrollIdentity,
  payrollSource,
  payrollSources,
} from '../../hr/accounting-payroll.public';
import { recordFinancialEvent } from './financial-event.public';
import { financialDate } from './accounting.financial-events';
import {
  Exact,
  decimal,
  revenueAmounts,
  settlementPortion,
} from './accounting.workflow-math';
import * as v from './accounting.validation';

type Tx = Prisma.TransactionClient;
type Book = Prisma.AccountingBookGetPayload<object>;
type Event = Prisma.FinanceAccountingEventGetPayload<object>;
type Entry = Prisma.AccountingWorkflowGetPayload<object>;
type Journal = Prisma.AccountingJournalGetPayload<{ include: { lines: true } }>;
type Facts = Record<string, unknown>;
const kinds = [
  'REVENUE',
  'PAYROLL',
  'PURCHASE_OUTCOME',
  'SUPPLIER_REFUND',
  'PURCHASE_WRITE_OFF',
  'FX_SETTLEMENT',
];
const payKinds = ['TICKET_PAYMENT', 'RESERVATION_PAYMENT', 'SUPPLIER_PAYMENT'];
const json = (x: unknown) =>
  JSON.parse(JSON.stringify(x)) as Prisma.InputJsonValue;
const facts = (r: Entry) => r.facts as Facts;
function fail(s: string): never {
  throw new ConflictException(s);
}
const positive = (x: unknown) => {
  const n = decimal(x);
  if (!n.gt(0)) fail('مبلغ باید مثبت باشد.');
  return n;
};
const sameDetails = (
  a: {
    accountId: string | null;
    detail4Id: string | null;
    detail5Id: string | null;
    detail6Id: string | null;
  },
  b: typeof a,
) =>
  ['accountId', 'detail4Id', 'detail5Id', 'detail6Id'].every(
    (k) => a[k as keyof typeof a] === b[k as keyof typeof a],
  );

async function sourceEvent(tx: Tx, book: Book, id: string) {
  const event = await tx.financeAccountingEvent.findFirst({
    where: { id, branchId: book.branchId, kind: { in: payKinds } },
  });
  if (!event)
    throw new NotFoundException(
      'پرداخت واقعی تأییدشده در شعبه این دفتر یافت نشد.',
    );
  return event;
}
async function posted(
  tx: Tx,
  book: Book,
  event: Event,
  allowReversed = false,
): Promise<Journal> {
  const j = event.journalId
    ? await tx.accountingJournal.findFirst({
        where: { id: event.journalId, bookId: book.id, status: 'POSTED' },
        include: { lines: true },
      })
    : null;
  if (
    !j ||
    (!allowReversed &&
      (await tx.accountingJournal.findFirst({
        where: { reversalOfId: j.id, status: 'POSTED' },
      })))
  )
    fail(
      'ابتدا سند اصلی را در همین دفتر ثبت نهایی و تطبیق کنید؛ سند برگشت‌خورده مبنا نیست.',
    );
  return j;
}
async function payable(tx: Tx, book: Book, e: Event, allowReversed = false) {
  let recordId: string | undefined;
  if (e.source === 'TICKET')
    recordId = (
      await tx.financeTicketPurchasePaymentRevision.findUnique({
        where: { id: e.recordId },
        select: { costRevisionId: true },
      })
    )?.costRevisionId;
  if (e.source === 'RESERVATIONS')
    recordId = (
      await tx.financeSupplierPaymentRevision.findUnique({
        where: { id: e.recordId },
        select: { purchaseId: true },
      })
    )?.purchaseId;
  const options = await tx.financeAccountingEvent.findMany({
    where: {
      source: e.source,
      requestId: e.requestId,
      branchId: e.branchId,
      currency: e.currency,
      kind: {
        in: [
          'TICKET_PAYABLE',
          'RESERVATION_PAYABLE',
          'SUPPLIER_INVOICE_APPROVED',
        ],
      },
      ...(recordId ? { recordId } : {}),
    },
  });
  if (options.length !== 1)
    fail(
      'تعهد خرید یکتای همین نسخه در دسترس نیست؛ ابتدا مبنای خرید را تطبیق کنید.',
    );
  const event = options[0]!,
    journal = await posted(tx, book, event, allowReversed);
  if (journal.lines.length !== 2)
    fail('تعهد مرکب باید پیش از تسویه تفکیک و تطبیق شود.');
  const liability = journal.lines.find((l) => l.credit.gt(0)),
    cost = journal.lines.find((l) => l.debit.gt(0));
  if (!liability || !cost) fail('ساختار تعهد خرید معتبر نیست.');
  return { event, journal, liability, cost };
}
async function active(tx: Tx, where: Prisma.AccountingWorkflowWhereInput) {
  const rows = await tx.accountingWorkflow.findMany({
    where: { ...where, cancelled: false },
    include: {
      journal: {
        select: { status: true, reversalOfId: true, attributes: true },
      },
    },
  });
  const reversed = await tx.accountingJournal.findMany({
    where: {
      reversalOfId: {
        in: rows.flatMap((r) => (r.journalId ? [r.journalId] : [])),
      },
      status: 'POSTED',
    },
    select: { reversalOfId: true },
  });
  const ids = new Set(reversed.map((r) => r.reversalOfId));
  return rows.filter((r) => !r.journalId || !ids.has(r.journalId));
}
async function consumed(tx: Tx, sourceEventId: string) {
  const rows = await active(tx, {
    sourceEventId,
    kind: { in: ['SUPPLIER_REFUND', 'PURCHASE_WRITE_OFF'] },
  });
  return rows.reduce((n, r) => n.add(r.amount.toString()), new Exact(0));
}
async function latestOutcome(tx: Tx, e: Event) {
  const rows = await tx.accountingWorkflow.findMany({
    where: { sourceEventId: e.id, kind: 'PURCHASE_OUTCOME', cancelled: false },
    include: { journal: { select: { status: true } } },
  });
  return rows.sort(
    (a, b) =>
      Number(facts(b).outcomeSequence ?? 0) -
        Number(facts(a).outcomeSequence ?? 0) ||
      b.createdAt.getTime() - a.createdAt.getTime() ||
      b.id.localeCompare(a.id),
  )[0];
}
async function outcome(tx: Tx, e: Event) {
  const row = await latestOutcome(tx, e);
  return row ? String(facts(row).state) : null;
}

/** Actual ledger carrying value, not the optional comparative FX quote shown in the inbox. */
async function fxBasis(tx: Tx, book: Book, e: Event) {
  if (e.currency === book.baseCurrency)
    fail('پرداخت هم‌ارز دفتر به تسویه ارزی نیاز ندارد.');
  const pj = await posted(tx, book, e),
    basis = await payable(tx, book, e, true);
  const cash = pj.lines.filter((l) => l.credit.gt(0)),
    debit = pj.lines.filter((l) => l.debit.gt(0));
  if (
    pj.lines.some(
      (l) => l.currency !== e.currency || !l.foreignAmount?.eq(e.amount),
    ) ||
    pj.lines.length !== 2 ||
    cash.length !== 1 ||
    debit.length !== 1 ||
    !sameDetails(debit[0]!, basis.liability)
  )
    fail(
      'حساب بدهی سند پرداخت و تعهد باید با تفصیلی‌های یکسان تطبیق داشته باشند.',
    );
  const payments = await tx.financeAccountingEvent.findMany({
    where: {
      source: e.source,
      requestId: e.requestId,
      branchId: e.branchId,
      currency: e.currency,
      kind: e.kind,
    },
    orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
  });
  const versionPayments =
    e.source === 'TICKET'
      ? await tx.financeTicketPurchasePaymentRevision.findMany({
          where: {
            id: { in: payments.map((x) => x.recordId) },
            costRevisionId: (
              await tx.financeTicketPurchasePaymentRevision.findUniqueOrThrow({
                where: { id: e.recordId },
              })
            ).costRevisionId,
          },
          select: { id: true },
        })
      : null;
  const scopedPayments = versionPayments
    ? payments.filter((x) => versionPayments.some((v) => v.id === x.recordId))
    : payments;
  const index = scopedPayments.findIndex((p) => p.id === e.id),
    older = scopedPayments.slice(0, index);
  const settlements = await active(tx, {
    bookId: book.id,
    kind: 'FX_SETTLEMENT',
    sourceEventId: { in: older.map((p) => p.id) },
  });
  if (
    older.length !== settlements.length ||
    settlements.some((r) => r.amount.gt(0) && r.journal?.status !== 'POSTED')
  )
    fail('ابتدا تسویه ارزی پرداخت‌های قدیمی‌تر همین خرید را ثبت نهایی کنید.');
  let foreign = new Exact(0),
    carrying = new Exact(0);
  for (const r of settlements) {
    foreign = foreign.add(String(facts(r).foreignAmount));
    carrying = carrying.add(String(facts(r).carrying));
  }
  if (
    basis.liability.currency !== e.currency ||
    !basis.liability.foreignAmount?.eq(basis.event.amount)
  )
    fail('مبلغ ارزی تعهد با منبع عملیاتی یکسان نیست.');
  const tracking = String(
    (basis.liability.attributes as Facts).trackingNumber ?? e.requestId,
  );
  const allValuations = await tx.accountingJournalLine.findMany({
    where: {
      accountId: basis.liability.accountId,
      detail4Id: basis.liability.detail4Id,
      detail5Id: basis.liability.detail5Id,
      detail6Id: basis.liability.detail6Id,
      OR: [
        { currency: e.currency },
        { attributes: { path: ['valuationCurrency'], equals: e.currency } },
      ],
      journal: {
        bookId: book.id,
        status: 'POSTED',
        reversal: { is: null },
        sourceKey: { startsWith: 'REVALUE:' },
      },
    },
    select: { attributes: true },
  });
  if (allValuations.some((l) => !(l.attributes as Facts).trackingNumber))
    fail('تسعیر تجمیعی فاقد تفکیک منبع باید پیش از تسویه تطبیق شود.');
  const revaluations = await tx.accountingJournalLine.findMany({
    where: {
      accountId: basis.liability.accountId,
      detail4Id: basis.liability.detail4Id,
      detail5Id: basis.liability.detail5Id,
      detail6Id: basis.liability.detail6Id,
      attributes: { path: ['trackingNumber'], equals: tracking },
      AND: [
        {
          OR: [
            { currency: e.currency },
            { attributes: { path: ['valuationCurrency'], equals: e.currency } },
          ],
        },
      ],
      journal: {
        bookId: book.id,
        status: 'POSTED',
        reversal: { is: null },
        sourceKey: { startsWith: 'REVALUE:' },
      },
    },
    include: { journal: { select: { documentDate: true } } },
  });
  const date = financialDate(e.occurredAt);
  if (
    revaluations.some(
      (r) => !r.journal.documentDate || r.journal.documentDate >= date,
    )
  )
    fail(
      'ابتدا ترتیب تسویه و تسعیر این منبع را اصلاح کنید؛ تسعیر هم‌روز یا پس از پرداخت مبنای خودکار نیست.',
    );
  let original = new Exact(basis.liability.credit.toString());
  for (const r of revaluations)
    original = original.add(r.credit.toString()).sub(r.debit.toString());
  const portion = settlementPortion(
    basis.event.amount.toString(),
    original.toString(),
    foreign.toString(),
    carrying.toString(),
    e.amount.toString(),
    book.baseCurrency === 'IRR' ? 0 : 2,
  );
  const actual = new Exact(cash[0]!.credit.toString()),
    difference = actual.sub(portion);
  return {
    basisEventId: basis.event.id,
    liabilityLineId: basis.liability.id,
    foreignAmount: e.amount.toString(),
    foreignCurrency: e.currency,
    carrying: portion.toString(),
    actual: actual.toString(),
    difference: difference.toString(),
    paymentJournalId: pj.id,
    revaluationLineIds: revaluations.map((r) => r.id),
    priorSettlementIds: settlements.map((r) => r.id),
  };
}

export async function workflowSources(tx: Tx, book: Book, search: string) {
  const [contracts, payroll, payments] = await Promise.all([
    revenueSources(tx, book.branchId, search),
    payrollSources(tx, book.branchId, search),
    tx.financeAccountingEvent.findMany({
      where: {
        branchId: book.branchId,
        kind: { in: payKinds },
        ...(search
          ? {
              OR: [
                { reference: { contains: search, mode: 'insensitive' } },
                { trackingNumber: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        kind: true,
        amount: true,
        currency: true,
        reference: true,
        trackingNumber: true,
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'asc' }],
      take: 101,
    }),
  ]);
  return {
    contracts: contracts
      .slice(0, 100)
      .map((r) => ({ id: r.id, version: r.version, label: r.contractNumber })),
    payroll: {
      net: payroll.net.slice(0, 100),
      gross: payroll.gross.slice(0, 100),
    },
    payments: payments.slice(0, 100).map((r) => ({
      id: r.id,
      label: `${r.reference ?? r.trackingNumber ?? r.kind} · ${r.amount} ${r.currency}`,
    })),
    truncated:
      contracts.length > 100 ||
      payments.length > 100 ||
      payroll.net.length > 100 ||
      payroll.gross.length > 100,
  };
}
export async function workflowList(tx: Tx, book: Book) {
  const rows = await tx.accountingWorkflow.findMany({
    where: { bookId: book.id },
    include: { journal: { select: { id: true, status: true, version: true } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 101,
  });
  return {
    items: rows.slice(0, 100).map((r) => ({
      ...r,
      amount: r.amount.toString(),
      occurredAt: r.occurredAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
    })),
    truncated: rows.length > 100,
  };
}

export async function captureWorkflow(
  tx: Tx,
  book: Book,
  p: Facts,
  actor: AuthenticatedActor,
) {
  if (!book.active || !book.allowsPosting) fail('دفتر اجازه ثبت سند ندارد.');
  const kind = v.text(p.kind, 32, true);
  if (!kinds.includes(kind)) fail('نوع فرایند معتبر نیست.');
  const sourceId = v.uuid(p.sourceId)!,
    reference = v.text(p.reference, 160, true),
    reason = v.text(p.reason, 2000, true);
  if (reason.length < 10)
    fail('مبنای تصمیم و مستند عملیات را حداقل ده حرف بنویسید.');
  const date = v.date(p.date)!,
    occurredAt = new Date(`${date}T00:00:00Z`);
  if (date > financialDate(new Date())) fail('عملیات آینده تأیید نمی‌شود.');
  let currency = '',
    amount = '0',
    data: Facts = { reason },
    key = '',
    contractId: string | null = null,
    hrRecordId: string | null = null,
    grossRecordId: string | null = null,
    sourceEventId: string | null = null;
  if (kind === 'REVENUE') {
    const s = await revenueSource(tx, sourceId, book.branchId);
    if (s.version !== p.sourceVersion) fail('نسخه قرارداد تغییر کرده است.');
    if (p.fulfilled !== true)
      fail(
        'ایفای تعهد باید بر اساس مستند واقعی تأیید شود؛ دریافت پول درآمد نیست.',
      );
    if (date < financialDate(new Date(s.createdAt)))
      fail('تاریخ درآمد پیش از قرارداد مجاز نیست.');
    currency = v.text(p.currency, 3, true);
    const mode = v.text(p.mode, 12, true),
      a = revenueAmounts(s.components, currency, mode, p.amount);
    if (
      (
        await active(tx, {
          branchId: book.branchId,
          kind,
          contractId: s.id,
          currency,
        })
      ).length
    )
      fail(
        'برای این قرارداد و ارز درآمد فعال ثبت شده است؛ ابتدا اصلاح یا برگشت را نهایی کنید.',
      );
    contractId = s.id;
    amount = a.gross;
    key = `REVENUE:${s.id}:${s.version}:${currency}`;
    data = { ...data, source: s, mode, ...a };
  } else if (kind === 'PAYROLL') {
    grossRecordId = v.uuid(p.grossRecordId)!;
    if (p.periodConfirmed !== true)
      fail('انطباق دوره فیش واردشده و درخواست حقوق را تأیید کنید.');
    const s = await payrollSource(tx, sourceId, grossRecordId, book.branchId);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(s.period) || date < `${s.period}-01`)
      fail('تاریخ تعهد حقوق نباید پیش از دوره مصوب باشد.');
    if (s.version !== p.sourceVersion)
      fail('نسخه درخواست حقوق تغییر کرده است.');
    key = `PAYROLL:${book.branchId}:${s.employeeId}:${s.period}:${s.currency}`;
    if (
      (
        await active(tx, {
          branchId: book.branchId,
          kind,
          currency: s.currency,
          facts: { path: ['employeeId'], equals: s.employeeId },
        })
      ).some((r) => facts(r).period === s.period)
    )
      fail('حقوق ناخالص همین کارمند و دوره قبلاً ثبت شده است.');
    const req = await tx.financeOperationalRequest.findMany({
      where: {
        branchId: book.branchId,
        kind: 'PAYROLL',
        hrRecordId: { in: s.netRecordIds },
      },
      select: { id: true },
    });
    const prior = await tx.financeAccountingEvent.findMany({
      where: {
        branchId: book.branchId,
        kind: 'PAYROLL_NET_APPROVED',
        requestId: { in: req.map((r) => r.id) },
      },
    });
    for (const e of prior) await posted(tx, book, e);
    const net = prior.reduce(
      (n, r) => n.add(r.amount.toString()),
      new Exact(0),
    );
    if (!net.eq(0) && !net.eq(s.net))
      fail('تعهدهای خالص قبلی این دوره باید پیش از ثبت ناخالص تطبیق شوند.');
    currency = s.currency;
    amount = s.gross;
    hrRecordId = s.id;
    data = {
      ...data,
      ...s,
      netAlreadyAccrued: net.gt(0),
      netEventIds: prior.map((r) => r.id),
    };
  } else {
    await tx.$queryRaw`SELECT id FROM finance_accounting_events WHERE id=${sourceId}::uuid FOR UPDATE`;
    const e = await sourceEvent(tx, book, sourceId);
    await posted(tx, book, e);
    sourceEventId = e.id;
    currency = e.currency;
    if (date < financialDate(e.occurredAt))
      fail('تاریخ عملیات پیش از پرداخت اصلی مجاز نیست.');
    if (kind === 'FX_SETTLEMENT') {
      if ((await active(tx, { sourceEventId: e.id, kind })).length)
        fail('مبنای فعال تسویه ارزی وجود دارد.');
      const fx = await fxBasis(tx, book, e);
      currency = book.baseCurrency;
      amount = new Exact(fx.difference).abs().toString();
      key = `FX:${e.id}`;
      data = { ...data, ...fx };
    } else if (kind === 'PURCHASE_OUTCOME') {
      const state = v.text(p.state, 16, true);
      if (!['INQUIRY', 'FAILED', 'SUCCESS'].includes(state))
        fail('نتیجه خرید معتبر نیست.');
      if ((await consumed(tx, e.id)).gt(0) && state !== 'FAILED')
        fail('خرید دارای استرداد یا زیان قطعی دوباره موفق اعلام نمی‌شود.');
      const previous = await latestOutcome(tx, e);
      if (previous && facts(previous).state === state)
        fail('این وضعیت قبلاً ثبت شده است.');
      if (previous?.journal?.status === 'POSTED' && state !== 'FAILED')
        fail(
          'پیش از تغییر نتیجه، برگشت حسابداری لغو خرید را تعیین تکلیف کنید.',
        );
      key = `OUTCOME:${e.id}:${randomUUID()}`;
      amount = e.amount.toString();
      data = {
        ...data,
        state,
        outcomeSequence:
          (await tx.accountingWorkflow.count({
            where: { sourceEventId: e.id, kind },
          })) + 1,
      };
    } else {
      if ((await outcome(tx, e)) !== 'FAILED')
        fail('ابتدا شکست قطعی خرید و مستند تأمین‌کننده را ثبت کنید.');
      const n = positive(p.amount),
        used = await consumed(tx, e.id);
      if (n.add(used).gt(e.amount.toString()))
        fail('استرداد و زیان قطعی از پرداخت واقعی بیشتر است.');
      if (kind === 'SUPPLIER_REFUND') {
        if (!actor.permissions.includes('finance.receipt.approve'))
          throw new ForbiddenException('مجوز تأیید دستی وصول وجه لازم است.');
        const accountId = v.uuid(p.receiptAccountId)!;
        const account = await tx.financeSettlementAccount.findFirst({
          where: {
            id: accountId,
            branchId: book.branchId,
            currencyCode: currency,
            isActive: true,
          },
          select: { id: true, title: true },
        });
        if (!account)
          fail('حساب واقعی فعال دریافت با شعبه و ارز یکسان لازم است.');
        data = {
          ...data,
          receiptAccountId: account.id,
          receiptAccountTitle: account.title,
        };
      }
      amount = n.toString();
      key = `${kind}:${e.id}:${reference}`;
    }
    data = {
      ...data,
      paymentId: e.id,
      requestId: e.requestId,
      source: e.source,
      sourceCurrency: e.currency,
      sourceAmount: e.amount.toString(),
      trackingNumber: e.trackingNumber ?? e.requestId,
      trackingDate: e.trackingDate ?? financialDate(e.occurredAt),
    };
  }
  if (['REVENUE', 'PAYROLL', 'FX_SETTLEMENT'].includes(kind))
    key += `:${randomUUID()}`;
  const old = await tx.accountingWorkflow.findUnique({
    where: { businessKey: key },
  });
  if (old)
    fail('این منبع قبلاً ثبت شده است؛ نتیجه قبلی را از فهرست پیگیری کنید.');
  return tx.accountingWorkflow.create({
    data: {
      bookId: book.id,
      branchId: book.branchId,
      actorId: actor.userId,
      kind,
      businessKey: key,
      contractId,
      hrRecordId,
      grossRecordId,
      receiptAccountId:
        kind === 'SUPPLIER_REFUND' ? String(data.receiptAccountId) : null,
      sourceEventId,
      amount,
      currency,
      occurredAt,
      reference,
      facts: json(data),
    },
  });
}

type Line = Record<string, unknown>;
const carryLine = (
  l: Journal['lines'][number],
  debit: string,
  credit: string,
  foreign?: string,
): Line => ({
  accountId: l.accountId,
  detail4Id: l.detail4Id,
  detail5Id: l.detail5Id,
  detail6Id: l.detail6Id,
  debit,
  credit,
  currency: l.currency,
  foreignAmount: foreign ?? l.foreignAmount?.toString(),
  rate: l.rate?.toString(),
  fxSnapshotId: l.fxSnapshotId,
  attributes: l.attributes,
});
function roleLine(p: Facts, role: string, debit: string, credit: string): Line {
  return {
    accountId: v.uuid(p[`${role}AccountId`])!,
    ...Object.fromEntries(
      [4, 5, 6].map((n) => [
        `detail${n}Id`,
        v.uuid(p[`${role}Detail${n}Id`], true),
      ]),
    ),
    debit,
    credit,
  };
}

export async function workflowJournal(
  tx: Tx,
  book: Book,
  p: Facts,
  actor: AuthenticatedActor,
  create: (p: Facts) => Promise<{ id: string }>,
) {
  const id = v.uuid(p.id)!,
    r = await tx.accountingWorkflow.findFirst({
      where: { id, bookId: book.id, cancelled: false },
    });
  if (!r) throw new NotFoundException();
  if (r.journalId)
    return tx.accountingJournal.findUniqueOrThrow({
      where: { id: r.journalId },
      include: { lines: true },
    });
  const f = facts(r),
    date = v.date(p.documentDate, true) ?? financialDate(r.occurredAt),
    reason = v.text(p.latePostingReason, 500);
  if (
    date < financialDate(r.occurredAt) ||
    (date !== financialDate(r.occurredAt) && reason.length < 10)
  )
    fail('تاریخ ثبت قبل از عملیات نیست و تأخیر به دلیل مستند نیاز دارد.');
  const scale = book.baseCurrency === 'IRR' ? 0 : 2;
  let lines: Line[] = [],
    carryingForJournal: string | undefined,
    reversalOfId: string | undefined,
    ratio = new Exact(1),
    fx: Prisma.AccountingFxSnapshotGetPayload<object> | null = null;
  const contractBasis =
    r.kind === 'REVENUE'
      ? await salesContractDeferredBasis(tx, r.contractId!, r.currency, book.id)
      : null;
  if (
    r.currency !== book.baseCurrency &&
    ['REVENUE', 'PAYROLL', 'SUPPLIER_REFUND'].includes(r.kind)
  ) {
    const options = await tx.accountingFxSnapshot.findMany({
      where: {
        bookId: book.id,
        currency: r.currency,
        status: 'APPROVED',
        validFrom: { lte: contractBasis?.event.occurredAt ?? r.occurredAt },
        validTo: { gte: contractBasis?.event.occurredAt ?? r.occurredAt },
        ...(contractBasis?.line.fxSnapshotId
          ? { id: contractBasis.line.fxSnapshotId }
          : {}),
        ...(!contractBasis && p.fxSnapshotId
          ? { id: v.uuid(p.fxSnapshotId)! }
          : {}),
      },
    });
    if (options.length !== 1)
      fail('نرخ مستقل مصوب یکتای زمان عملیات لازم است.');
    fx = options[0]!;
    ratio = new Exact(fx.rate.toString());
  }
  const base = (n: string) =>
    new Exact(n)
      .mul(ratio)
      .toDecimalPlaces(
        scale,
        book.baseCurrency === 'IRR'
          ? Prisma.Decimal.ROUND_HALF_UP
          : Prisma.Decimal.ROUND_HALF_EVEN,
      )
      .toString();
  const component = (role: string, n: string, side: 'debit' | 'credit') => {
    if (new Exact(n).isZero()) return;
    const l = roleLine(
      p,
      role,
      side === 'debit' ? base(n) : '0',
      side === 'credit' ? base(n) : '0',
    );
    if (fx)
      Object.assign(l, {
        currency: r.currency,
        foreignAmount: n,
        rate: fx.rate.toString(),
        fxSnapshotId: fx.id,
      });
    lines.push(l);
  };
  if (r.kind === 'REVENUE') {
    const current = await revenueSource(tx, r.contractId!, book.branchId);
    if (
      JSON.stringify(current.components) !==
      JSON.stringify((f.source as Facts).components)
    )
      fail('قرارداد پس از ثبت مبنا تغییر کرده است؛ مبنای جدید ثبت کنید.');
    if (contractBasis) {
      if (r.amount.gt(contractBasis.event.amount))
        fail('درآمد از تعهد قرارداد بیشتر نیست.');
      const carrying = new Exact(contractBasis.line.credit.toString())
        .mul(r.amount.toString())
        .div(contractBasis.event.amount.toString())
        .toDecimalPlaces(scale, Prisma.Decimal.ROUND_HALF_UP)
        .toString();
      lines.push(
        carryLine(
          contractBasis.line,
          carrying,
          '0',
          r.currency === book.baseCurrency ? undefined : r.amount.toString(),
        ),
      );
    } else component('receivable', r.amount.toString(), 'debit');
    component('income', String(f.earned), 'credit');
    component('tax', String(f.tax), 'credit');
  } else if (r.kind === 'PAYROLL') {
    const current = await payrollSource(
      tx,
      r.hrRecordId!,
      r.grossRecordId!,
      book.branchId,
    );
    if (
      current.version !== f.version ||
      current.gross !== f.gross ||
      current.deductions !== f.deductions ||
      current.net !== f.net
    )
      fail('مبنای حقوق تغییر کرده است.');
    if (f.netAlreadyAccrued) {
      component('expense', String(f.deductions), 'debit');
      component('deductions', String(f.deductions), 'credit');
    } else {
      component('expense', String(f.gross), 'debit');
      component('payable', String(f.net), 'credit');
      component('deductions', String(f.deductions), 'credit');
    }
  } else {
    const e = await sourceEvent(tx, book, r.sourceEventId!);
    if (r.kind === 'PURCHASE_OUTCOME') {
      if (f.state !== 'FAILED')
        fail('استعلام و موفقیت خرید سند پولی تازه ایجاد نمی‌کنند.');
      const b = await payable(tx, book, e, true);
      const reversal = await tx.accountingJournal.findUnique({
        where: { reversalOfId: b.journal.id },
      });
      if (reversal) {
        if (
          await tx.accountingWorkflow.findFirst({
            where: { journalId: reversal.id, id: { not: id } },
          })
        )
          return { id: r.id, noJournal: true };
        await tx.accountingWorkflow.update({
          where: { id },
          data: { journalId: reversal.id },
        });
        return reversal;
      }
      const otherFailure = await tx.accountingWorkflow.findMany({
        where: {
          kind: 'PURCHASE_OUTCOME',
          cancelled: false,
          sourceEvent: { requestId: e.requestId, source: e.source },
          journal: { status: 'POSTED' },
        },
      });
      if (otherFailure.length)
        fail('لغو تعهد این خرید قبلاً ثبت نهایی شده است.');
      reversalOfId = b.journal.id;
      lines = b.journal.lines.map((l) =>
        carryLine(l, l.credit.toString(), l.debit.toString()),
      );
      if (e.currency !== book.baseCurrency) {
        const tracking = String(
          (b.liability.attributes as Facts).trackingNumber ?? e.requestId,
        );
        const revaluations = await tx.accountingJournalLine.findMany({
          where: {
            accountId: b.liability.accountId,
            detail4Id: b.liability.detail4Id,
            detail5Id: b.liability.detail5Id,
            detail6Id: b.liability.detail6Id,
            attributes: { path: ['trackingNumber'], equals: tracking },
            AND: [
              {
                OR: [
                  { currency: e.currency },
                  {
                    attributes: {
                      path: ['valuationCurrency'],
                      equals: e.currency,
                    },
                  },
                ],
              },
            ],
            journal: {
              bookId: book.id,
              status: 'POSTED',
              reversal: { is: null },
              sourceKey: { startsWith: 'REVALUE:' },
            },
          },
        });
        const delta = revaluations.reduce(
          (n, l) => n.add(l.credit.toString()).sub(l.debit.toString()),
          new Exact(0),
        );
        if (!delta.isZero()) {
          const role = delta.gt(0) ? 'gain' : 'loss';
          if (p[`${role}AccountId`] === b.liability.accountId)
            fail('حساب سود یا زیان باید از حساب بدهی جدا باشد.');
          const liability = carryLine(
            b.liability,
            delta.gt(0) ? delta.toString() : '0',
            delta.lt(0) ? delta.abs().toString() : '0',
          );
          Object.assign(liability, {
            currency: null,
            foreignAmount: null,
            rate: null,
            fxSnapshotId: null,
            attributes: {
              ...(b.liability.attributes as Facts),
              valuationCurrency: e.currency,
            },
          });
          lines.push(
            liability,
            roleLine(
              p,
              role,
              delta.lt(0) ? delta.abs().toString() : '0',
              delta.gt(0) ? delta.toString() : '0',
            ),
          );
        }
      }
    } else if (r.kind === 'FX_SETTLEMENT') {
      const current = await fxBasis(tx, book, e);
      if (
        current.carrying !== f.carrying ||
        current.actual !== f.actual ||
        current.difference !== f.difference
      )
        fail(
          'مبنای دفتری تسویه تغییر کرده است؛ مبنای قدیمی لغو و دوباره ثبت شود.',
        );
      if (r.amount.isZero()) return { id: r.id, noJournal: true };
      const liability = await tx.accountingJournalLine.findUniqueOrThrow({
          where: { id: String(f.liabilityLineId) },
        }),
        difference = new Exact(String(f.difference)),
        n = r.amount.toString();
      const l = carryLine(
        liability,
        difference.lt(0) ? n : '0',
        difference.gt(0) ? n : '0',
      );
      Object.assign(l, {
        currency: null,
        foreignAmount: null,
        rate: null,
        fxSnapshotId: null,
        attributes: {
          ...(liability.attributes as Facts),
          valuationCurrency: e.currency,
        },
      });
      if (
        p[difference.gt(0) ? 'lossAccountId' : 'gainAccountId'] ===
        liability.accountId
      )
        fail('حساب سود یا زیان باید از حساب بدهی جدا باشد.');
      lines = [
        l,
        roleLine(
          p,
          difference.gt(0) ? 'loss' : 'gain',
          difference.gt(0) ? n : '0',
          difference.lt(0) ? n : '0',
        ),
      ];
    } else {
      const b = await payable(tx, book, e, true);
      let carrying = new Exact(0);
      if (e.currency === book.baseCurrency)
        carrying = new Exact(e.amount.toString());
      else {
        const settled = (
          await active(tx, { sourceEventId: e.id, kind: 'FX_SETTLEMENT' })
        )[0];
        if (
          !settled ||
          settled.cancelled ||
          (settled.amount.gt(0) && settled.journal?.status !== 'POSTED')
        )
          fail('ابتدا تسویه ارزی پرداخت اصلی را ثبت نهایی کنید.');
        carrying = new Exact(String(facts(settled).carrying));
      }
      const siblings = await active(tx, {
        sourceEventId: e.id,
        kind: { in: ['SUPPLIER_REFUND', 'PURCHASE_WRITE_OFF'] },
      });
      const prior = siblings.filter(
        (x) =>
          x.id !== r.id &&
          (x.createdAt < r.createdAt ||
            (x.createdAt.getTime() === r.createdAt.getTime() && x.id < r.id)),
      );
      if (prior.some((x) => x.journal?.status !== 'POSTED'))
        fail('ابتدا استردادها و زیان‌های قبلی این پرداخت را ثبت نهایی کنید.');
      const previousForeign = prior.reduce(
        (n, x) => n.add(x.amount.toString()),
        new Exact(0),
      );
      const previousCarrying = prior.reduce(
        (n, x) =>
          n.add(
            new Exact(
              String(
                (x.journal?.attributes as Facts)?.workflowCarryingAmount ??
                  fail('مبنای حمل استرداد قبلی یافت نشد.'),
              ),
            ),
          ),
        new Exact(0),
      );
      const portion = settlementPortion(
        e.amount.toString(),
        carrying.toString(),
        previousForeign.toString(),
        previousCarrying.toString(),
        r.amount.toString(),
        scale,
      );
      carryingForJournal = portion.toString();
      const credit = carryLine(
        b.liability,
        '0',
        portion.toString(),
        r.amount.toString(),
      );
      lines = [credit];
      if (r.kind === 'PURCHASE_WRITE_OFF')
        lines.push(roleLine(p, 'expense', portion.toString(), '0'));
      else {
        if (p.cashAccountId === b.liability.accountId)
          fail('حساب وصول وجه باید از حساب بدهی تأمین‌کننده جدا باشد.');
        const account = await tx.financeSettlementAccount.findFirst({
          where: {
            id: r.receiptAccountId!,
            branchId: book.branchId,
            currencyCode: r.currency,
            isActive: true,
          },
        });
        if (!account) fail('حساب دریافت غیرفعال یا نامعتبر است.');
        component('cash', r.amount.toString(), 'debit');
        const delta = new Exact(base(r.amount.toString())).sub(portion);
        if (!delta.isZero())
          lines.push(
            roleLine(
              p,
              delta.gt(0) ? 'gain' : 'loss',
              delta.lt(0) ? delta.abs().toString() : '0',
              delta.gt(0) ? delta.toString() : '0',
            ),
          );
      }
    }
  }
  if (!lines.length) return { id: r.id, noJournal: true };
  const debit = lines.reduce((n, l) => n.add(String(l.debit)), new Exact(0)),
    credit = lines.reduce((n, l) => n.add(String(l.credit)), new Exact(0)),
    rounding = debit.sub(credit);
  if (!rounding.isZero())
    lines.push(
      roleLine(
        p,
        'rounding',
        rounding.lt(0) ? rounding.abs().toString() : '0',
        rounding.gt(0) ? rounding.toString() : '0',
      ),
    );
  const tracking = String(
      f.trackingNumber ??
        (contractBasis?.line.attributes as Facts | undefined)?.trackingNumber ??
        r.contractId ??
        r.hrRecordId ??
        r.id,
    ),
    trackingDate = String(
      f.trackingDate ??
        (contractBasis?.line.attributes as Facts | undefined)?.trackingDate ??
        financialDate(r.occurredAt),
    );
  lines = lines.map((l) => ({
    ...l,
    description: `${r.kind} · ${r.reference}`,
    attributes: {
      ...((l.attributes as Facts) ?? {}),
      trackingNumber: tracking,
      trackingDate,
    },
  }));
  const periods = await tx.accountingPeriod.findMany({
    where: {
      bookId: book.id,
      status: 'OPEN',
      startDate: { lte: date },
      endDate: { gte: date },
      ...(p.periodId ? { id: v.uuid(p.periodId)! } : {}),
    },
  });
  if (periods.length !== 1) fail('دوره باز یکتای تاریخ سند را انتخاب کنید.');
  const j = await create({
    periodId: periods[0]!.id,
    typeId: p.typeId,
    documentDate: date,
    description: `${r.kind} · ${r.reference}`,
    reference: r.reference,
    sourceKey: `WORKFLOW:${r.id}`,
    attributes: {
      financialWorkflowId: r.id,
      sourceOccurredAt: r.occurredAt.toISOString(),
      latePostingReason: reason,
      ...(carryingForJournal
        ? { workflowCarryingAmount: carryingForJournal }
        : {}),
    },
    lines,
  });
  if (reversalOfId)
    await tx.accountingJournal.update({
      where: { id: j.id },
      data: { reversalOfId },
    });
  await tx.accountingWorkflow.update({
    where: { id },
    data: { journalId: j.id },
  });
  return j;
}

export async function cancelWorkflow(
  tx: Tx,
  book: Book,
  p: Facts,
  actor: AuthenticatedActor,
) {
  const r = await tx.accountingWorkflow.findFirst({
    where: { id: v.uuid(p.id)!, bookId: book.id },
  });
  if (!r) throw new NotFoundException();
  if (
    !actor.permissions.includes('finance.journal.approve') ||
    actor.userId === r.actorId
  )
    throw new ForbiddenException('لغو مبنا به تأییدکننده مستقل نیاز دارد.');
  if (v.text(p.reason, 2000, true).length < 10)
    fail('دلیل مستند لغو لازم است.');
  if (r.cancelled) return r;
  if (r.kind === 'FX_SETTLEMENT') await assertFxUnreferenced(tx, r);
  if (r.journalId) {
    const j = await tx.accountingJournal.findUniqueOrThrow({
      where: { id: r.journalId },
    });
    if (
      j.status !== 'CANCELLED' &&
      !(await tx.accountingJournal.findFirst({
        where: { reversalOfId: j.id, status: 'POSTED' },
      }))
    )
      fail('ابتدا سند را لغو یا برگشت آن را ثبت نهایی کنید.');
  }
  if (
    r.kind === 'PURCHASE_OUTCOME' &&
    (await consumed(tx, r.sourceEventId!)).gt(0)
  )
    fail('نتیجه خرید دارای دریافت برگشتی یا زیان قطعی لغو نمی‌شود.');
  if (r.kind === 'PAYROLL' && !facts(r).netAlreadyAccrued) {
    const requests = await tx.financeOperationalRequest.findMany({
      where: {
        branchId: book.branchId,
        kind: 'PAYROLL',
        payrollEmployeeId: String(facts(r).employeeId),
        payrollPeriod: String(facts(r).period),
      },
      include: {
        revisions: {
          where: { action: 'APPROVE' },
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });
    for (const request of requests) {
      const revision = request.revisions[0];
      if (!revision) continue;
      if (
        request.amount.toString() !== String(facts(r).net) ||
        request.currencyCode !== r.currency
      )
        fail('مبنای حقوق برای بازگردانی تعهد خالص نیازمند تطبیق است.');
      if (
        !(await tx.financeAccountingEvent.findUnique({
          where: {
            sourceKey: `OPERATIONAL:PAYROLL_NET_APPROVED:${revision.id}`,
          },
        }))
      )
        await recordFinancialEvent(tx, {
          source: 'OPERATIONAL',
          recordId: revision.id,
          requestId: request.id,
          kind: 'PAYROLL_NET_APPROVED',
          branchId: request.branchId,
          actorId: revision.actorId,
          occurredAt: revision.createdAt,
          amount: request.amount.toString(),
          currency: request.currencyCode,
          partyId: request.payrollEmployeeId ?? request.id,
          reference: request.reference,
        });
    }
  }
  const updated = await tx.accountingWorkflow.update({
    where: { id: r.id },
    data: { cancelled: true },
  });
  return {
    ...updated,
    cancellation: {
      reason: v.text(p.reason, 2000, true),
      actorId: actor.userId,
      at: new Date().toISOString(),
    },
  };
}

/** Payroll approval takes shared book locks before checking this projection. */
export async function grossAccrualCovers(
  tx: Tx,
  branchId: string,
  hrRecordId: string,
  amount: string,
  currency: string,
) {
  if (
    !(await tx.accountingWorkflow.count({
      where: { branchId, kind: 'PAYROLL', currency, cancelled: false },
    }))
  )
    return false;
  const identity = await netPayrollIdentity(tx, hrRecordId, branchId);
  const rows = (
    await active(tx, {
      branchId,
      kind: 'PAYROLL',
      currency,
      facts: { path: ['employeeId'], equals: identity.employeeId },
    })
  ).filter((r) => facts(r).period === identity.period);
  if (!rows.length) return false;
  if (
    rows.length !== 1 ||
    String(facts(rows[0]!).net) !== new Exact(amount).toString()
  )
    fail('خالص حقوق با مبنای ناخالص ثبت‌شده یکسان نیست.');
  return true;
}

export async function assertWorkflowsClosed(
  tx: Tx,
  book: Book,
  start: string,
  end: string,
) {
  if (
    await tx.accountingWorkflow.findFirst({
      where: {
        branchId: book.branchId,
        cancelled: false,
        occurredAt: {
          gte: new Date(`${start}T00:00:00Z`),
          lte: new Date(`${end}T23:59:59.999Z`),
        },
        journal: { reversal: { status: 'POSTED' } },
      },
    })
  )
    fail('مبنای دارای سند برگشتی را پیش از بستن دوره لغو و تعیین تکلیف کنید.');
  const foreignPayments = await tx.financeAccountingEvent.findMany({
    where: {
      branchId: book.branchId,
      currency: { not: book.baseCurrency },
      kind: { in: payKinds },
      occurredAt: {
        gte: new Date(`${start}T00:00:00Z`),
        lte: new Date(`${end}T23:59:59.999Z`),
      },
      journal: { bookId: book.id, status: 'POSTED', reversal: { is: null } },
    },
  });
  for (const e of foreignPayments) {
    const settlements = await active(tx, {
      bookId: book.id,
      sourceEventId: e.id,
      kind: 'FX_SETTLEMENT',
    });
    if (
      settlements.length !== 1 ||
      (settlements[0]!.amount.gt(0) &&
        settlements[0]!.journal?.status !== 'POSTED')
    )
      fail('تسویه ارزی پرداخت دوره باید پیش از بستن آن تعیین تکلیف شود.');
  }
  const rows = await active(tx, {
    branchId: book.branchId,
    occurredAt: {
      gte: new Date(`${start}T00:00:00Z`),
      lte: new Date(`${end}T23:59:59.999Z`),
    },
  });
  for (const r of rows) {
    if (r.kind === 'PURCHASE_OUTCOME') {
      const state = await outcome(tx, { id: r.sourceEventId! } as Event);
      if (state === 'SUCCESS') continue;
      if (
        state === 'INQUIRY' ||
        (await consumed(tx, r.sourceEventId!)).lt(r.amount.toString())
      )
        fail('خرید ناموفق یا وجه برگشتی تعیین‌تکلیف‌نشده در دوره وجود دارد.');
      if (facts(r).state !== 'FAILED') continue;
      if (!r.journalId) {
        const b = await payable(
          tx,
          book,
          await sourceEvent(tx, book, r.sourceEventId!),
          true,
        );
        if (
          await tx.accountingJournal.findFirst({
            where: { reversalOfId: b.journal.id, status: 'POSTED' },
          })
        )
          continue;
      }
    }
    if (
      (r.kind === 'FX_SETTLEMENT' && r.amount.isZero()) ||
      (r.kind === 'PAYROLL' &&
        facts(r).netAlreadyAccrued &&
        String(facts(r).deductions) === '0')
    )
      continue;
    if (r.journal?.status !== 'POSTED')
      fail('فرایند مالی بدون سند نهایی در دوره وجود دارد.');
  }
}

/** Only an immutable, linked server-generated workflow may carry historic FX lots. */
export async function workflowPostingContext(
  tx: Tx,
  book: Book,
  journal: Journal,
) {
  if (
    !journal.sourceKey?.startsWith('WORKFLOW:') &&
    !String((journal.attributes as Facts).reversalSourceKey ?? '').startsWith(
      'WORKFLOW:',
    )
  )
    return { at: null as Date | null, carryAccounts: [] as string[] };
  if (journal.reversalOfId) {
    const original = await tx.accountingWorkflow.findFirst({
      where: { journalId: journal.reversalOfId, kind: 'FX_SETTLEMENT' },
    });
    if (original) await assertFxUnreferenced(tx, original);
  }
  const r = await tx.accountingWorkflow.findFirst({
    where: { journalId: journal.id, bookId: book.id },
  });
  if (!r) return { at: null as Date | null, carryAccounts: [] as string[] };
  if (
    r.cancelled ||
    (journal.sourceKey !== `WORKFLOW:${r.id}` &&
      !(
        r.kind === 'PURCHASE_OUTCOME' &&
        facts(r).state === 'FAILED' &&
        journal.sourceKey?.startsWith('REVERSE:')
      ))
  )
    fail('مبنای فرایند لغو شده یا با سند یکسان نیست.');
  const f = facts(r);
  if (r.kind === 'REVENUE') {
    const current = await revenueSource(tx, r.contractId!, book.branchId);
    if (
      JSON.stringify(current.components) !==
      JSON.stringify((f.source as Facts).components)
    )
      fail('قیمت قرارداد با مبنای درآمد یکسان نیست؛ مبنا و سند را اصلاح کنید.');
    const deferred = await salesContractDeferredBasis(
      tx,
      r.contractId!,
      r.currency,
      book.id,
    );
    if (deferred)
      return {
        at: deferred.event.occurredAt,
        carryAccounts: [deferred.line.accountId!],
      };
  }
  if (r.kind === 'PAYROLL') {
    const current = await payrollSource(
      tx,
      r.hrRecordId!,
      r.grossRecordId!,
      book.branchId,
    );
    if (
      current.gross !== f.gross ||
      current.net !== f.net ||
      current.deductions !== f.deductions
    )
      fail('مبنای حقوق تغییر کرده است.');
  }
  if (
    ['SUPPLIER_REFUND', 'PURCHASE_WRITE_OFF', 'PURCHASE_OUTCOME'].includes(
      r.kind,
    )
  ) {
    const e = await sourceEvent(tx, book, r.sourceEventId!),
      b = await payable(tx, book, e, true);
    if (
      r.kind === 'PURCHASE_OUTCOME' &&
      f.state === 'FAILED' &&
      journal.reversalOfId === b.journal.id
    )
      return {
        at: r.occurredAt,
        carryAccounts: [b.liability.accountId!, b.cost.accountId!],
      };
    if (r.kind !== 'PURCHASE_OUTCOME')
      return { at: r.occurredAt, carryAccounts: [b.liability.accountId!] };
  }
  if (r.kind === 'FX_SETTLEMENT') {
    const current = await fxBasis(
      tx,
      book,
      await sourceEvent(tx, book, r.sourceEventId!),
    );
    if (
      current.carrying !== f.carrying ||
      current.actual !== f.actual ||
      current.difference !== f.difference
    )
      fail('مبنای دفتری تسویه ارزی تغییر کرده است.');
  }
  return { at: r.occurredAt, carryAccounts: [] as string[] };
}

/** Sales calls before taking its own row locks; Finance owns the recognition projection. */
export async function assertRevenueEditable(
  tx: Tx,
  contractId: string,
  branchIds: readonly string[],
) {
  if (!branchIds.length) throw new ForbiddenException();
  await tx.$queryRaw`SELECT id FROM accounting_books WHERE "branchId" IN (${Prisma.join(branchIds.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR SHARE`;
  await assertSalesContractAccountingEditable(tx, contractId, branchIds);
  const rows = await active(tx, {
    contractId,
    branchId: { in: [...branchIds] },
    kind: 'REVENUE',
  });
  if (rows.length)
    fail(
      'پیش از اصلاح قیمت یا ابطال قرارداد، مبنای درآمد و سند آن را لغو یا برگشت دهید.',
    );
}

async function assertFxUnreferenced(tx: Tx, r: Entry) {
  if ((await consumed(tx, r.sourceEventId!)).gt(0))
    fail('ابتدا استرداد یا زیان متکی بر این تسویه را برگشت دهید.');
  if (
    (
      await active(tx, {
        bookId: r.bookId,
        kind: 'FX_SETTLEMENT',
        facts: { path: ['priorSettlementIds'], array_contains: [r.id] },
      })
    ).length
  )
    fail('ابتدا مبنا و سند تسویه ارزی پرداخت‌های بعدی این خرید را برگشت دهید.');
}
