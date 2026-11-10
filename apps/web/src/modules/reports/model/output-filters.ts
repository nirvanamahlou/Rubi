export interface ReportColumnFilter {
  key: string;
  label: string;
  options: readonly string[];
}
export function isOutputFilterKey(key: string) {
  return key === 'search' || /^column[A-Z][A-Za-z0-9]*$/.test(key);
}
export function reportFilterDisplayLabel(
  value: string,
  context?: string,
): string {
  const label = context?.replace(/^ستون /, '');
  if (
    label &&
    !label.startsWith('وضعیت') &&
    ![
      'نوع خدمت',
      'نوع مشتری',
      'نوع تراکنش',
      'روش دریافت',
      'اولویت',
      'ماژول مبدأ سند',
    ].includes(label)
  )
    return value;
  return (
    (
      {
        RECEIVED: 'دریافت‌شده',
        PROCESSING: 'در حال پردازش',
        PENDING_REVIEW: 'در انتظار بررسی',
        APPROVED: 'تأییدشده',
        REJECTED: 'ردشده',
        CANCELLED: 'باطل‌شده',
        CONFIRMED: 'تأییدشده',
        COMPLETED: 'تکمیل‌شده',
        DRAFT: 'پیش‌نویس',
        IN_PROGRESS: 'در دست اقدام',
        NO_FILE: 'بدون فایل',
        UNSCANNED: 'اسکن‌نشده',
        SALES: 'فروش',
        RESERVATIONS: 'رزرواسیون',
        DOCUMENTS: 'اسناد',
        WORKBENCH: 'میز کار',
        CUSTOMERS: 'مشتریان',
        HR: 'منابع انسانی',
        FINANCE: 'مالی',
        ORGANIZATION: 'مشتری سازمانی',
        INDIVIDUAL: 'مشتری حقیقی',
        FLIGHT: 'پرواز',
        HOTEL: 'هتل',
        TOUR: 'تور',
        INSURANCE: 'بیمه',
        VISA: 'ویزا',
        TRANSFER: 'ترانسفر',
        CASH: 'نقدی',
        BANK: 'بانکی',
        CARD: 'کارت',
        CHEQUE: 'چک',
        RECEIPT: 'دریافت',
        REFUND: 'استرداد',
        PLANNED: 'برنامه‌ریزی‌شده',
        NORMAL: 'عادی',
        HIGH: 'بالا',
        URGENT: 'فوری',
        LOW: 'کم',
        OPEN: 'باز',
        CLOSED: 'بسته',
        RESOLVED: 'رسیدگی‌شده',
        READY: 'آماده',
        PENDING: 'در انتظار',
        FAILED: 'ناموفق',
        CLEAN: 'سالم',
        INFECTED: 'آلوده',
        QUEUED: 'در صف',
        GENERATING: 'در حال تولید',
        EXPIRED: 'منقضی',
      } as Readonly<Record<string, string>>
    )[value] ?? value
  );
}
