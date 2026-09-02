import type { DocumentListQueryV1 } from '@rubi/contracts';

export type ArchiveToolKey =
  | 'categories'
  | 'types'
  | 'quarantine'
  | 'owners'
  | 'retention'
  | 'recovery'
  | 'health'
  | 'processing';

export interface ArchiveToolDefinition {
  key: ArchiveToolKey;
  label: string;
  description: string;
  notice: string;
  query: Partial<DocumentListQueryV1>;
  useCurrentOwner?: boolean;
}

export const archiveTools: readonly ArchiveToolDefinition[] = [
  {
    key: 'categories',
    label: 'دسته‌بندی و برچسب',
    description: 'فهرست اسناد را برای انتخاب دسته‌بندی باز می‌کند.',
    notice: 'فهرست اسناد باز شد؛ دسته‌بندی موردنظر را از فیلتر انتخاب کنید.',
    query: {},
  },
  {
    key: 'types',
    label: 'سیاست نوع سند',
    description: 'نوع سند، اعتبار و سیاست‌های مرتبط را بررسی کنید.',
    notice: 'فهرست سیاست نوع سند باز شد؛ نوع موردنظر را از فیلتر انتخاب کنید.',
    query: { sortBy: 'title' },
  },
  {
    key: 'quarantine',
    label: 'بررسی و قرنطینه',
    description: 'فایل‌های قرنطینه‌شده و نیازمند بررسی را نشان می‌دهد.',
    notice: 'فیلتر قرنطینه فعال شد.',
    query: { scanStatus: 'QUARANTINED' },
  },
  {
    key: 'owners',
    label: 'مسئول و مالک فایل',
    description: 'اسناد متعلق به کاربر جاری را برای کنترل مالکیت باز می‌کند.',
    notice: 'فیلتر مالک فایل روی کاربر جاری فعال شد.',
    query: {},
    useCurrentOwner: true,
  },
  {
    key: 'retention',
    label: 'نگهداری و توقف حذف',
    description: 'اسناد نزدیک انقضا را برای پیگیری نگهداری نشان می‌دهد.',
    notice: 'فیلتر اسناد نزدیک انقضا فعال شد.',
    query: { validity: 'EXPIRING' },
  },
  {
    key: 'recovery',
    label: 'حذف منطقی و بازیابی',
    description: 'اسناد آرشیوشده و قابل بررسی برای بازیابی را نشان می‌دهد.',
    notice: 'فیلتر اسناد آرشیوشده فعال شد.',
    query: { archiveStatus: 'ARCHIVED' },
  },
  {
    key: 'health',
    label: 'سلامت آرشیو',
    description: 'فایل‌های اسکن‌شده و پاک آرشیو را نشان می‌دهد.',
    notice: 'فیلتر فایل‌های سالم و اسکن‌شده فعال شد.',
    query: { scanStatus: 'CLEAN' },
  },
  {
    key: 'processing',
    label: 'خروجی‌ها و پردازش‌ها',
    description: 'فایل‌های در صف اسکن و پردازش را نشان می‌دهد.',
    notice: 'فیلتر فایل‌های در حال پردازش فعال شد.',
    query: { scanStatus: 'PENDING_SCAN' },
  },
] as const;
