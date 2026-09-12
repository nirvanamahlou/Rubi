import { hrApi } from '@/modules/hr/hr-api';
export const HR_WORKBENCH_CHANGED = 'rubi:hr-server-change';
export function canReadWorkbenchHr(permissions: readonly string[]) {
  return ['hr.read', 'hr.manage', 'hr.self', 'hr.team'].some((permission) =>
    permissions.includes(permission),
  );
}
export async function readWorkbenchHrNotification(
  id: string,
  read = hrApi.readNotification,
  notify = () => window.dispatchEvent(new Event(HR_WORKBENCH_CHANGED)),
) {
  await read(id);
  notify();
}
export const workbenchDestinations = [
  {
    href: '/hr',
    title: 'درخواست‌های منابع انسانی',
    description: 'مرخصی، مأموریت و پرونده کارکنان در سامانه منابع انسانی',
    prefixes: ['hr.'],
  },
  {
    href: '/sales',
    title: 'فروش و قراردادها',
    description: 'ثبت و پیگیری در پرونده اصلی فروش',
    prefixes: ['sales.'],
  },
  {
    href: '/reservations',
    title: 'رزرواسیون و عملیات سفر',
    description: 'پیگیری عملیات اجرایی سفر در ماژول مسئول',
    prefixes: ['reservations.'],
  },
  {
    href: '/finance',
    title: 'مالی و خزانه‌داری',
    description: 'ورود به بخش مالی؛ ثبت عملیات مالی از میزکار فعال نیست',
    prefixes: ['finance.'],
  },
  {
    href: '/purchases',
    title: 'خرید و تأمین',
    description: 'ورود به بخش خرید؛ اتصال اجرایی درخواست خرید هنوز آماده نیست',
    prefixes: ['procurement.'],
  },
  {
    href: '/organizations',
    title: 'آژانس‌ها و مشتریان سازمانی',
    description: 'پیگیری توافق‌ها و مدارک در پرونده سازمان',
    prefixes: ['b2b.'],
  },
] as const;
export function allowedWorkbenchDestinations(permissions: readonly string[]) {
  return workbenchDestinations.filter((destination) =>
    destination.href === '/hr'
      ? canReadWorkbenchHr(permissions)
      : permissions.some((permission) =>
          destination.prefixes.some((prefix) => permission.startsWith(prefix)),
        ),
  );
}
