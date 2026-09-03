import type { DocumentListQueryV1 } from '@rubi/contracts';

export type ArchiveToolKey = 'categories' | 'owners' | 'retention' | 'recovery';

export interface ArchiveToolDefinition {
  key: ArchiveToolKey;
  label: string;
  description: string;
  notice: string;
  query: Partial<DocumentListQueryV1>;
}

export const archiveTools: readonly ArchiveToolDefinition[] = [
  {
    key: 'categories',
    label: 'مدارک ناقص و دسته‌بندی',
    description:
      'مدارک علامت‌گذاری‌شده به‌عنوان ناقص را برای تکمیل اطلاعات باز می‌کند.',
    notice:
      'فهرست مدارک ناقص باز شد؛ از ویرایش برای تکمیل یا تغییر دسته‌بندی استفاده کنید.',
    query: { completion: 'INCOMPLETE' },
  },
  {
    key: 'owners',
    label: 'اسناد تحت مسئولیت من',
    description: 'فقط اسنادی را نشان می‌دهد که مالک آن‌ها کاربر جاری است.',
    notice: 'فیلتر مالک فایل روی کاربر جاری فعال شد.',
    query: { personalView: 'OWNED' },
  },
  {
    key: 'retention',
    label: 'نگهداری و انقضا',
    description:
      'اسناد نزدیک انقضا را برای تمدید یا تکمیل اطلاعات نشان می‌دهد.',
    notice: 'فیلتر اسناد نزدیک انقضا فعال شد.',
    query: { validity: 'EXPIRING' },
  },
  {
    key: 'recovery',
    label: 'بازیابی اسناد آرشیوشده',
    description:
      'اسناد آرشیوشده را نشان می‌دهد تا با عملیات بازیابی دوباره فعال شوند.',
    notice: 'فیلتر اسناد آرشیوشده فعال شد.',
    query: { archiveStatus: 'ARCHIVED' },
  },
] as const;
