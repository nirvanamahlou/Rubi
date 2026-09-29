import {
  USER_ACCESS_GROUPS,
  USER_ACCESS_SCREENS,
  USER_JOB_TITLES,
  canViewScreen,
} from '@nora/contracts';

const common = ['legal-entity.read', 'legal-entity.switch', 'hr.self'];
const documentRead = [
  'documents.list',
  'documents.metadata.read',
  'documents.file.read',
  'documents.download',
];
const customerRead = ['customers.read'];
const travelRead = [
  'reservations.read',
  'ticket_catalog.read',
  'master_data.read',
];
const financeRead = [
  'finance.read',
  'finance.financial_release.read',
  'sales.payments.read',
];
const profiles: Record<
  string,
  { groups: string[]; permissions: string[]; reason: string }
> = {
  [USER_JOB_TITLES[1]]: {
    groups: ['workbench', 'customers', 'sales', 'ticket-catalog', 'documents'],
    permissions: [
      ...common,
      ...customerRead,
      ...documentRead,
      'customers.create',
      'customers.update',
      'ticket_catalog.read',
      'master_data.read',
      'sales.contracts.read.own',
      'sales.contracts.create',
      'sales.contracts.update.own',
      'sales.contracts.confirm',
      'sales.payments.create',
      'sales.payments.read',
      'sales.reservation_request.create',
      'package_pricing.read',
      'package_pricing.quote.create',
      'package_pricing.render',
      'documents.upload',
      'documents.sales.read',
      'documents.travel.read',
      'documents.customer_identity.read',
    ],
    reason:
      'کار با مشتری، قراردادهای خود کاربر، دریافت وجه و درخواست رزرواسیون؛ بدون تأیید مالی یا مدیریت کاربران.',
  },
  [USER_JOB_TITLES[2]]: {
    groups: ['workbench', 'finance', 'reports', 'documents'],
    permissions: [
      ...common,
      ...documentRead,
      ...financeRead,
      'finance.receipt.approve',
      'finance.payment.create',
      'finance.account.manage',
      'finance.financial_release.approve',
      'reporting.read',
      'reporting.finance.read',
      'reporting.export',
      'documents.finance.read',
      'documents.procurement.read',
      'documents.upload',
      'hr.connections.finance.receive',
    ],
    reason:
      'مدیریت حساب‌ها، پرداخت و تأیید مالی، همراه گزارش‌های مالی؛ بدون مدیریت کاربران و امنیت سامانه.',
  },
  [USER_JOB_TITLES[3]]: {
    groups: ['workbench', 'reports'],
    permissions: [
      ...common,
      'reporting.read',
      'reporting.sales.read',
      'reporting.procurement.read',
      'reporting.finance.read',
      'reporting.reservations.read',
      'reporting.tickets.read',
      'reporting.b2b.read',
    ],
    reason:
      'مشاهده گزارش‌ها برای تحلیل؛ تغییر اطلاعات عملیاتی، خروجی و اشتراک‌گذاری باید جداگانه انتخاب شوند.',
  },
  [USER_JOB_TITLES[4]]: {
    groups: ['workbench', 'customers', 'customer-affairs', 'documents'],
    permissions: [
      ...common,
      ...customerRead,
      ...documentRead,
      'customer_affairs.lead.read',
      'customer_affairs.lead.create',
      'customer_affairs.lead.update',
      'customer_affairs.lead.qualify',
      'customer_affairs.lead.handoff.propose',
      'customer_affairs.ticket.read',
      'customer_affairs.ticket.create',
      'customer_affairs.ticket.update',
      'customer_affairs.ticket.assign',
      'customer_affairs.ticket.escalate',
      'customer_affairs.ticket.close',
      'customer_affairs.ticket.reopen',
      'customer_affairs.satisfaction.read',
      'customer_affairs.satisfaction.record',
      'documents.customer_identity.read',
    ],
    reason:
      'رسیدگی به سرنخ‌ها و درخواست‌های پشتیبانی؛ بدون مجوز مالی، امنیت یا تغییر قرارداد.',
  },
  [USER_JOB_TITLES[5]]: {
    groups: [
      'workbench',
      'reservations',
      'ticket-catalog',
      'customers',
      'documents',
    ],
    permissions: [
      ...common,
      ...travelRead,
      ...customerRead,
      ...documentRead,
      'reservations.arrangements.update',
      'reservations.documents.manage',
      'sales.contracts.read.branch',
      'documents.travel.read',
      'documents.customer_identity.read',
      'documents.upload',
    ],
    reason:
      'مشاهده بلیت و مسافر، تنظیم رزرو و اسناد سفر؛ تعریف بلیت و ثبت خرید هتل برای مدیر رزرواسیون است.',
  },
  [USER_JOB_TITLES[6]]: {
    groups: [
      'workbench',
      'reservations',
      'ticket-catalog',
      'customers',
      'documents',
      'reports',
    ],
    permissions: [
      ...common,
      ...travelRead,
      ...customerRead,
      ...documentRead,
      'reservations.arrangements.update',
      'reservations.documents.manage',
      'reservations.hotel_purchase.write',
      'ticket_catalog.manage',
      'sales.contracts.read.branch',
      'documents.travel.read',
      'documents.customer_identity.read',
      'documents.upload',
      'reporting.read',
      'reporting.reservations.read',
      'reporting.tickets.read',
    ],
    reason:
      'عملیات رزرواسیون، مدیریت بلیت و خرید هتل، همراه گزارش‌های سفر؛ تأیید مالی جدا می‌ماند.',
  },
  [USER_JOB_TITLES[7]]: {
    groups: ['workbench', 'finance', 'documents'],
    permissions: [
      ...common,
      ...financeRead,
      ...documentRead,
      'finance.payment.create',
      'documents.finance.read',
      'documents.upload',
      'hr.connections.finance.receive',
    ],
    reason:
      'مشاهده مالی و ثبت پرداخت؛ تأیید دریافت، آزادسازی مالی و مدیریت حساب‌ها برای مدیر مالی است.',
  },
  [USER_JOB_TITLES[8]]: {
    groups: ['workbench', 'hr', 'documents'],
    permissions: [
      ...common,
      ...documentRead,
      'hr.read',
      'hr.manage',
      'hr.directory.read',
      'hr.team',
      'documents.hr.read',
      'documents.upload',
    ],
    reason:
      'پرونده‌ها و امور روزمره منابع انسانی؛ تأییدها و اطلاعات حساس باید جداگانه انتخاب شوند.',
  },
  [USER_JOB_TITLES[9]]: {
    groups: ['workbench', 'customers', 'reservations', 'documents'],
    permissions: [
      ...common,
      ...customerRead,
      ...documentRead,
      'customers.sensitive.read',
      'reservations.read',
      'reservations.documents.manage',
      'documents.customer_identity.read',
      'documents.travel.read',
      'documents.sensitive.read',
      'documents.upload',
    ],
    reason:
      'مشاهده مسافر و مدارک هویتی و سفر برای پیگیری ویزا؛ بدون تغییر خرید، قرارداد یا مالی.',
  },
};
export interface AssignablePermission {
  id: string;
  code: string;
  name: string;
}
export function recommendRoleAccess(
  title: string,
  permissions: readonly AssignablePermission[],
  actorPermissions: readonly string[],
) {
  const administrator = title === USER_JOB_TITLES[0];
  const profile = profiles[title];
  const groups = administrator
    ? USER_ACCESS_GROUPS.map((group) => group.id)
    : (profile?.groups ?? []);
  const screens = USER_ACCESS_SCREENS.filter(
    (screen) =>
      groups.includes(screen.group) &&
      canViewScreen(actorPermissions, screen.id),
  );
  const native = permissions.filter(
    (permission) =>
      actorPermissions.includes(permission.code) &&
      (administrator || profile?.permissions.includes(permission.code)),
  );
  return {
    screenIds: screens.map((screen) => screen.id),
    permissionIds: [...new Set(native.map((permission) => permission.id))],
    permissions: native,
    groups: USER_ACCESS_GROUPS.filter((group) =>
      screens.some((screen) => screen.group === group.id),
    ),
    reason: administrator
      ? 'مدیریت تمام بخش‌ها، فقط در محدوده مجوزهای قابل واگذاری شما.'
      : (profile?.reason ??
        'برای این نقش پیشنهاد ثبت نشده است؛ دسترسی‌ها را دستی انتخاب کنید.'),
  };
}
