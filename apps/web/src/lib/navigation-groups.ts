import type { NavigationHref } from '../messages/fa';

/** Sidebar presentation only: module routes, labels and permissions stay unchanged. */
export const navigationGroups = [
  {
    id: 'work',
    dotClass: 'bg-[#60a5fa]',
    title: 'فضای کار',
    hrefs: ['/workbench', '/dashboard'],
  },
  {
    id: 'sales',
    dotClass: 'bg-[#fb7185]',
    title: 'فروش و ارتباط با مشتری',
    hrefs: [
      '/sales',
      '/customers',
      '/customer-affairs',
      '/organizations',
      '/marketing',
      '/customer-affairs/call-center',
    ],
  },
  {
    id: 'operations',
    dotClass: 'bg-[#34d399]',
    title: 'رزرواسیون',
    hrefs: [
      '/reservations',
      '/reservations/reports',
      '/reservations/hotel-rates',
      '/ticket-management',
    ],
  },
  {
    id: 'ticket-purchases',
    dotClass: 'bg-[#7dd3fc]',
    title: 'خرید و تأمین',
    hrefs: ['/ticket-purchases'],
  },
  {
    id: 'finance',
    dotClass: 'bg-[#fbbf24]',
    title: 'مالی',
    hrefs: ['/finance', '/finance/requests', '/finance/delivery'],
  },
  {
    id: 'hr',
    dotClass: 'bg-[#c084fc]',
    title: 'سرمایه انسانی',
    hrefs: ['/human-resources', '/purchases'],
  },
  {
    id: 'resources',
    dotClass: 'bg-[#22d3ee]',
    title: 'اسناد و گزارش‌ها',
    hrefs: ['/documents', '/reports'],
  },
  {
    id: 'correspondence',
    dotClass: 'bg-[#818cf8]',
    title: 'مکاتبات',
    hrefs: ['/correspondence'],
  },
  {
    id: 'system',
    dotClass: 'bg-[#fb923c]',
    title: 'تنظیمات شرکت',
    hrefs: ['/system', '/master-data', '/integrations'],
  },
] as const satisfies readonly {
  id: string;
  dotClass: string;
  title: string;
  hrefs: readonly NavigationHref[];
}[];
