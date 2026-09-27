import {
  formatHeaderDate,
  headerDateKey,
  HEADER_DATE_TIME_ZONE,
} from '@/lib/header-today';

const timestampFields = new Set([
  'createdAt',
  'updatedAt',
  'occurredAt',
  'submittedAt',
  'decidedAt',
  'generatedAt',
]);
const dateFields = new Set([
  'requiredAt',
  'quotedAt',
  'validUntil',
  'deliveryAt',
  'expectedAt',
  'dueAt',
  'issuedAt',
  'receivedAt',
  'acceptedAt',
  'returnedAt',
]);
const timeFormatter = new Intl.DateTimeFormat('fa-IR', {
  timeZone: HEADER_DATE_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
const actionLabels: Record<string, string> = {
  CREATE: 'ایجاد درخواست',
  UPDATE: 'ویرایش درخواست',
  PUBLISH: 'انتشار درخواست',
  APPROVE: 'تأیید درخواست',
  REJECT: 'رد درخواست',
  RETURN: 'بازگشت برای اصلاح',
  CANCEL: 'لغو درخواست',
  ASSIGN: 'تخصیص مسئول',
};
const statusLabels: Record<string, string> = {
  DRAFT: 'پیش‌نویس',
  SUBMITTED: 'ارسال‌شده',
  IN_REVIEW: 'در بررسی',
  APPROVED: 'تأییدشده',
  REJECTED: 'ردشده',
  RETURNED: 'نیازمند اصلاح',
  SOURCING: 'در حال تأمین',
  ORDERED: 'سفارش‌شده',
  PARTIALLY_RECEIVED: 'دریافت ناقص',
  RECEIVED: 'دریافت‌شده',
  CLOSED: 'بسته‌شده',
  CANCELLED: 'لغوشده',
};

export function formatProcurementDate(
  value: unknown,
  includeTime = false,
): string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?$/.test(value)
  )
    return '—';
  const parsed = new Date(value);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value.slice(0, 10)
  )
    return '—';
  const day = value.length === 10 ? value : headerDateKey(parsed);
  const formatted = formatHeaderDate(day);
  return includeTime && value.length > 10
    ? `${formatted}، ساعت ${timeFormatter.format(parsed)} (تهران)`
    : formatted;
}

export function formatProcurementRecordValue(
  key: string,
  value: unknown,
): string {
  if (timestampFields.has(key) || dateFields.has(key))
    return formatProcurementDate(value, timestampFields.has(key));
  const text = String(value);
  if (key === 'action') return actionLabels[text] ?? text;
  if (key === 'status') return statusLabels[text] ?? text;
  return text;
}

export function exportScanSnapshotText(scanStatus: string): string {
  const initial =
    scanStatus === 'CLEAN'
      ? 'پاک و مجاز'
      : ['PENDING', 'PENDING_SCAN', 'AWAITING_ANTIVIRUS_ADAPTER'].includes(
            scanStatus,
          )
        ? 'در انتظار بررسی'
        : scanStatus;
  return `وضعیت اولیه اسکن هنگام ثبت خروجی: ${initial}. وضعیت جاری و دریافت فایل را در اسناد بررسی کنید.`;
}
