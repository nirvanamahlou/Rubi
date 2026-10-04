import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type {
  AuthenticatedActor,
  FinanceExportQueryV1,
  FinanceExportSnapshotV1,
  FinanceHistoryItemV1,
} from '@nora/contracts';
import type { FinanceInboxService } from './finance-inbox.service';
import {
  decimalText,
  decimalUnits,
  filterFinanceInbox,
  validateInboxQuery,
} from './finance-inbox-query';
export const FINANCE_EXPORT_LIMIT = 2000;
export const financeStatusNames: Record<string, string> = {
  NEW: 'جدید',
  UNDER_REVIEW: 'بررسی',
  APPROVED: 'تأییدشده',
  READY_FOR_PAYMENT: 'آماده پرداخت',
  PAYING: 'پرداخت جزئی',
  PAID: 'تسویه',
  RECEIPT_CONFIRMED: 'دریافت تأییدشده',
  CORRECTION_REQUIRED: 'برگشت برای اصلاح',
  REJECTED: 'ردشده',
  CANCELLED: 'لغوشده',
  RETURNED: 'برگشت',
  REQUIRES_MANUAL_REVIEW: 'بررسی دستی',
};
export const financeSourceNames: Record<string, string> = {
  SALES: 'فروش',
  HR: 'منابع انسانی',
  RESERVATIONS: 'رزرواسیون',
  PURCHASES: 'خرید',
  FINANCE: 'درخواست مستقیم مالی',
  TICKET: 'خرید بلیت',
  INVOICE: 'فاکتور خرید',
  OPERATIONAL: 'درخواست عملیاتی و حقوق',
};
function totals(rows: readonly { amount: string; currencyCode: string }[]) {
  const sums = new Map<string, bigint>();
  rows.forEach((row) =>
    sums.set(
      row.currencyCode,
      (sums.get(row.currencyCode) ?? 0n) + decimalUnits(row.amount),
    ),
  );
  return [...sums].map(([currencyCode, amount]) => ({
    currencyCode,
    amount: decimalText(amount),
  }));
}
const column = (label: string, type: 'TEXT' | 'DECIMAL' | 'DATE' = 'TEXT') => ({
  label,
  type,
});
export async function financeExportSnapshot(
  inbox: FinanceInboxService,
  query: FinanceExportQueryV1,
  actor: AuthenticatedActor,
): Promise<FinanceExportSnapshotV1> {
  if (
    !actor.permissions.includes('finance.read') ||
    !actor.permissions.includes('finance.export')
  )
    throw new ForbiddenException('برای دریافت خروجی مالی مجوز ندارید.');
  validateInboxQuery(query, actor);
  const scope = query.scope ?? 'INBOX';
  if (!['INBOX', 'HISTORY', 'RECEIPT'].includes(scope))
    throw new BadRequestException('نوع خروجی معتبر نیست.');
  const common = {
    version: 1 as const,
    scope,
    generatedAt: new Date().toISOString(),
    preparedBy: actor.userId,
    filterSnapshot: Object.fromEntries(
      Object.entries(query).filter(
        ([key]) => !['page', 'pageSize'].includes(key),
      ),
    ),
  };
  if (scope === 'INBOX') {
    const result = await inbox.list(actor);
    if (result.sources.some((source) => source.connection === 'UNAVAILABLE'))
      throw new ServiceUnavailableException(
        'یکی از منابع مالی در دسترس نیست؛ خروجی ناقص ساخته نمی‌شود.',
      );
    const items = filterFinanceInbox(result.items, query);
    if (items.length > FINANCE_EXPORT_LIMIT)
      throw new BadRequestException(
        'خروجی بیش از ۲۰۰۰ ردیف است؛ فیلتر را محدود کنید.',
      );
    return {
      ...common,
      title: 'گزارش کارتابل درخواست‌های مالی',
      columns: [
        column('شناسه درخواست'),
        column('منبع'),
        column('عنوان'),
        column('درخواست‌کننده'),
        column('ذی‌نفع / طرف حساب'),
        column('قرارداد / منبع'),
        column('شعبه'),
        column('وضعیت'),
        column('ارز'),
        column('مبلغ درخواست', 'DECIMAL'),
        column('پرداخت‌شده', 'DECIMAL'),
        column('مانده', 'DECIMAL'),
        column('ثبت (تهران)', 'DATE'),
        column('سررسید (تهران)', 'DATE'),
        column('توضیحات'),
      ],
      rows: items.map((item) => [
        item.sourceReference,
        financeSourceNames[item.source] ?? item.source,
        item.title,
        item.requesterDisplaySnapshot,
        item.partyDisplaySnapshot,
        item.contractReference ?? item.sourceContextReference,
        item.branchReference,
        financeStatusNames[item.status] ?? item.status,
        item.amount?.currencyCode ?? null,
        item.amount?.amount ?? null,
        item.settlement?.paidAmount ?? null,
        item.settlement?.remainingAmount ?? null,
        item.createdAt,
        item.dueAt,
        item.description,
      ]),
      totals: totals(
        items.flatMap((item) => (item.amount ? [item.amount] : [])),
      ),
      warnings: [
        'این گزارش صف فعلی منابع است، نه آرشیو کامل همه تصمیم‌ها.',
        'مجموع، مبلغ درخواست‌هاست؛ به معنی پرداخت یا موجودی حساب نیست.',
        'منابع خرید فعلی حداکثر ۵۰۰ مورد در هر projection منتشر می‌کنند.',
      ],
    };
  }
  if (scope === 'RECEIPT' && (!query.historySource || !query.recordId))
    throw new BadRequestException(
      'برای رسید، منبع و شناسه تراکنش ثبت‌شده لازم است.',
    );
  const items: FinanceHistoryItemV1[] = [];
  let cursor: string | null = null;
  const seen = new Set<string>();
  do {
    const result = await inbox.history(
      {
        ...(query.historySource ? { source: query.historySource } : {}),
        ...(query.direction ? { direction: query.direction } : {}),
        ...(query.requestId ? { requestId: query.requestId } : {}),
        ...(query.recordId ? { recordId: query.recordId } : {}),
        ...(cursor ? { cursor } : {}),
      },
      actor,
    );
    for (const item of result.items) {
      const key = item.source + ':' + item.id;
      if (seen.has(key))
        throw new ServiceUnavailableException(
          'تاریخچه هم‌زمان تغییر کرده است؛ دوباره خروجی بگیرید.',
        );
      seen.add(key);
      items.push(item);
    }
    if (items.length > FINANCE_EXPORT_LIMIT)
      throw new BadRequestException(
        'تاریخچه بیش از ۲۰۰۰ ردیف است؛ منبع یا درخواست را محدود کنید.',
      );
    if (result.nextCursor && result.nextCursor === cursor)
      throw new ServiceUnavailableException('صفحه تاریخچه معتبر نیست.');
    cursor = result.nextCursor;
  } while (cursor);
  if (scope === 'RECEIPT' && items.length !== 1)
    throw new NotFoundException('تراکنش ثبت‌شده مجاز برای این رسید یافت نشد.');
  return {
    ...common,
    title:
      scope === 'RECEIPT'
        ? 'رسید ثبت دریافت / پرداخت'
        : 'گزارش تاریخچه دریافت و پرداخت',
    columns: [
      column('شناسه تراکنش'),
      column('منبع'),
      column('نوع'),
      column('شرح / ذی‌نفع'),
      column('شناسه درخواست'),
      column('زمان ثبت / انتقال (تهران)', 'DATE'),
      column('ارز'),
      column('مبلغ این نوبت', 'DECIMAL'),
      column('حساب'),
      column('روش'),
      column('شماره پیگیری'),
      column('نوبت'),
      column('جمع پرداخت تا این نوبت', 'DECIMAL'),
      column('مانده پس از این نوبت', 'DECIMAL'),
    ],
    rows: items.map((item) => [
      item.id,
      financeSourceNames[item.source] ?? item.source,
      item.direction === 'RECEIPT' ? 'دریافت' : 'پرداخت',
      item.title,
      item.requestId,
      item.occurredAt,
      item.currencyCode,
      item.amount,
      item.accountTitle,
      item.method,
      item.reference,
      item.installment?.toString() ?? null,
      item.cumulativePaid,
      item.remainingAmount,
    ]),
    totals:
      new Set(items.map((item) => item.direction)).size > 1
        ? []
        : totals(
            items.map((item) => ({
              amount: item.amount,
              currencyCode: item.currencyCode,
            })),
          ),
    warnings: [
      'این رسید گواه ثبت داخلی تراکنش است؛ رسید بانکی یا سند حسابداری قانونی نیست.',
      'پرداخت جزئی فقط همین نوبت را تأیید می‌کند؛ مانده درج‌شده مربوط به زمان ثبت این نوبت است.',
    ],
  };
}
