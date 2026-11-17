import { ConflictException, NotFoundException } from '@nestjs/common';
import { treasuryDevices } from '@nora/contracts';
import type { Prisma } from '@nora/database';
import * as v from './accounting.validation';
import { readBankNames } from '../../master-data/master-procurement-directory';
import { financeFiscalUtcRange } from '../fiscal-context/finance-fiscal-storage';

type Tx = Prisma.TransactionClient;
type Book = { id: string; branchId: string; baseCurrency: string };
const display = {
  id: true,
  title: true,
  currencyCode: true,
  version: true,
  kind: true,
} as const;
export async function treasuryInstruments(
  tx: Tx,
  book: Book,
  q: Record<string, string>,
) {
  const page = Number(q.page ?? 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000)
    v.invalid('صفحه معتبر نیست.');
  const paging = { take: 51, skip: (page - 1) * 50 };
  if (q.view === 'cashiers') {
    const id = v.uuid(q.instrumentId)!;
    const from = v.date(q.from)!,
      to = v.date(q.to)!;
    if (from > to) v.invalid('بازه تاریخ معتبر نیست.');
    const box = await tx.treasuryInstrument.findFirst({
      where: { bookId: book.id, id, account: { kind: 'CASH' } },
    });
    if (!box) throw new NotFoundException('صندوق پیدا نشد.');
    const range = financeFiscalUtcRange(from, to);
    const rows = await tx.treasuryCashierAssignment.findMany({
      where: {
        bookId: book.id,
        instrumentId: id,
        startsAt: { lt: range.lt },
        OR: [{ endsAt: null }, { endsAt: { gt: range.gte } }],
      },
      select: {
        id: true,
        cashier: { select: { code: true, title: true } },
        startsAt: true,
        endsAt: true,
      },
      orderBy: [{ startsAt: 'desc' }, { id: 'asc' }],
      ...paging,
    });
    return { rows: rows.slice(0, 50), hasNext: rows.length > 50 };
  }
  const search = v.text(q.search, 160);
  if (q.view === 'bank-history') {
    const accountId = v.uuid(q.accountId)!,
      from = v.date(q.from)!,
      to = v.date(q.to)!;
    if (from > to) v.invalid('بازه تاریخ معتبر نیست.');
    const account = await tx.financeSettlementAccount.findFirst({
      where: {
        id: accountId,
        branchId: book.branchId,
        kind: 'BANK',
        isExternal: false,
        OR: [{ treasuryBookId: book.id }, { treasuryBookId: null }],
      },
      select: { id: true },
    });
    if (!account) throw new NotFoundException('حساب بانکی پیدا نشد.');
    const entries = await tx.financeBankAccountAudit.findMany({
      where: {
        accountId,
        occurredAt: financeFiscalUtcRange(from, to),
        action: { in: ['CREATE', 'UPDATE', 'DELETE'] },
      },
      select: { id: true, action: true, occurredAt: true, metadata: true },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      ...paging,
    });
    const rows = entries.slice(0, 50).map((e) => {
      const after = (e.metadata as { after?: { isActive?: boolean } } | null)
        ?.after;
      return {
        id: e.id,
        date: e.occurredAt,
        action: e.action,
        isActive: after?.isActive ?? null,
        balance: null,
      };
    });
    return { rows, hasNext: entries.length > 50 };
  }
  if (q.view === 'banks' || q.view === 'history-banks') {
    const rows = await tx.financeSettlementAccount.findMany({
      where: {
        branchId: book.branchId,
        kind: 'BANK',
        ...(q.view === 'banks' ? { isActive: true, deletedAt: null } : {}),
        isExternal: false,
        OR: [{ treasuryBookId: null }, { treasuryBookId: book.id }],
        title: { contains: search, mode: 'insensitive' },
      },
      select: { id: true, title: true, currencyCode: true, bankId: true },
      orderBy: [{ title: 'asc' }, { id: 'asc' }],
      ...paging,
    });
    const names = new Map(
      (
        await readBankNames(tx, [
          ...new Set(rows.flatMap((r) => (r.bankId ? [r.bankId] : []))),
        ])
      ).map((r) => [r.id, r.name]),
    );
    return {
      rows: rows
        .slice(0, 50)
        .map((r) => ({ ...r, bankName: names.get(r.bankId ?? '') ?? '' })),
      hasNext: rows.length > 50,
    };
  }
  if (q.view !== 'cashboxes' && q.view !== 'terminals')
    v.invalid('نوع گزارش معتبر نیست.');
  const rows = await tx.treasuryInstrument.findMany({
    where: {
      bookId: book.id,
      deviceType: q.view === 'cashboxes' ? null : { not: null },
      account: { title: { contains: search, mode: 'insensitive' } },
    },
    include: {
      account: { select: display },
      receivingBank: { select: { id: true, title: true, currencyCode: true } },
      provider: { select: { title: true } },
      operator: { select: { title: true } },
    },
    orderBy: [{ account: { title: 'asc' } }, { id: 'asc' }],
    ...paging,
  });
  return { rows: rows.slice(0, 50), hasNext: rows.length > 50 };
}

export async function saveTreasuryInstrument(
  tx: Tx,
  book: Book,
  p: Record<string, unknown>,
  expected: number | undefined,
  actorId: string,
) {
  const terminal = p.kind === 'terminals';
  if (!terminal && p.kind !== 'cashboxes') v.invalid('نوع ابزار معتبر نیست.');
  const id = v.uuid(p.id, true);
  const previous = id
    ? await tx.treasuryInstrument.findFirst({
        where: { id, bookId: book.id },
        include: { account: { select: display } },
      })
    : null;
  if (id && (!previous || terminal !== !!previous.deviceType))
    throw new NotFoundException();
  if (previous && previous.account.version !== expected)
    throw new ConflictException('رکورد تغییر کرده است.');
  const operatorId = v.uuid(p.operatorId, terminal);
  if (
    operatorId &&
    operatorId !== previous?.operatorId &&
    !(await tx.accountingDetail.findFirst({
      where: {
        id: operatorId,
        bookId: book.id,
        active: true,
        type: { kind: 'detail-types', title: 'شخص', active: true },
      },
    }))
  )
    v.invalid('شخص انتخاب‌شده در دفتر فعال معتبر نیست.');
  const providerId = terminal ? v.uuid(p.providerId)! : null,
    receivingBankId = terminal ? v.uuid(p.receivingBankId)! : null;
  const deviceType = terminal ? v.text(p.deviceType, 32, true) : null;
  if (terminal && !treasuryDevices.some((d) => d === deviceType))
    v.invalid('نوع ابزار پرداخت معتبر نیست.');
  if (
    providerId &&
    !(await tx.accountingConfiguration.findFirst({
      where: {
        id: providerId,
        bookId: book.id,
        kind: 'payment-providers',
        ...(previous?.providerId === providerId ? {} : { active: true }),
      },
    }))
  )
    v.invalid('شرکت خدمات پرداخت معتبر نیست.');
  const bank = receivingBankId
    ? await tx.financeSettlementAccount.findFirst({
        where: {
          id: receivingBankId,
          branchId: book.branchId,
          deletedAt: null,
          isActive: true,
          isExternal: false,
          kind: 'BANK',
          OR: [{ treasuryBookId: null }, { treasuryBookId: book.id }],
        },
        select: { id: true, bankId: true, currencyCode: true },
      })
    : null;
  if (terminal && !bank?.currencyCode)
    v.invalid('حساب بانکی معتبر انتخاب کنید.');
  const data = {
    providerId,
    receivingBankId,
    operatorId,
    deviceType,
    merchantNumber: terminal ? v.text(p.merchantNumber, 80, true) : null,
    terminalNumber: terminal ? v.text(p.terminalNumber, 80, true) : null,
    titleEn: terminal ? null : v.text(p.titleEn),
    location: terminal ? null : v.text(p.location, 240),
    description: v.text(p.description, 2000),
    descriptionEn: v.text(p.descriptionEn, 2000),
  };
  const kind = terminal
    ? deviceType === 'اینترنت'
      ? 'GATEWAY'
      : 'POS'
    : 'CASH';
  const accountData = {
    title: terminal ? data.terminalNumber! : v.text(p.title, 160, true),
    currencyCode: bank?.currencyCode ?? book.baseCurrency,
    bankId: bank?.bankId ?? null,
    kind,
  };
  if (
    previous &&
    (previous.account.currencyCode !== accountData.currencyCode ||
      previous.account.kind !== kind)
  )
    v.rule('نوع عملیاتی و ارز حساب ثبت‌شده قابل تغییر نیست.');
  const account = previous
    ? await tx.financeSettlementAccount.update({
        where: { id: previous.id, version: previous.account.version },
        data: { ...accountData, version: { increment: 1 } },
        select: display,
      })
    : await tx.financeSettlementAccount.create({
        data: {
          ...accountData,
          branchId: book.branchId,
          isActive: true,
          createdByUserId: actorId,
        },
        select: display,
      });
  if (previous)
    await tx.treasuryInstrument.update({ where: { id: account.id }, data });
  else
    await tx.treasuryInstrument.create({
      data: { ...data, id: account.id, bookId: book.id },
    });
  if (!terminal && operatorId && previous?.operatorId !== operatorId) {
    const now = new Date();
    await tx.treasuryCashierAssignment.updateMany({
      where: { instrumentId: account.id, bookId: book.id, endsAt: null },
      data: { endsAt: now },
    });
    await tx.treasuryCashierAssignment.create({
      data: {
        instrumentId: account.id,
        bookId: book.id,
        cashierId: operatorId,
        startsAt: now,
      },
    });
  }
  return { id: account.id, version: account.version };
}
