import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type {
  AuthenticatedActor,
  FinanceHistoryItemV1,
  FinanceHistoryQueryV1,
  FinanceHistorySourceV1,
  FinanceHistoryV1,
} from '@nora/contracts';
import type { DatabaseService } from '../database/database.service';
import type { SalesService } from '../sales/sales.service';
import type { ReservationsPublicService } from '../reservations/reservations-public.service';

const sources: FinanceHistorySourceV1[] = [
  'SALES',
  'TICKET',
  'RESERVATIONS',
  'INVOICE',
  'OPERATIONAL',
];
const pageSize = 25;
type Cursor = { date: string; source: FinanceHistorySourceV1; id: string };
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function historyCursor(query: FinanceHistoryQueryV1): Cursor | null {
  if (
    (query.direction !== undefined &&
      !['RECEIPT', 'PAYMENT'].includes(query.direction)) ||
    (query.source !== undefined && !sources.includes(query.source)) ||
    (query.recordId !== undefined &&
      (typeof query.recordId !== 'string' || !uuid.test(query.recordId))) ||
    (query.requestId !== undefined &&
      (typeof query.requestId !== 'string' || !uuid.test(query.requestId)))
  )
    throw new BadRequestException('فیلتر تاریخچه معتبر نیست.');
  if (query.cursor === undefined) return null;
  try {
    if (typeof query.cursor !== 'string' || query.cursor.length > 500)
      throw new Error();
    const cursor = JSON.parse(
      Buffer.from(query.cursor, 'base64url').toString(),
    ) as Cursor;
    if (
      !sources.includes(cursor.source) ||
      typeof cursor.id !== 'string' ||
      !uuid.test(cursor.id) ||
      typeof cursor.date !== 'string' ||
      new Date(cursor.date).toISOString() !== cursor.date
    )
      throw new Error();
    return cursor;
  } catch {
    throw new BadRequestException('صفحه تاریخچه معتبر نیست.');
  }
}
/** Global descending (date, source, id) order, including equal-date installments. */
export function historyAfter(
  cursor: Cursor | null,
  source: FinanceHistorySourceV1,
  field: string,
) {
  if (!cursor) return {};
  const date = new Date(cursor.date);
  return {
    OR: [
      { [field]: { lt: date } },
      ...(source < cursor.source
        ? [{ [field]: date }]
        : source === cursor.source
          ? [{ [field]: date, id: { lt: cursor.id } }]
          : []),
    ],
  };
}
export function historyPage(items: FinanceHistoryItemV1[]): FinanceHistoryV1 {
  items.sort(
    (a, b) =>
      b.occurredAt.localeCompare(a.occurredAt) ||
      (a.source === b.source
        ? a.id < b.id
          ? 1
          : a.id > b.id
            ? -1
            : 0
        : a.source < b.source
          ? 1
          : -1),
  );
  const page = items.slice(0, pageSize);
  const last = page.at(-1);
  return {
    version: 1,
    items: page,
    nextCursor:
      items.length > pageSize && last
        ? Buffer.from(
            JSON.stringify({
              date: last.occurredAt,
              source: last.source,
              id: last.id,
            }),
          ).toString('base64url')
        : null,
  };
}
export async function readFinanceHistory(
  database: DatabaseService,
  sales: SalesService,
  reservations: ReservationsPublicService,
  query: FinanceHistoryQueryV1,
  actor: AuthenticatedActor,
): Promise<FinanceHistoryV1> {
  if (!actor.permissions.includes('finance.read'))
    throw new ForbiddenException('مجوز مشاهده تاریخچه مالی وجود ندارد.');
  const cursor = historyCursor(query);
  const enabled = (source: FinanceHistorySourceV1) =>
    (!query.source || query.source === source) &&
    (!query.direction ||
      query.direction === (source === 'SALES' ? 'RECEIPT' : 'PAYMENT'));
  const db = database.client;
  const take = pageSize + 1;
  const [receipts, tickets, invoices, descriptors, operational] =
    await Promise.all([
      enabled('SALES')
        ? sales.financeReceiptHistory(
            actor,
            {
              ...historyAfter(cursor, 'SALES', 'financeConfirmedAt'),
              ...(query.recordId ? { id: query.recordId } : {}),
            },
            take,
            query.requestId,
          )
        : [],
      enabled('TICKET')
        ? db.financeTicketPurchasePaymentRevision.findMany({
            where: {
              cost: {
                branchId: { in: [...actor.branchIds] },
                ...(query.requestId ? { requestId: query.requestId } : {}),
              },
              ...historyAfter(cursor, 'TICKET', 'transferAt'),
              ...(query.recordId ? { id: query.recordId } : {}),
            },
            include: { cost: true, account: true, paymentMethod: true },
            orderBy: [{ transferAt: 'desc' }, { id: 'desc' }],
            take,
          })
        : [],
      enabled('INVOICE')
        ? db.financeProcurementInvoiceRevision.findMany({
            where: {
              branchId: { in: [...actor.branchIds] },
              paidAmount: { gt: 0 },
              transferAt: { not: null },
              ...(query.requestId ? { sourceId: query.requestId } : {}),
              ...historyAfter(cursor, 'INVOICE', 'transferAt'),
              ...(query.recordId ? { id: query.recordId } : {}),
            },
            include: { account: true, paymentMethod: true },
            orderBy: [{ transferAt: 'desc' }, { id: 'desc' }],
            take,
          })
        : [],
      enabled('RESERVATIONS')
        ? reservations.financeHistoryPurchases(actor.branchIds, query.requestId)
        : [],
      enabled('OPERATIONAL')
        ? db.financeOperationalRevision.findMany({
            where: {
              action: 'PAY',
              paidAmount: { gt: 0 },
              transferAt: { not: null },
              request: {
                branchId: { in: actor.branchIds },
                ...(query.requestId ? { id: query.requestId } : {}),
              },
              ...historyAfter(cursor, 'OPERATIONAL', 'transferAt'),
              ...(query.recordId ? { id: query.recordId } : {}),
            },
            include: { request: true, account: true },
            orderBy: [{ transferAt: 'desc' }, { id: 'desc' }],
            take,
          })
        : [],
    ]);
  const purchases = new Map(descriptors.map((p) => [p.id, p]));
  const payments = purchases.size
    ? await db.financeSupplierPaymentRevision.findMany({
        where: {
          purchaseId: { in: [...purchases.keys()] },
          paidAmount: { gt: 0 },
          transferAt: { not: null },
          ...historyAfter(cursor, 'RESERVATIONS', 'transferAt'),
          ...(query.recordId ? { id: query.recordId } : {}),
        },
        include: { account: true, paymentMethod: true },
        orderBy: [{ transferAt: 'desc' }, { id: 'desc' }],
        take,
      })
    : [];
  const receiptAccounts = receipts.length
    ? await db.financeSettlementAccount.findMany({
        where: {
          branchId: { in: [...actor.branchIds] },
          id: {
            in: receipts.flatMap((p) => (p.accountId ? [p.accountId] : [])),
          },
        },
        select: { id: true, title: true },
      })
    : [];
  const accountNames = new Map(receiptAccounts.map((a) => [a.id, a.title]));
  return historyPage([
    ...operational.map((row) => ({
      id: row.id,
      source: 'OPERATIONAL' as const,
      direction: 'PAYMENT' as const,
      requestId: row.requestId,
      title: `${row.request.title} · ${row.request.party}`,
      occurredAt: row.transferAt!.toISOString(),
      amount: row.paidAmount!.toString(),
      currencyCode: row.request.currencyCode,
      accountId: row.accountId,
      accountTitle: row.account?.title ?? null,
      method:
        row.snapshot &&
        typeof row.snapshot === 'object' &&
        !Array.isArray(row.snapshot) &&
        typeof row.snapshot.methodName === 'string'
          ? row.snapshot.methodName
          : null,
      reference: row.paymentReference,
      installment: null,
      cumulativePaid: row.cumulativePaid.toString(),
      remainingAmount: row.remainingAmount.toString(),
    })),
    ...receipts.map((row) => ({
      ...row,
      accountTitle: row.accountId
        ? (accountNames.get(row.accountId) ?? null)
        : null,
    })),
    ...tickets.map((row) => ({
      id: row.id,
      source: 'TICKET' as const,
      direction: 'PAYMENT' as const,
      requestId: row.cost.requestId,
      title: 'خرید بلیت',
      occurredAt: row.transferAt.toISOString(),
      amount: row.paidAmount.toString(),
      currencyCode: row.cost.currencyCode,
      accountId: row.accountId,
      accountTitle: row.account.title,
      method: row.paymentMethod.name,
      reference: row.paymentReference,
      installment: row.version,
      cumulativePaid: row.cumulativePaid.toString(),
      remainingAmount: row.remainingAmount.toString(),
    })),
    ...invoices.map((row) => ({
      id: row.id,
      source: 'INVOICE' as const,
      direction: 'PAYMENT' as const,
      requestId: row.sourceId,
      title: 'پرداخت فاکتور خرید',
      occurredAt: row.transferAt!.toISOString(),
      amount: row.paidAmount!.toString(),
      currencyCode: row.account?.currencyCode ?? '—',
      accountId: row.accountId,
      accountTitle: row.account?.title ?? null,
      method: row.paymentMethod?.name ?? null,
      reference: row.paymentReference,
      installment: null,
      cumulativePaid: row.cumulativePaid.toString(),
      remainingAmount: row.remainingAmount.toString(),
    })),
    ...payments.map((row) => ({
      id: row.id,
      source: 'RESERVATIONS' as const,
      direction: 'PAYMENT' as const,
      requestId: row.purchaseId,
      title:
        purchases.get(row.purchaseId)!.serviceTitleSnapshot +
        ' · ' +
        purchases.get(row.purchaseId)!.supplierNameSnapshot,
      occurredAt: row.transferAt!.toISOString(),
      amount: row.paidAmount!.toString(),
      currencyCode: purchases.get(row.purchaseId)!.currencyCode,
      accountId: row.accountId,
      accountTitle: row.account?.title ?? null,
      method: row.paymentMethod?.name ?? null,
      reference: row.paymentReference,
      installment: null,
      cumulativePaid: row.cumulativePaid?.toString() ?? null,
      remainingAmount: row.remainingAmount?.toString() ?? null,
    })),
  ]);
}
