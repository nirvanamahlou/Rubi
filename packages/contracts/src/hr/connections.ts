/** Additive HR referral contract. Replies are not destination execution receipts. */
export const HR_CONNECTIONS_VERSION = 1 as const;
export const HR_CONNECTION_TARGETS = [
  'tasks',
  'sales',
  'customers',
  'customer-affairs',
  'organizations',
  'marketing',
  'reservations',
  'finance',
  'purchases',
  'documents',
  'master-data',
  'integrations',
  'system',
] as const;
export type HrConnectionTarget = (typeof HR_CONNECTION_TARGETS)[number];
export const HR_CONNECTION_PERMISSION_CODES = HR_CONNECTION_TARGETS.map(
  (target) => `hr.connections.${target}.receive` as const,
);
export const HR_CONNECTION_MODULES = [
  {
    key: 'dashboard',
    title: 'داشبورد',
    path: '/dashboard',
    purpose: 'نمای وضعیت و پیگیری درخواست‌های بین‌بخشی',
    mode: 'REPORT',
  },
  {
    key: 'tasks',
    title: 'میز کار',
    path: '/tasks',
    purpose: 'ارجاع کار، تعیین تکلیف و پیگیری پاسخ',
    mode: 'REFERRAL',
  },
  {
    key: 'sales',
    title: 'قرارداد',
    path: '/sales',
    purpose: 'تعیین جانشین پرونده‌ها و بررسی پاداش فروش',
    mode: 'REFERRAL',
  },
  {
    key: 'customers',
    title: 'مشتریان و مسافران',
    path: '/customers',
    purpose: 'بررسی ارتباط کارمند با پرونده مستقل مشتری یا مسافر',
    mode: 'REFERRAL',
  },
  {
    key: 'customer-affairs',
    title: 'امور مشتریان، سرنخ‌ها و پشتیبانی',
    path: '/customer-affairs',
    purpose: 'تحویل پرونده‌های باز و درخواست شاخص عملکرد',
    mode: 'REFERRAL',
  },
  {
    key: 'organizations',
    title: 'آژانس‌ها و مشتریان سازمانی',
    path: '/organizations',
    purpose: 'تعیین جانشین مدیر حساب و تحویل حساب‌های سازمانی',
    mode: 'REFERRAL',
  },
  {
    key: 'marketing',
    title: 'مارکتینگ',
    path: '/marketing',
    purpose: 'تحویل مسئولیت کمپین و درخواست شاخص عملکرد',
    mode: 'REFERRAL',
  },
  {
    key: 'reservations',
    title: 'رزرواسیون و عملیات سفر',
    path: '/reservations',
    purpose: 'پیگیری تأمین سفر مأموریت مصوب',
    mode: 'REFERRAL',
  },
  {
    key: 'ticket-management',
    title: 'مدیریت و تعریف بلیط‌ها',
    path: '/ticket-management',
    purpose: 'تأمین بلیط مأموریت از مسیر رزرواسیون',
    mode: 'VIA_RESERVATIONS',
  },
  {
    key: 'finance',
    title: 'مالی و خزانه‌داری',
    path: '/finance',
    purpose: 'بررسی ورودی پرداخت، مساعده، هزینه مأموریت و تسویه',
    mode: 'REFERRAL',
  },
  {
    key: 'purchases',
    title: 'خرید و تأمین',
    path: '/purchases',
    purpose: 'پیگیری خرید تجهیزات و خدمات آموزشی کارکنان',
    mode: 'REFERRAL',
  },
  {
    key: 'documents',
    title: 'اسناد و فایل‌ها',
    path: '/documents',
    purpose: 'آرشیو مدارک و پیگیری تکمیل پرونده اسناد',
    mode: 'REFERRAL',
  },
  {
    key: 'reports',
    title: 'گزارش‌ها',
    path: '/reports',
    purpose: 'گزارش وضعیت درخواست‌ها با دسترسی به مبنا',
    mode: 'REPORT',
  },
  {
    key: 'master-data',
    title: 'اطلاعات پایه',
    path: '/master-data',
    purpose: 'درخواست اصلاح یا تکمیل مرجع مشترک',
    mode: 'REFERRAL',
  },
  {
    key: 'integrations',
    title: 'یکپارچه‌سازی‌ها',
    path: '/integrations',
    purpose: 'پیگیری اتصال دستگاه تردد یا سامانه بیرونی',
    mode: 'REFERRAL',
  },
  {
    key: 'system',
    title: 'مدیریت سیستم',
    path: '/system',
    purpose: 'درخواست ایجاد، بازبینی یا قطع دسترسی کارمند',
    mode: 'REFERRAL',
  },
] as const;
export const HR_CONNECTION_STATUS_LABELS = {
  SUBMITTED: 'ارسال‌شده',
  IN_REVIEW: 'در حال رسیدگی',
  ANSWERED: 'پاسخ دریافت شد',
  REJECTED: 'ردشده',
  CANCELLED: 'لغوشده',
} as const;
export type HrConnectionStatus = keyof typeof HR_CONNECTION_STATUS_LABELS;
export interface HrConnectionDto {
  id: string;
  code: string;
  branchId: string;
  target: HrConnectionTarget;
  title: string;
  message: string;
  sourceCode: string;
  sourceVersion: number;
  sourceHref: string | null;
  employeeLabel: string | null;
  status: HrConnectionStatus;
  version: number;
  dueAt: string;
  createdAt: string;
  updatedAt: string;
  response: string | null;
  canRespond: boolean;
  canCancel: boolean;
  history: {
    action: string;
    status: HrConnectionStatus;
    note: string;
    occurredAt: string;
  }[];
}
export interface HrConnectionCreate {
  target: HrConnectionTarget;
  sourceId: string;
  sourceVersion: number;
  title: string;
  message: string;
  dueAt: string;
}
export interface HrConnectionDecision {
  version: number;
  status: Exclude<HrConnectionStatus, 'SUBMITTED'>;
  note: string;
}
export interface HrConnectionList {
  items: HrConnectionDto[];
  total: number;
  page: number;
  pageSize: number;
  canSend: boolean;
  targets: HrConnectionTarget[];
  counts: Record<HrConnectionStatus, number> & { overdue: number };
}
export function hrConnectionModule(pathname: string) {
  return HR_CONNECTION_MODULES.find(
    (item) => pathname === item.path || pathname.startsWith(`${item.path}/`),
  );
}
