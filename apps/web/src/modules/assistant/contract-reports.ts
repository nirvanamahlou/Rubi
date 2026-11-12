import type {
  SalesContractDetail,
  SalesContractSummary,
} from '@nora/contracts';
import { salesApi } from '@/modules/sales/api/client';
import { paymentReceiptsApi } from '@/modules/sales/api/payment-receipts';
import { normalizeContractQuestion } from './contract-guides';
const date = (value: string) =>
  new Date(value).toLocaleString('fa-IR', { timeZone: 'Asia/Tehran' });
export function actionReason(row: SalesContractSummary) {
  if (['COMPLETED', 'CANCELLED'].includes(row.status)) return '';
  if (
    row.reservationStatus === 'REJECTED' ||
    row.reservationStatus === 'NEEDS_REVIEW'
  )
    return 'فروش و رزرواسیون: بررسی علت درخواست اصلاح';
  if (row.reservationContractChanged) return 'رزرواسیون: تطبیق اصلاحات قرارداد';
  if (row.reservationStatus === 'NOT_SENT') return 'فروش: بررسی تکمیل و ارسال';
  if (row.reservationStatus === 'PARTIALLY_FULFILLED')
    return 'رزرواسیون: پیگیری خدمات باقی‌مانده';
  if (row.settlementStatus === 'OVERPAID') return 'مالی: بررسی اضافه‌پرداخت';
  if (row.reservationStatus === 'QUEUED')
    return 'رزرواسیون: بررسی درخواست در صف';
  return '';
}
export function portfolioKind(message: string) {
  const q = normalizeContractQuestion(message);
  if (!/قرارداد/.test(q) || /قرارداد\s*(?:شماره\s*)?[a-z0-9]/i.test(q)) return;
  if (
    /متوقف|راکد|معطل/.test(q) &&
    /قراردادها|قرارداد های|کدام قرارداد|چه قرارداد/.test(q)
  )
    return 'stalled';
  if (
    /(?:^|\s)(?:من|خودم)(?:\s|$)|کارهایم/.test(q) &&
    /اقدام|پیگیری|کارهای/.test(q)
  )
    return 'mine';
}
export async function portfolioReport(message: string, userId: string) {
  const kind = portfolioKind(message);
  const page = Math.max(
    1,
    Number(
      normalizeContractQuestion(message).match(/صفحه\s+(\d{1,5})/)?.[1] ?? 1,
    ),
  );
  const list = await salesApi.list({
    ...(kind === 'mine' ? { ownerUserId: userId } : {}),
    page,
    pageSize: 10,
    sortBy: 'updatedAt',
    sortDirection: 'asc',
  });
  const rows: string[] = [];
  for (const row of list.data) {
    const reason = actionReason(row);
    if (!reason) continue;
    if (kind === 'mine') {
      rows.push(row.contractNumber + ' — ' + reason);
      continue;
    }
    const events = await salesApi
      .statusHistory(row.id)
      .then((r) => r.data)
      .catch(() => undefined);
    const event = events?.[0]?.toStatus === row.status ? events[0] : undefined;
    const days =
      event &&
      Math.floor((Date.now() - Date.parse(event.changedAt)) / 86400000);
    rows.push(
      row.contractNumber +
        ' — ' +
        reason +
        '؛ ' +
        (typeof days === 'number' && days >= 0
          ? days + ' روز از ورود به وضعیت قرارداد'
          : events
            ? 'زمان ورود به وضعیت ثبت نشده'
            : 'تاریخچه قابل بررسی نیست'),
    );
  }
  return [
    'صفحه ' +
      page +
      ' از ' +
      Math.max(1, Math.ceil(list.meta.total / list.meta.pageSize)) +
      ' فهرست مجاز، به ترتیب قدیمی‌ترین به‌روزرسانی',
    ...rows,
    !rows.length ? 'در این صفحه مورد نیازمند اقدام یافت نشد.' : '',
    list.meta.total > page * list.meta.pageSize
      ? 'برای ادامه همان گزارش را با شماره صفحه بعد بخواهید.'
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}
function reportError(error: unknown) {
  const status =
    typeof error === 'object' && error && 'status' in error
      ? error.status
      : undefined;
  return status === 403 || status === 401
    ? 'دسترسی به جزئیات این بخش برقرار نیست.'
    : status === 404
      ? 'منبع این بخش در محدوده مجاز پیدا نشد.'
      : 'دریافت جزئیات این بخش ناموفق بود.';
}
export async function recordReport(message: string, data: SalesContractDetail) {
  const q = normalizeContractQuestion(message);
  const lines: string[] = [];
  if (/تاریخچه|تغییرات|توقف|متوقف/.test(q)) {
    try {
      const events = (await salesApi.statusHistory(data.id)).data;
      lines.push(
        'تاریخچه وضعیت قرارداد (زمان تهران)',
        ...events.map(
          (e) => date(e.changedAt) + ' — ' + e.toStatus + ' — ' + e.reason,
        ),
      );
      if (!events.length) lines.push('رویداد تغییر وضعیت ثبت نشده است.');
    } catch (error) {
      lines.push(reportError(error));
    }
  }
  if (/تغییرات|ممیزی/.test(q)) {
    try {
      const audit = (await salesApi.contractAudit(data.id)).data;
      lines.push(
        ...audit.map((e) =>
          [date(e.occurredAt), e.action, e.outcome].join(' — '),
        ),
      );
      if (!audit.length) lines.push('رویداد ممیزی ثبت نشده است.');
    } catch (error) {
      lines.push(reportError(error));
    }
  }
  if (/رسید|مغایرت|وصول|سررسید/.test(q)) {
    try {
      const entries = (await paymentReceiptsApi.entries(data.id)).data;
      for (const payment of data.payments) {
        const entry = entries.find((item) => item.id === payment.id);
        const count = entry
          ? (await paymentReceiptsApi.list(data.id, payment.id)).meta.total
          : undefined;
        lines.push(
          [
            payment.amount + ' ' + payment.currencyCode,
            {
              SCHEDULED: 'برنامه‌ریزی‌شده',
              PENDING_FINANCE_CONFIRMATION: 'در انتظار تأیید مالی',
              FINANCE_CONFIRMED: 'تأیید مالی',
              FINANCE_REJECTED: 'رد مالی',
              FINANCE_VOIDED: 'باطل‌شده',
            }[payment.status],
            payment.status === 'SCHEDULED' &&
            Date.parse(payment.dueAt) < Date.now()
              ? 'سررسید گذشته'
              : '',
            'سررسید ' + date(payment.dueAt),
            count === undefined
              ? 'مدرک در فهرست قابل بررسی نیست'
              : 'تعداد مدارک ثبت‌شده: ' + count,
            payment.financeDecisionReason,
          ]
            .filter(Boolean)
            .join(' — '),
        );
      }
      if (!data.payments.length) lines.push('پرداخت ثبت‌شده ندارد.');
    } catch (error) {
      lines.push(reportError(error));
    }
  }
  if (/مدرک|مدارک|خدمت|خدمات|ناقص/.test(q)) {
    lines.push(
      data.customerDocumentDeliveryApproved === undefined
        ? 'اطلاعات تأیید تحویل در این پاسخ موجود نیست.'
        : data.customerDocumentDeliveryApproved
          ? 'مجوز مالی تحویل ثبت شده؛ صدور هر مدرک را جداگانه در پرونده بررسی کنید.'
          : 'تحویل مدارک هنوز تأیید مالی ندارد.',
    );
    for (const service of data.servicesDetail ?? [])
      lines.push(
        [service.titleSnapshot || service.kind, service.status]
          .filter(Boolean)
          .join(' — '),
      );
    if (data.isFloating && data.status !== 'CANCELLED') {
      try {
        const intake = (await salesApi.readPurchaseContext(data.id)).data;
        if (intake.ticketDocuments)
          lines.push(
            'تعداد بلیت‌های صادرشده: ' + intake.ticketDocuments.length,
          );
        for (const p of intake.servicePurchases ?? [])
          lines.push([p.currencyCode, p.amount, p.finance.status].join(' — '));
      } catch (error) {
        lines.push(reportError(error));
      }
    }
    if (data.reservationContractChanged)
      lines.push(
        'قرارداد پس از ارسال تغییر کرده است؛ نسخه خدمات و مدارک را با رزرواسیون تطبیق دهید.',
      );
    if (data.reservationStatus === 'PARTIALLY_FULFILLED')
      lines.push(
        'بخشی از خدمات اجرا شده؛ از این وضعیت کلی نمی‌توان خدمت اجرا‌نشده را تعیین کرد.',
      );
  }
  return lines.join('\n');
}
