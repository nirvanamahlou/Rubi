import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@nora/database';
import * as v from './accounting.validation';

type Tx = Prisma.TransactionClient;
type Book = { id: string; branchId: string; baseCurrency: string };
type Period = {
  id: string;
  startDate: string;
  endDate: string;
  status: string;
};
type Statement = Prisma.FinanceBankStatementGetPayload<object>;
const D = Prisma.Decimal.clone({ precision: 80 });
function signed(input: unknown) {
  const negative = typeof input === 'string' && input.startsWith('-');
  const amount = new D(
    v.decimal(negative ? (input as string).slice(1) : input)!,
  );
  return negative ? amount.negated() : amount;
}
function ledgerAmount(
  line: {
    debit: Prisma.Decimal;
    credit: Prisma.Decimal;
    foreignAmount: Prisma.Decimal | null;
  },
  foreign: boolean,
) {
  return foreign
    ? line.debit.gt(0)
      ? line.foreignAmount!
      : line.foreignAmount!.negated()
    : new D(line.debit).sub(line.credit);
}
async function report(tx: Tx, book: Book, s: Statement) {
  const foreign = s.currency !== book.baseCurrency;
  const where: Prisma.AccountingJournalLineWhereInput = {
    accountId: s.accountId,
    detail4Id: s.detailId,
    ...(foreign ? { currency: s.currency, foreignAmount: { not: null } } : {}),
  };
  const journal = { bookId: book.id, periodId: s.periodId, status: 'POSTED' };
  const before = await tx.accountingJournalLine.groupBy({
    by: ['currency'],
    where: { ...where, journal: { ...journal, documentDate: { lt: s.from } } },
    _sum: { debit: true, credit: true },
  });
  let opening = before.reduce(
    (n, x) => n.add(x._sum.debit ?? 0).sub(x._sum.credit ?? 0),
    new D(0),
  );
  if (foreign) {
    const prev = {
      ...where,
      journal: { ...journal, documentDate: { lt: s.from } },
    };
    const sum = async (side: 'debit' | 'credit') =>
      (
        await tx.accountingJournalLine.aggregate({
          where: { ...prev, [side]: { gt: 0 } },
          _sum: { foreignAmount: true },
        })
      )._sum.foreignAmount ?? new D(0);
    opening = (await sum('debit')).sub(await sum('credit'));
  }
  const rows = await tx.financeBankStatementRow.findMany({
    where: { statementId: s.id },
    orderBy: { seq: 'asc' },
  });
  const entries = await tx.accountingJournalLine.findMany({
    where: {
      ...where,
      journal: { ...journal, documentDate: { gte: s.from, lte: s.to } },
    },
    orderBy: [{ journal: { documentDate: 'asc' } }, { id: 'asc' }],
    take: 2001,
    select: {
      id: true,
      debit: true,
      credit: true,
      foreignAmount: true,
      description: true,
      journal: {
        select: { id: true, number: true, documentDate: true, reference: true },
      },
    },
  });
  if (entries.length > 2000)
    v.rule('برای این تعداد گردش، بازه کوتاه‌تری انتخاب کنید.');
  const lines = entries.map((e) => ({
    id: e.id,
    amount: ledgerAmount(e, foreign).toString(),
    date: e.journal.documentDate,
    number: e.journal.number,
    journalId: e.journal.id,
    reference: e.journal.reference,
    description: e.description,
  }));
  const closing = lines.reduce((n, x) => n.add(x.amount), opening);
  const matched = new Set(rows.map((x) => x.lineId).filter(Boolean));
  const difference = new D(s.closing).sub(closing);
  return {
    statement: s,
    rows,
    lines,
    bookOpening: opening.toString(),
    bookClosing: closing.toString(),
    difference: difference.toString(),
    complete:
      difference.isZero() &&
      rows.every((x) => x.lineId) &&
      lines.every((x) => matched.has(x.id)),
  };
}
export async function bankReport(
  tx: Tx,
  book: Book,
  period: Period,
  q: Record<string, string>,
) {
  if (!q.id)
    return {
      statements: await tx.financeBankStatement.findMany({
        where: { bookId: book.id, periodId: period.id },
        include: { bank: { select: { title: true } } },
        orderBy: [{ to: 'desc' }, { id: 'asc' }],
      }),
    };
  const s = await tx.financeBankStatement.findFirst({
    where: { id: v.uuid(q.id)!, bookId: book.id, periodId: period.id },
  });
  if (!s) throw new NotFoundException();
  return report(tx, book, s);
}
export async function bankCommand(
  tx: Tx,
  book: Book,
  period: Period,
  action: string,
  p: Record<string, unknown>,
) {
  if (period.status !== 'OPEN') v.rule('دوره مالی باز نیست.');
  if (action === 'bank-statement-import') {
    const from = v.date(p.from)!,
      to = v.date(p.to)!,
      bankId = v.uuid(p.bankId)!,
      accountId = v.uuid(p.accountId)!,
      detailId = v.uuid(p.detailId, true);
    if (from > to || from < period.startDate || to > period.endDate)
      v.rule('بازه صورتحساب خارج از دوره مالی است.');
    const bank = await tx.financeSettlementAccount.findFirst({
      where: {
        id: bankId,
        branchId: book.branchId,
        kind: 'BANK',
        isActive: true,
        isExternal: false,
        deletedAt: null,
        OR: [{ treasuryBookId: null }, { treasuryBookId: book.id }],
      },
    });
    if (
      !bank?.currencyCode ||
      !(await tx.accountingAccount.count({
        where: {
          id: accountId,
          bookId: book.id,
          level: 'SUBSIDIARY',
          active: true,
        },
      })) ||
      (detailId &&
        !(await tx.accountingDetail.count({
          where: { id: detailId, bookId: book.id, active: true },
        })))
    )
      v.rule('حساب بانک یا معین و تفصیلی دفتر معتبر نیست.');
    const existing = await tx.financeBankStatement.findMany({
      where: { bookId: book.id, OR: [{ bankId }, { accountId, detailId }] },
    });
    const opening = signed(p.opening),
      closing = signed(p.closing);
    for (const x of existing) {
      if (
        x.bankId !== bankId ||
        x.accountId !== accountId ||
        x.detailId !== detailId ||
        x.currency !== bank.currencyCode
      )
        v.rule(
          'این حساب بانکی یا معین و تفصیلی قبلاً به حساب دیگری متصل شده است.',
        );
      if (x.from <= to && x.to >= from)
        v.rule('صورتحساب دیگری با این بازه تداخل دارد.');
      const next = (d: string) =>
        new Date(Date.parse(d) + 86400000).toISOString().slice(0, 10);
      if (
        (next(x.to) === from && !x.closing.eq(opening)) ||
        (next(to) === x.from && !closing.eq(x.opening))
      )
        v.rule('مانده دو صورتحساب پیاپی برابر نیست.');
    }
    if (!Array.isArray(p.rows) || p.rows.length > 500)
      v.invalid('حداکثر ۵۰۰ ردیف در هر صورتحساب مجاز است.');
    const rows = p.rows.map((raw, i) => {
      const r = v.object(raw),
        date = v.date(r.date)!,
        amount = signed(r.amount);
      if (date < from || date > to || amount.isZero())
        v.invalid('تاریخ یا مبلغ ردیف صورتحساب معتبر نیست.');
      return {
        seq: i + 1,
        date,
        amount,
        reference: v.text(r.reference, 160),
        description: v.text(r.description, 500),
      };
    });
    if (!rows.reduce((n, r) => n.add(r.amount), opening).eq(closing))
      v.rule('مانده ابتدا به علاوه گردش بانک باید برابر مانده پایان باشد.');
    return tx.financeBankStatement.create({
      data: {
        bookId: book.id,
        periodId: period.id,
        bankId,
        accountId,
        detailId,
        from,
        to,
        opening,
        closing,
        currency: bank.currencyCode,
        rows: { create: rows },
      },
      select: { id: true },
    });
  }
  const s = await tx.financeBankStatement.findFirst({
    where: { id: v.uuid(p.id)!, bookId: book.id, periodId: period.id },
  });
  if (!s) throw new NotFoundException();
  if (s.closedAt)
    throw new ConflictException('صورتحساب نهایی قابل ویرایش نیست.');
  const view = await report(tx, book, s);
  if (action === 'bank-statement-finalize') {
    if (!view.complete) v.rule('گردش تطبیق‌نشده یا اختلاف مانده وجود دارد.');
    await tx.financeBankStatement.update({
      where: { id: s.id },
      data: { closedAt: new Date() },
    });
    return { id: s.id };
  }
  const row = view.rows.find((x) => x.id === v.uuid(p.rowId));
  if (!row) throw new NotFoundException();
  const unmatch = action === 'bank-statement-unmatch';
  const line = unmatch
    ? null
    : view.lines.find((x) => x.id === v.uuid(p.lineId));
  if (
    !unmatch &&
    (!line ||
      row.lineId ||
      !row.amount.eq(line.amount) ||
      view.rows.some((x) => x.lineId === line.id))
  )
    v.rule('ردیف آزاد با مبلغ و جهت یکسان انتخاب کنید.');
  if (!unmatch && action !== 'bank-statement-match')
    v.invalid('عملیات نامعتبر است.');
  await tx.financeBankStatementRow.update({
    where: { id: row.id },
    data: { lineId: line?.id ?? null },
  });
  return { id: s.id };
}
