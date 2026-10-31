/** Stored only in an exclusive per-user role. Never inferred from a job title. */
export * from './call-center-access';
export * from './manual-access-prerequisites';
export const MANUAL_ACCESS_VERSION = 'ui.manual.v3' as const;
export const MANUAL_ACCESS_ROLE_PREFIX = 'manual-access-v3-' as const;
export const MANUAL_NEW_PERMISSIONS = [
  ['b2b.portal.passengers.read', 'مشاهده مسافران آژانس خود'],
  [
    'b2b.portal.passengers.update',
    'ویرایش SSR / جزئیات هویتی مسافران آژانس به‌جز نام‌ها',
  ],
] as const;
export const PORTAL_SECTION_PERMISSIONS = [
  'b2b.portal.section.organization',
  'b2b.portal.section.access',
  'b2b.portal.section.contracts',
  'b2b.portal.section.credit',
  'b2b.portal.section.finance',
  'b2b.portal.section.audit',
] as const;
export const allowAccessControl = (id: string): `ui.allow.${string}` =>
  `ui.allow.${id}`;

export interface ManualAccessSelection {
  permissionCodes: string[];
  screenIds: string[];
  allowedControlIds: string[];
}

export const MANUAL_ACCESS_SECTIONS = [
  ['workbench', 'میزکار من'],
  ['dashboard', 'داشبورد و دستیار هوشمند'],
  ['customers', 'مشتریان و پرونده مسافر'],
  ['call-center', 'کال سنتر'],
  ['customer-affairs', 'امور مشتریان و پشتیبانی'],
  ['sales', 'قراردادها و فروش'],
  ['flight-pricing', 'قیمت‌گذاری پرواز'],
  ['packages', 'مدیریت پکیج و پک جنریتور'],
  ['tours', 'تعریف تور و خدمات'],
  ['reservations', 'رزرواسیون و جزئیات مسافر'],
  ['hotel-rates', 'قیمت خرید هتل'],
  ['ticket-catalog', 'تعریف و ظرفیت پرواز'],
  ['ticket-purchases', 'خرید و تأمین خدمات سفر'],
  ['procurement', 'تنخواه و خرید عمومی'],
  ['finance', 'کارتابل مالی و تحویل مدارک'],
  ['accounting', 'حسابداری و مالیاتی'],
  ['organizations', 'مشتریان B2B و پرتال آژانس'],
  ['marketing', 'مارکتینگ'],
  ['hr', 'منابع انسانی'],
  ['documents', 'اسناد و فایل‌ها'],
  ['reports', 'گزارش‌ها'],
  ['correspondence', 'مکاتبات'],
  ['system', 'مدیریت سیستم و کاربران'],
  ['master-data', 'اطلاعات پایه'],
  ['integrations', 'یکپارچه‌سازی‌ها'],
] as const;

export function manualSectionForScreen(screen: {
  id: string;
  group: string;
  route: string;
}) {
  if (screen.group === 'integrations') return 'integrations';
  if (screen.route === '/customer-affairs/call-center') return 'call-center';
  if (screen.route.startsWith('/sales/ticket-prices')) return 'flight-pricing';
  if (screen.route.startsWith('/sales/pricing')) return 'packages';
  if (screen.route.startsWith('/sales/tours') || screen.id.includes('.tours'))
    return 'tours';
  if (screen.route.startsWith('/reservations/hotel-rates'))
    return 'hotel-rates';
  if (screen.route.startsWith('/ticket-purchases')) return 'ticket-purchases';
  if (screen.route.startsWith('/finance/accounting')) return 'accounting';
  if (screen.group === 'assistant') return 'dashboard';
  return screen.group;
}

export function manualSectionForPermission(code: string): string {
  if (code.startsWith('customer_affairs.call_center.')) return 'call-center';
  if (code.startsWith('finance.accounting.')) return 'accounting';
  if (code.startsWith('finance.ticket_pricing.')) return 'flight-pricing';
  if (code.startsWith('assistant.')) return 'dashboard';
  if (code.startsWith('ticket_catalog.tours.')) return 'tours';
  if (code.startsWith('package_pricing.')) return 'packages';
  if (code.startsWith('reporting.')) return 'reports';
  if (code.startsWith('master_data.')) return 'master-data';
  if (code.startsWith('customer_affairs.')) return 'customer-affairs';
  if (code.startsWith('ticket_catalog.')) return 'ticket-catalog';
  if (code.startsWith('b2b.')) return 'organizations';
  if (
    code.startsWith('iam.') ||
    code.startsWith('system.') ||
    code.startsWith('legal-entity.')
  )
    return 'system';
  if (code.startsWith('messaging.')) return 'workbench';
  const group = code.split('.')[0]!;
  // Registered extension permissions must remain visible and revocable.
  return MANUAL_ACCESS_SECTIONS.some(([id]) => id === group) ? group : 'system';
}
