/** IAM-owned screen catalog consumed by the central Web access controls. */
export const USER_JOB_TITLES = [
  'مدیر',
  'کارشناس فروش',
  'مدیر مالی',
  'تیم هوش مصنوعی',
  'پشتیبان',
  'کارمند رزرواسیون',
  'مدیر رزرواسیون',
  'مالی',
  'منابع انسانی',
  'تیم ویزا',
  'مدیر فروش',
] as const;
export const USER_ACCESS_GROUPS = [
  {
    id: 'workbench',
    title: 'میزکار من',
    route: '/workbench',
    prefixes: ['workbench', 'messaging'],
  },
  {
    id: 'dashboard',
    title: 'داشبورد',
    route: '/dashboard',
    prefixes: ['reporting'],
  },
  {
    id: 'customers',
    title: 'مشتریان و مسافران',
    route: '/customers',
    prefixes: ['customers'],
  },
  {
    id: 'customer-affairs',
    title: 'امور مشتریان',
    route: '/customer-affairs',
    prefixes: ['customer_affairs'],
  },
  {
    id: 'reservations',
    title: 'رزرواسیون',
    route: '/reservations',
    prefixes: ['reservations'],
  },
  {
    id: 'ticket-catalog',
    title: 'مدیریت بلیط',
    route: '/ticket-management',
    prefixes: ['ticket_catalog'],
  },
  {
    id: 'sales',
    title: 'قراردادها و فروش',
    route: '/sales',
    prefixes: ['sales', 'package_pricing', 'ticket_catalog.tours'],
  },
  {
    id: 'procurement',
    title: 'خرید و تامین',
    route: '/purchases',
    prefixes: ['procurement'],
  },
  {
    id: 'finance',
    title: 'مالی و خزانه‌داری',
    route: '/finance',
    prefixes: ['finance'],
  },
  {
    id: 'marketing',
    title: 'مارکتینگ',
    route: '/marketing',
    prefixes: ['marketing'],
  },
  {
    id: 'organizations',
    title: 'آژانس‌ها و مشتریان سازمانی',
    route: '/organizations',
    prefixes: ['b2b'],
  },
  {
    id: 'hr',
    title: 'منابع انسانی',
    route: '/human-resources',
    prefixes: ['hr'],
  },
  {
    id: 'documents',
    title: 'اسناد و فایل‌ها',
    route: '/documents',
    prefixes: ['documents'],
  },
  {
    id: 'reports',
    title: 'گزارش‌ها',
    route: '/reports',
    prefixes: ['reporting'],
  },
  {
    id: 'integrations',
    title: 'یکپارچه‌سازی‌ها',
    route: '/integrations',
    prefixes: ['integrations'],
  },
  {
    id: 'system',
    title: 'مدیریت سیستم',
    route: '/system',
    prefixes: ['iam', 'system', 'legal-entity'],
  },
  {
    id: 'master-data',
    title: 'اطلاعات پایه',
    route: '/master-data',
    prefixes: ['master_data'],
  },
] as const;
export interface UserAccessScreen {
  id: string;
  group: string;
  title: string;
  route: string;
  tab?: string;
  query?: Record<string, string>;
}
export const USER_ACCESS_SCREENS: readonly UserAccessScreen[] = [
  {
    id: 'marketing.campaigns.tab.list',
    group: 'marketing',
    title: 'همه کمپین‌ها',
    route: '/marketing',
    tab: 'list',
    query: { section: 'campaigns' },
  },
  {
    id: 'marketing.campaigns.tab.calendar',
    group: 'marketing',
    title: 'تقویم کمپین‌ها',
    route: '/marketing',
    tab: 'calendar',
    query: { section: 'campaigns' },
  },
  {
    id: 'marketing.campaigns.tab.budget',
    group: 'marketing',
    title: 'بودجه و هزینه‌ها',
    route: '/marketing',
    tab: 'budget',
    query: { section: 'campaigns' },
  },
  {
    id: 'marketing.campaigns.tab.approval',
    group: 'marketing',
    title: 'گردش تأیید',
    route: '/marketing',
    tab: 'approval',
    query: { section: 'campaigns' },
  },
  {
    id: 'marketing.audiences.tab.segments',
    group: 'marketing',
    title: 'گروه‌ها و سگمنت‌ها',
    route: '/marketing',
    tab: 'segments',
    query: { section: 'audiences' },
  },
  {
    id: 'marketing.audiences.tab.campaign-audience',
    group: 'marketing',
    title: 'مخاطبان کمپین',
    route: '/marketing',
    tab: 'campaign-audience',
    query: { section: 'audiences' },
  },
  {
    id: 'marketing.audiences.tab.leads',
    group: 'marketing',
    title: 'سرنخ‌های مارکتینگ',
    route: '/marketing',
    tab: 'leads',
    query: { section: 'audiences' },
  },
  {
    id: 'marketing.audiences.tab.scoring',
    group: 'marketing',
    title: 'امتیازدهی سرنخ',
    route: '/marketing',
    tab: 'scoring',
    query: { section: 'audiences' },
  },
  {
    id: 'marketing.audiences.tab.sources',
    group: 'marketing',
    title: 'منابع ورود',
    route: '/marketing',
    tab: 'sources',
    query: { section: 'audiences' },
  },
  {
    id: 'marketing.communications.tab.send',
    group: 'marketing',
    title: 'ارسال پیام',
    route: '/marketing',
    tab: 'send',
    query: { section: 'communications' },
  },
  {
    id: 'marketing.communications.tab.scheduled',
    group: 'marketing',
    title: 'ارسال‌های زمان‌بندی‌شده',
    route: '/marketing',
    tab: 'scheduled',
    query: { section: 'communications' },
  },
  {
    id: 'marketing.communications.tab.history',
    group: 'marketing',
    title: 'تاریخچه ارسال‌ها',
    route: '/marketing',
    tab: 'history',
    query: { section: 'communications' },
  },
  {
    id: 'marketing.communications.tab.templates',
    group: 'marketing',
    title: 'قالب‌های پیام',
    route: '/marketing',
    tab: 'templates',
    query: { section: 'communications' },
  },
  {
    id: 'marketing.content.tab.library',
    group: 'marketing',
    title: 'کتابخانه محتوا و فایل‌ها',
    route: '/marketing',
    tab: 'library',
    query: { section: 'content' },
  },
  {
    id: 'marketing.content.tab.forms',
    group: 'marketing',
    title: 'فرم‌ها',
    route: '/marketing',
    tab: 'forms',
    query: { section: 'content' },
  },
  {
    id: 'marketing.content.tab.landing',
    group: 'marketing',
    title: 'صفحات فرود',
    route: '/marketing',
    tab: 'landing',
    query: { section: 'content' },
  },
  {
    id: 'marketing.content.tab.links',
    group: 'marketing',
    title: 'UTM، لینک کوتاه و QR',
    route: '/marketing',
    tab: 'links',
    query: { section: 'content' },
  },
  {
    id: 'marketing.offers.tab.discounts',
    group: 'marketing',
    title: 'کدهای تخفیف',
    route: '/marketing',
    tab: 'discounts',
    query: { section: 'offers' },
  },
  {
    id: 'marketing.offers.tab.specials',
    group: 'marketing',
    title: 'پیشنهادهای ویژه',
    route: '/marketing',
    tab: 'specials',
    query: { section: 'offers' },
  },
  {
    id: 'marketing.offers.tab.usage',
    group: 'marketing',
    title: 'گزارش استفاده',
    route: '/marketing',
    tab: 'usage',
    query: { section: 'offers' },
  },
  {
    id: 'marketing.journeys.tab.all',
    group: 'marketing',
    title: 'همه سفرها',
    route: '/marketing',
    tab: 'all',
    query: { section: 'journeys' },
  },
  {
    id: 'marketing.journeys.tab.builder',
    group: 'marketing',
    title: 'ساخت اتوماسیون',
    route: '/marketing',
    tab: 'builder',
    query: { section: 'journeys' },
  },
  {
    id: 'marketing.journeys.tab.runs',
    group: 'marketing',
    title: 'اجرای اتوماسیون‌ها',
    route: '/marketing',
    tab: 'runs',
    query: { section: 'journeys' },
  },
  {
    id: 'marketing.journeys.tab.scenarios',
    group: 'marketing',
    title: 'سناریوهای آماده',
    route: '/marketing',
    tab: 'scenarios',
    query: { section: 'journeys' },
  },
  {
    id: 'marketing.journeys.tab.history',
    group: 'marketing',
    title: 'تاریخچه اجرا',
    route: '/marketing',
    tab: 'history',
    query: { section: 'journeys' },
  },
  {
    id: 'marketing.settings.tab.channels',
    group: 'marketing',
    title: 'کانال‌ها و سرویس‌ها',
    route: '/marketing',
    tab: 'channels',
    query: { section: 'settings' },
  },
  {
    id: 'marketing.settings.tab.sites',
    group: 'marketing',
    title: 'تنظیمات دو سایت',
    route: '/marketing',
    tab: 'sites',
    query: { section: 'settings' },
  },
  {
    id: 'marketing.settings.tab.roles',
    group: 'marketing',
    title: 'نقش‌ها و دسترسی‌ها',
    route: '/marketing',
    tab: 'roles',
    query: { section: 'settings' },
  },
  {
    id: 'marketing.settings.tab.alerts',
    group: 'marketing',
    title: 'اعلان‌ها و هشدارها',
    route: '/marketing',
    tab: 'alerts',
    query: { section: 'settings' },
  },
  {
    id: 'marketing.settings.tab.general',
    group: 'marketing',
    title: 'تنظیمات عمومی',
    route: '/marketing',
    tab: 'general',
    query: { section: 'settings' },
  },
  {
    id: 'marketing.settings.tab.logs',
    group: 'marketing',
    title: 'لاگ‌ها و خطاها',
    route: '/marketing',
    tab: 'logs',
    query: { section: 'settings' },
  },
  {
    id: 'finance.requests',
    group: 'finance',
    title: 'درخواست‌های مالی',
    route: '/finance/requests',
  },
  {
    id: 'sales.pricing.management',
    group: 'sales',
    title: 'مدیریت قیمت‌ها',
    route: '/sales/pricing/management',
  },
  {
    id: 'sales.pricing.generator',
    group: 'sales',
    title: 'ساخت پکیج',
    route: '/sales/pricing/generator',
  },
  {
    id: 'master-data.accommodation.hotel-rates',
    group: 'master-data',
    title: 'نرخ خرید هتل',
    route: '/master-data/accommodation/hotel-rates',
  },
  {
    id: 'hr.workspace.expenses',
    group: 'hr',
    title: 'هزینه‌ها و مأموریت',
    route: '/human-resources',
    query: { workspace: 'expenses' },
  },
  {
    id: 'hr.workspace.hr-setup',
    group: 'hr',
    title: 'راه‌اندازی منابع انسانی',
    route: '/human-resources',
    query: { workspace: 'hr-setup' },
  },
  {
    id: 'hr.workspace.leaves',
    group: 'hr',
    title: 'مرخصی‌ها',
    route: '/human-resources',
    query: { workspace: 'leaves' },
  },
  {
    id: 'hr.workspace.payroll',
    group: 'hr',
    title: 'حقوق و دستمزد',
    route: '/human-resources',
    query: { workspace: 'payroll' },
  },
  {
    id: 'hr.workspace.performance',
    group: 'hr',
    title: 'عملکرد و آموزش',
    route: '/human-resources',
    query: { workspace: 'performance' },
  },
  {
    id: 'hr.workspace.recruitment',
    group: 'hr',
    title: 'جذب و استخدام',
    route: '/human-resources',
    query: { workspace: 'recruitment' },
  },
  {
    id: 'hr.workspace.shift-attendance',
    group: 'hr',
    title: 'شیفت و حضور و غیاب',
    route: '/human-resources',
    query: { workspace: 'shift-attendance' },
  },
  {
    id: 'hr.workspace.tax-benefits',
    group: 'hr',
    title: 'مالیات و مزایا',
    route: '/human-resources',
    query: { workspace: 'tax-benefits' },
  },
  {
    id: 'hr.workspace.tenure',
    group: 'hr',
    title: 'چرخه همکاری',
    route: '/human-resources',
    query: { workspace: 'tenure' },
  },
  {
    id: 'workbench.home',
    group: 'workbench',
    title: 'میزکار من',
    route: '/workbench',
  },
  {
    id: 'dashboard.home',
    group: 'dashboard',
    title: 'داشبورد',
    route: '/dashboard',
  },
  {
    id: 'customers.home',
    group: 'customers',
    title: 'مشتریان و مسافران',
    route: '/customers',
  },
  {
    id: 'customer-affairs.home',
    group: 'customer-affairs',
    title: 'امور مشتریان',
    route: '/customer-affairs',
  },
  {
    id: 'reservations.home',
    group: 'reservations',
    title: 'رزرواسیون',
    route: '/reservations',
  },
  {
    id: 'ticket-catalog.home',
    group: 'ticket-catalog',
    title: 'مدیریت بلیط',
    route: '/ticket-management',
  },
  {
    id: 'sales.home',
    group: 'sales',
    title: 'قراردادها و فروش',
    route: '/sales',
  },
  {
    id: 'procurement.home',
    group: 'procurement',
    title: 'خرید و تامین',
    route: '/purchases',
  },
  {
    id: 'finance.home',
    group: 'finance',
    title: 'مالی و خزانه‌داری',
    route: '/finance',
  },
  {
    id: 'marketing.home',
    group: 'marketing',
    title: 'مارکتینگ',
    route: '/marketing',
  },
  {
    id: 'organizations.home',
    group: 'organizations',
    title: 'آژانس‌ها و مشتریان سازمانی',
    route: '/organizations',
  },
  {
    id: 'hr.home',
    group: 'hr',
    title: 'منابع انسانی',
    route: '/human-resources',
  },
  {
    id: 'documents.home',
    group: 'documents',
    title: 'اسناد و فایل‌ها',
    route: '/documents',
  },
  {
    id: 'reports.home',
    group: 'reports',
    title: 'گزارش‌ها',
    route: '/reports',
  },
  {
    id: 'integrations.home',
    group: 'integrations',
    title: 'یکپارچه‌سازی‌ها',
    route: '/integrations',
  },
  {
    id: 'system.home',
    group: 'system',
    title: 'مدیریت سیستم',
    route: '/system',
  },
  {
    id: 'master-data.home',
    group: 'master-data',
    title: 'اطلاعات پایه',
    route: '/master-data',
  },
  {
    id: 'workbench.tab.UPLOADED',
    group: 'workbench',
    title: 'بارگذاری‌های من',
    route: '/workbench',
    tab: 'UPLOADED',
  },
  {
    id: 'workbench.tab.RECENTLY_VIEWED',
    group: 'workbench',
    title: 'اخیراً دیده‌شده',
    route: '/workbench',
    tab: 'RECENTLY_VIEWED',
  },
  {
    id: 'customers.tab.overview',
    group: 'customers',
    title: 'نمای کلی',
    route: '/customers',
    tab: 'overview',
  },
  {
    id: 'customers.tab.dossier',
    group: 'customers',
    title: 'پرونده ۳۶۰ درجه',
    route: '/customers',
    tab: 'dossier',
  },
  {
    id: 'customers.tab.contacts',
    group: 'customers',
    title: 'تماس‌ها',
    route: '/customers',
    tab: 'contacts',
  },
  {
    id: 'customers.tab.addresses',
    group: 'customers',
    title: 'نشانی‌ها',
    route: '/customers',
    tab: 'addresses',
  },
  {
    id: 'customers.tab.consents',
    group: 'customers',
    title: 'رضایت',
    route: '/customers',
    tab: 'consents',
  },
  {
    id: 'customers.tab.companions',
    group: 'customers',
    title: 'همراهان',
    route: '/customers',
    tab: 'companions',
  },
  {
    id: 'customers.tab.status-history',
    group: 'customers',
    title: 'تاریخچه وضعیت',
    route: '/customers',
    tab: 'status-history',
  },
  {
    id: 'customers.tab.duplicates',
    group: 'customers',
    title: 'موارد مشابه',
    route: '/customers',
    tab: 'duplicates',
  },
  {
    id: 'customers.tab.activity',
    group: 'customers',
    title: 'فعالیت‌ها',
    route: '/customers',
    tab: 'activity',
  },
  {
    id: 'customers.tab.audit',
    group: 'customers',
    title: 'Audit',
    route: '/customers',
    tab: 'audit',
  },
  {
    id: 'ticket-catalog.tab.catalog',
    group: 'ticket-catalog',
    title: 'catalog',
    route: '/ticket-management',
    tab: 'catalog',
  },
  {
    id: 'ticket-catalog.tab.issued',
    group: 'ticket-catalog',
    title: 'issued',
    route: '/ticket-management',
    tab: 'issued',
  },
  {
    id: 'ticket-catalog.tab.tours',
    group: 'sales',
    title: 'تعریف تور و خدمات',
    route: '/sales/tours',
  },
  {
    id: 'ticket-catalog.tab.intro',
    group: 'ticket-catalog',
    title: 'معرفی و شرایط',
    route: '/ticket-management',
    tab: 'intro',
  },
  {
    id: 'ticket-catalog.tab.transport',
    group: 'ticket-catalog',
    title: 'مشخصات سفر',
    route: '/ticket-management',
    tab: 'transport',
  },
  {
    id: 'ticket-catalog.tab.itinerary',
    group: 'ticket-catalog',
    title: 'برنامه سفر',
    route: '/ticket-management',
    tab: 'itinerary',
  },
  {
    id: 'ticket-catalog.tab.image',
    group: 'ticket-catalog',
    title: 'تصویر تور',
    route: '/ticket-management',
    tab: 'image',
  },
  {
    id: 'finance.tab.overview',
    group: 'finance',
    title: 'داشبورد',
    route: '/finance',
    tab: 'overview',
  },
  {
    id: 'finance.tab.capabilities',
    group: 'finance',
    title: '۳۰ بخش',
    route: '/finance',
    tab: 'capabilities',
  },
  {
    id: 'finance.tab.operations',
    group: 'finance',
    title: 'عملیات',
    route: '/finance',
    tab: 'operations',
  },
  {
    id: 'finance.tab.release',
    group: 'finance',
    title: 'آزادسازی',
    route: '/finance',
    tab: 'release',
  },
  {
    id: 'finance.tab.reports',
    group: 'finance',
    title: 'گزارش‌ها',
    route: '/finance',
    tab: 'reports',
  },
  {
    id: 'system.users',
    group: 'system',
    title: 'مدیریت کاربران',
    route: '/system/users',
  },
  {
    id: 'system.settings',
    group: 'system',
    title: 'تنظیمات',
    route: '/settings',
  },
  {
    id: 'system.operations',
    group: 'system',
    title: 'عملیات سامانه',
    route: '/system/operations',
  },
  {
    id: 'system.legal-entities',
    group: 'system',
    title: 'شرکت‌ها',
    route: '/system/legal-entities',
  },
  {
    id: 'sales.ticket-prices',
    group: 'sales',
    title: 'قیمت بلیط',
    route: '/sales/ticket-prices',
  },
  {
    id: 'sales.pricing',
    group: 'sales',
    title: 'مدیریت پکیج و قیمت',
    route: '/sales/pricing',
  },
  {
    id: 'sales.new-contract',
    group: 'sales',
    title: 'قرارداد جدید',
    route: '/sales/contracts/new',
  },
  {
    id: 'reservations.foundation',
    group: 'reservations',
    title: 'اطلاعات پایه رزرواسیون',
    route: '/reservations/foundation',
  },
  {
    id: 'reservations.operations',
    group: 'reservations',
    title: 'عملیات سفر',
    route: '/reservations/operations',
  },
  {
    id: 'reservations.processing',
    group: 'reservations',
    title: 'پردازش رزرواسیون',
    route: '/reservations/processing',
  },
  {
    id: 'reservations.hotel-rates',
    group: 'reservations',
    title: 'نرخ هتل',
    route: '/reservations/hotel-rates',
  },
  {
    id: 'master-data.finance',
    group: 'master-data',
    title: 'مالی و پولی',
    route: '/master-data/finance',
  },
  {
    id: 'master-data.geography',
    group: 'master-data',
    title: 'جغرافیا',
    route: '/master-data/geography',
  },
  {
    id: 'master-data.organizations-suppliers',
    group: 'master-data',
    title: 'سازمان‌ها و تأمین‌کنندگان',
    route: '/master-data/organizations-suppliers',
  },
  {
    id: 'master-data.accommodation',
    group: 'master-data',
    title: 'اقامت',
    route: '/master-data/accommodation',
  },
  {
    id: 'master-data.transportation',
    group: 'master-data',
    title: 'حمل‌ونقل',
    route: '/master-data/transportation',
  },
  {
    id: 'master-data.insurance',
    group: 'master-data',
    title: 'بیمه',
    route: '/master-data/insurance',
  },
  {
    id: 'master-data.tours-travel-services',
    group: 'master-data',
    title: 'تور و خدمات سفر',
    route: '/master-data/tours-travel-services',
  },
  {
    id: 'master-data.sales-references',
    group: 'master-data',
    title: 'مراجع فروش',
    route: '/master-data/sales-references',
  },
  {
    id: 'hr.time.attendance',
    group: 'hr',
    title: 'کارکرد روزانه',
    route: '/human-resources',
    query: {
      section: 'time',
      tab: 'attendance',
    },
  },
  {
    id: 'hr.time.checkins',
    group: 'hr',
    title: 'ورود و خروج',
    route: '/human-resources',
    query: {
      section: 'time',
      tab: 'checkins',
    },
  },
  {
    id: 'hr.time.corrections',
    group: 'hr',
    title: 'اصلاح حضور',
    route: '/human-resources',
    query: {
      section: 'time',
      tab: 'corrections',
    },
  },
  {
    id: 'hr.time.overtime',
    group: 'hr',
    title: 'اضافه‌کاری',
    route: '/human-resources',
    query: {
      section: 'time',
      tab: 'overtime',
    },
  },
  {
    id: 'hr.time.shift',
    group: 'hr',
    title: 'تعریف شیفت',
    route: '/human-resources',
    query: {
      section: 'time',
      tab: 'shift',
    },
  },
  {
    id: 'hr.time.leave',
    group: 'hr',
    title: 'درخواست مرخصی',
    route: '/human-resources',
    query: {
      section: 'time',
      tab: 'leave',
    },
  },
  {
    id: 'hr.time.leavePolicies',
    group: 'hr',
    title: 'سیاست و سهمیه',
    route: '/human-resources',
    query: {
      section: 'time',
      tab: 'leavePolicies',
    },
  },
  {
    id: 'hr.time.holidays',
    group: 'hr',
    title: 'تعطیلات',
    route: '/human-resources',
    query: {
      section: 'time',
      tab: 'holidays',
    },
  },
  {
    id: 'hr.time.biometric',
    group: 'hr',
    title: 'دستگاه‌ها',
    route: '/human-resources',
    query: {
      section: 'time',
      tab: 'biometric',
    },
  },
  {
    id: 'hr.contracts.active',
    group: 'hr',
    title: 'فهرست قراردادها',
    route: '/human-resources',
    query: {
      section: 'contracts',
      tab: 'active',
    },
  },
  {
    id: 'hr.contracts.amendments',
    group: 'hr',
    title: 'الحاقیه و تمدید',
    route: '/human-resources',
    query: {
      section: 'contracts',
      tab: 'amendments',
    },
  },
  {
    id: 'hr.contracts.templates',
    group: 'hr',
    title: 'قالب‌ها و انواع',
    route: '/human-resources',
    query: {
      section: 'contracts',
      tab: 'templates',
    },
  },
  {
    id: 'hr.recruitment.requisitions',
    group: 'hr',
    title: 'درخواست‌های جذب',
    route: '/human-resources',
    query: {
      section: 'recruitment',
      tab: 'requisitions',
    },
  },
  {
    id: 'hr.recruitment.staffing',
    group: 'hr',
    title: 'برنامه نیروی انسانی',
    route: '/human-resources',
    query: {
      section: 'recruitment',
      tab: 'staffing',
    },
  },
  {
    id: 'hr.recruitment.openings',
    group: 'hr',
    title: 'فرصت‌های شغلی',
    route: '/human-resources',
    query: {
      section: 'recruitment',
      tab: 'openings',
    },
  },
  {
    id: 'hr.recruitment.applicants',
    group: 'hr',
    title: 'متقاضیان',
    route: '/human-resources',
    query: {
      section: 'recruitment',
      tab: 'applicants',
    },
  },
  {
    id: 'hr.recruitment.interviews',
    group: 'hr',
    title: 'مصاحبه‌ها',
    route: '/human-resources',
    query: {
      section: 'recruitment',
      tab: 'interviews',
    },
  },
  {
    id: 'hr.recruitment.feedback',
    group: 'hr',
    title: 'ارزیابی مصاحبه',
    route: '/human-resources',
    query: {
      section: 'recruitment',
      tab: 'feedback',
    },
  },
  {
    id: 'hr.recruitment.offers',
    group: 'hr',
    title: 'پیشنهاد استخدام',
    route: '/human-resources',
    query: {
      section: 'recruitment',
      tab: 'offers',
    },
  },
  {
    id: 'hr.lifecycle.onboarding',
    group: 'hr',
    title: 'نیروی جدید',
    route: '/human-resources',
    query: {
      section: 'lifecycle',
      tab: 'onboarding',
    },
  },
  {
    id: 'hr.lifecycle.promotion',
    group: 'hr',
    title: 'ارتقا',
    route: '/human-resources',
    query: {
      section: 'lifecycle',
      tab: 'promotion',
    },
  },
  {
    id: 'hr.lifecycle.transfer',
    group: 'hr',
    title: 'انتقال',
    route: '/human-resources',
    query: {
      section: 'lifecycle',
      tab: 'transfer',
    },
  },
  {
    id: 'hr.lifecycle.separation',
    group: 'hr',
    title: 'پرونده‌های خروج',
    route: '/human-resources',
    query: {
      section: 'lifecycle',
      tab: 'separation',
    },
  },
  {
    id: 'hr.lifecycle.exit',
    group: 'hr',
    title: 'مصاحبه خروج',
    route: '/human-resources',
    query: {
      section: 'lifecycle',
      tab: 'exit',
    },
  },
  {
    id: 'hr.lifecycle.settlement',
    group: 'hr',
    title: 'تسویه نهایی',
    route: '/human-resources',
    query: {
      section: 'lifecycle',
      tab: 'settlement',
    },
  },
  {
    id: 'hr.contracts.termination',
    group: 'hr',
    title: 'خاتمه قرارداد',
    route: '/human-resources',
    query: {
      section: 'contracts',
      tab: 'termination',
    },
  },
  {
    id: 'hr.finance.settlements',
    group: 'hr',
    title: 'پیگیری تأیید مالی',
    route: '/human-resources',
    query: {
      section: 'finance',
      tab: 'settlements',
    },
  },
  {
    id: 'hr.development.cycles',
    group: 'hr',
    title: 'دوره‌های ارزیابی',
    route: '/human-resources',
    query: {
      section: 'development',
      tab: 'cycles',
    },
  },
  {
    id: 'hr.development.performance',
    group: 'hr',
    title: 'ارزیابی کارکنان',
    route: '/human-resources',
    query: {
      section: 'development',
      tab: 'performance',
    },
  },
  {
    id: 'hr.development.goals',
    group: 'hr',
    title: 'اهداف',
    route: '/human-resources',
    query: {
      section: 'development',
      tab: 'goals',
    },
  },
  {
    id: 'hr.development.selfReview',
    group: 'hr',
    title: 'خودارزیابی',
    route: '/human-resources',
    query: {
      section: 'development',
      tab: 'selfReview',
    },
  },
  {
    id: 'hr.development.training',
    group: 'hr',
    title: 'برنامه‌های آموزشی',
    route: '/human-resources',
    query: {
      section: 'development',
      tab: 'training',
    },
  },
  {
    id: 'hr.development.skills',
    group: 'hr',
    title: 'نیازهای آموزشی',
    route: '/human-resources',
    query: {
      section: 'development',
      tab: 'skills',
    },
  },
  {
    id: 'hr.expenses.mission',
    group: 'hr',
    title: 'مأموریت‌ها',
    route: '/human-resources',
    query: {
      section: 'expenses',
      tab: 'mission',
    },
  },
  {
    id: 'hr.expenses.travel',
    group: 'hr',
    title: 'برنامه سفر',
    route: '/human-resources',
    query: {
      section: 'expenses',
      tab: 'travel',
    },
  },
  {
    id: 'hr.expenses.advances',
    group: 'hr',
    title: 'مساعده مأموریت',
    route: '/human-resources',
    query: {
      section: 'expenses',
      tab: 'advances',
    },
  },
  {
    id: 'hr.expenses.claims',
    group: 'hr',
    title: 'هزینه‌ها و رسیدها',
    route: '/human-resources',
    query: {
      section: 'expenses',
      tab: 'claims',
    },
  },
  {
    id: 'hr.payroll.runs',
    group: 'hr',
    title: 'دوره‌های حقوق',
    route: '/human-resources',
    query: {
      section: 'payroll',
      tab: 'runs',
    },
  },
  {
    id: 'hr.finance.batch',
    group: 'hr',
    title: 'مبانی پرداخت',
    route: '/human-resources',
    query: {
      section: 'finance',
      tab: 'batch',
    },
  },
  {
    id: 'hr.finance.results',
    group: 'hr',
    title: 'نتیجه حقوق',
    route: '/human-resources',
    query: {
      section: 'finance',
      tab: 'results',
    },
  },
  {
    id: 'hr.payroll.payslips',
    group: 'hr',
    title: 'فیش‌های حقوقی',
    route: '/human-resources',
    query: {
      section: 'payroll',
      tab: 'payslips',
    },
  },
  {
    id: 'hr.finance.payments',
    group: 'hr',
    title: 'پرداخت و مغایرت',
    route: '/human-resources',
    query: {
      section: 'finance',
      tab: 'payments',
    },
  },
  {
    id: 'hr.payroll.accounting',
    group: 'hr',
    title: 'سند حسابداری',
    route: '/human-resources',
    query: {
      section: 'payroll',
      tab: 'accounting',
    },
  },
  {
    id: 'hr.payroll.additional',
    group: 'hr',
    title: 'پرداخت اضافی',
    route: '/human-resources',
    query: {
      section: 'payroll',
      tab: 'additional',
    },
  },
  {
    id: 'hr.payroll.incentives',
    group: 'hr',
    title: 'پاداش و مشوق',
    route: '/human-resources',
    query: {
      section: 'payroll',
      tab: 'incentives',
    },
  },
  {
    id: 'hr.payroll.corrections',
    group: 'hr',
    title: 'اصلاح و معوق',
    route: '/human-resources',
    query: {
      section: 'payroll',
      tab: 'corrections',
    },
  },
  {
    id: 'hr.payroll.structures',
    group: 'hr',
    title: 'ساختار حقوق',
    route: '/human-resources',
    query: {
      section: 'payroll',
      tab: 'structures',
    },
  },
  {
    id: 'hr.payroll.components',
    group: 'hr',
    title: 'دریافتی و کسورات',
    route: '/human-resources',
    query: {
      section: 'payroll',
      tab: 'components',
    },
  },
  {
    id: 'hr.finance.bank',
    group: 'hr',
    title: 'حساب مقصد',
    route: '/human-resources',
    query: {
      section: 'finance',
      tab: 'bank',
    },
  },
  {
    id: 'hr.assets.list',
    group: 'hr',
    title: 'تجهیزات',
    route: '/human-resources',
    query: {
      section: 'assets',
      tab: 'list',
    },
  },
  {
    id: 'hr.assets.vehicles',
    group: 'hr',
    title: 'خودروهای سازمانی',
    route: '/human-resources',
    query: {
      section: 'assets',
      tab: 'vehicles',
    },
  },
  {
    id: 'hr.assets.logs',
    group: 'hr',
    title: 'سوابق استفاده',
    route: '/human-resources',
    query: {
      section: 'assets',
      tab: 'logs',
    },
  },
  {
    id: 'hr.employee.summary',
    group: 'hr',
    title: 'مشخصات فردی',
    route: '/human-resources',
    query: {
      section: 'employee',
      tab: 'summary',
    },
  },
  {
    id: 'hr.employee.contact',
    group: 'hr',
    title: 'اطلاعات تماس',
    route: '/human-resources',
    query: {
      section: 'employee',
      tab: 'contact',
    },
  },
  {
    id: 'hr.employee.assignment',
    group: 'hr',
    title: 'انتصاب',
    route: '/human-resources',
    query: {
      section: 'employee',
      tab: 'assignment',
    },
  },
  {
    id: 'hr.employee.contract',
    group: 'hr',
    title: 'قرارداد',
    route: '/human-resources',
    query: {
      section: 'employee',
      tab: 'contract',
    },
  },
  {
    id: 'hr.employee.attendance',
    group: 'hr',
    title: 'کارکرد',
    route: '/human-resources',
    query: {
      section: 'employee',
      tab: 'attendance',
    },
  },
  {
    id: 'hr.employee.shift',
    group: 'hr',
    title: 'شیفت',
    route: '/human-resources',
    query: {
      section: 'employee',
      tab: 'shift',
    },
  },
  {
    id: 'hr.employee.leave',
    group: 'hr',
    title: 'مرخصی',
    route: '/human-resources',
    query: {
      section: 'employee',
      tab: 'leave',
    },
  },
  {
    id: 'hr.employee.overtime',
    group: 'hr',
    title: 'اضافه‌کاری',
    route: '/human-resources',
    query: {
      section: 'employee',
      tab: 'overtime',
    },
  },
  {
    id: 'hr.employee.financial',
    group: 'hr',
    title: 'حقوق و کسورات',
    route: '/human-resources',
    query: {
      section: 'employee',
      tab: 'financial',
    },
  },
  {
    id: 'hr.employee.payslips',
    group: 'hr',
    title: 'فیش‌های حقوقی',
    route: '/human-resources',
    query: {
      section: 'employee',
      tab: 'payslips',
    },
  },
  {
    id: 'hr.employee.performance',
    group: 'hr',
    title: 'ارزیابی',
    route: '/human-resources',
    query: {
      section: 'employee',
      tab: 'performance',
    },
  },
  {
    id: 'hr.employee.training',
    group: 'hr',
    title: 'آموزش',
    route: '/human-resources',
    query: {
      section: 'employee',
      tab: 'training',
    },
  },
  {
    id: 'hr.employee.assets',
    group: 'hr',
    title: 'تجهیزات',
    route: '/human-resources',
    query: {
      section: 'employee',
      tab: 'assets',
    },
  },
  {
    id: 'hr.employee.docs',
    group: 'hr',
    title: 'مدارک',
    route: '/human-resources',
    query: {
      section: 'employee',
      tab: 'docs',
    },
  },
  {
    id: 'hr.employee.requests',
    group: 'hr',
    title: 'درخواست‌ها',
    route: '/human-resources',
    query: {
      section: 'employee',
      tab: 'requests',
    },
  },
  {
    id: 'hr.employee.mission',
    group: 'hr',
    title: 'مأموریت‌ها',
    route: '/human-resources',
    query: {
      section: 'employee',
      tab: 'mission',
    },
  },
  {
    id: 'hr.employee.audit',
    group: 'hr',
    title: 'تاریخچه',
    route: '/human-resources',
    query: {
      section: 'employee',
      tab: 'audit',
    },
  },
  {
    id: 'marketing.process',
    group: 'marketing',
    title: 'فرایند یکپارچه',
    route: '/marketing',
    query: {
      section: 'process',
    },
  },
  {
    id: 'marketing.dashboard',
    group: 'marketing',
    title: 'داشبورد',
    route: '/marketing',
    query: {
      section: 'dashboard',
    },
  },
  {
    id: 'marketing.campaigns',
    group: 'marketing',
    title: 'کمپین‌ها',
    route: '/marketing',
    query: {
      section: 'campaigns',
    },
  },
  {
    id: 'marketing.audiences',
    group: 'marketing',
    title: 'مخاطبان',
    route: '/marketing',
    query: {
      section: 'audiences',
    },
  },
  {
    id: 'marketing.communications',
    group: 'marketing',
    title: 'ارتباطات',
    route: '/marketing',
    query: {
      section: 'communications',
    },
  },
  {
    id: 'marketing.content',
    group: 'marketing',
    title: 'محتوا و جذب',
    route: '/marketing',
    query: {
      section: 'content',
    },
  },
  {
    id: 'marketing.offers',
    group: 'marketing',
    title: 'تخفیف‌ها و پیشنهادها',
    route: '/marketing',
    query: {
      section: 'offers',
    },
  },
  {
    id: 'marketing.journeys',
    group: 'marketing',
    title: 'سفر مشتری',
    route: '/marketing',
    query: {
      section: 'journeys',
    },
  },
  {
    id: 'marketing.settings',
    group: 'marketing',
    title: 'تنظیمات',
    route: '/marketing',
    query: {
      section: 'settings',
    },
  },
  {
    id: 'workbench.tab.today',
    group: 'workbench',
    title: 'خانه',
    route: '/workbench',
    tab: 'today',
  },
  {
    id: 'workbench.tab.requests',
    group: 'workbench',
    title: 'کارتابل درخواست‌ها',
    route: '/workbench',
    tab: 'requests',
  },
  {
    id: 'workbench.tab.messages',
    group: 'workbench',
    title: 'پیام‌ها',
    route: '/workbench',
    tab: 'messages',
  },
  {
    id: 'workbench.tab.files',
    group: 'workbench',
    title: 'فایل‌های من',
    route: '/workbench',
    tab: 'files',
  },
  {
    id: 'workbench.tab.stars',
    group: 'workbench',
    title: 'ستاره‌دارها',
    route: '/workbench',
    tab: 'stars',
  },
  {
    id: 'workbench.tab.activity',
    group: 'workbench',
    title: 'فعالیت‌های من',
    route: '/workbench',
    tab: 'activity',
  },
  {
    id: 'workbench.tab.performance',
    group: 'workbench',
    title: 'عملکرد من',
    route: '/workbench',
    tab: 'performance',
  },
  {
    id: 'workbench.tab.notes',
    group: 'workbench',
    title: 'یادداشت‌ها',
    route: '/workbench',
    tab: 'notes',
  },
  {
    id: 'workbench.tab.calendar',
    group: 'workbench',
    title: 'تقویم من',
    route: '/workbench',
    tab: 'calendar',
  },
  {
    id: 'workbench.tab.account',
    group: 'workbench',
    title: 'حساب و تنظیمات',
    route: '/workbench',
    tab: 'account',
  },
  {
    id: 'hr.section.dashboard',
    group: 'hr',
    title: 'نمای کلی',
    route: '/human-resources',
    query: {
      section: 'dashboard',
    },
  },
  {
    id: 'hr.section.employees',
    group: 'hr',
    title: 'کارکنان',
    route: '/human-resources',
    query: {
      section: 'employees',
    },
  },
  {
    id: 'hr.section.organization',
    group: 'hr',
    title: 'ساختار سازمانی',
    route: '/human-resources',
    query: {
      section: 'organization',
    },
  },
  {
    id: 'hr.section.recruitment',
    group: 'hr',
    title: 'جذب و استخدام',
    route: '/human-resources',
    query: {
      section: 'recruitment',
    },
  },
  {
    id: 'hr.section.lifecycle',
    group: 'hr',
    title: 'چرخه همکاری',
    route: '/human-resources',
    query: {
      section: 'lifecycle',
    },
  },
  {
    id: 'hr.section.contracts',
    group: 'hr',
    title: 'قراردادها',
    route: '/human-resources',
    query: {
      section: 'contracts',
    },
  },
  {
    id: 'hr.section.time',
    group: 'hr',
    title: 'کارکرد و زمان',
    route: '/human-resources',
    query: {
      section: 'time',
    },
  },
  {
    id: 'hr.section.development',
    group: 'hr',
    title: 'توسعه کارکنان',
    route: '/human-resources',
    query: {
      section: 'development',
    },
  },
  {
    id: 'hr.section.expenses',
    group: 'hr',
    title: 'مأموریت و هزینه‌ها',
    route: '/human-resources',
    query: {
      section: 'expenses',
    },
  },
  {
    id: 'hr.section.assets',
    group: 'hr',
    title: 'تجهیزات تحویلی',
    route: '/human-resources',
    query: {
      section: 'assets',
    },
  },
  {
    id: 'hr.section.requests',
    group: 'hr',
    title: 'مرکز درخواست‌ها',
    route: '/human-resources',
    query: {
      section: 'requests',
    },
  },
  {
    id: 'hr.section.surveys',
    group: 'hr',
    title: 'نظرسنجی‌ها و پیشنهادها',
    route: '/human-resources',
    query: {
      section: 'surveys',
    },
  },
  {
    id: 'hr.section.finance',
    group: 'hr',
    title: 'ارتباط با مالی',
    route: '/human-resources',
    query: {
      section: 'finance',
    },
  },
  {
    id: 'hr.section.reports',
    group: 'hr',
    title: 'گزارش و Audit',
    route: '/human-resources',
    query: {
      section: 'reports',
    },
  },
  {
    id: 'hr.section.payroll',
    group: 'hr',
    title: 'حقوق و دستمزد',
    route: '/human-resources',
    query: {
      section: 'payroll',
    },
  },
  {
    id: 'hr.section.hrSettings',
    group: 'hr',
    title: 'تنظیمات و یکپارچگی',
    route: '/human-resources',
    query: {
      section: 'hrSettings',
    },
  },
  {
    id: 'master-data.resource.currencies',
    group: 'master-data',
    title: 'ارزها',
    route: '/master-data/finance',
    query: {
      resource: 'currencies',
    },
  },
  {
    id: 'master-data.resource.exchange-rates',
    group: 'master-data',
    title: 'نرخ ارز',
    route: '/master-data/finance',
    query: {
      resource: 'exchange-rates',
    },
  },
  {
    id: 'master-data.resource.banks',
    group: 'master-data',
    title: 'بانک‌ها',
    route: '/master-data/finance',
    query: {
      resource: 'banks',
    },
  },
  {
    id: 'master-data.resource.bank-branches',
    group: 'master-data',
    title: 'شعب بانک',
    route: '/master-data/finance',
    query: {
      resource: 'bank-branches',
    },
  },
  {
    id: 'master-data.resource.payment-methods',
    group: 'master-data',
    title: 'روش‌های پرداخت',
    route: '/master-data/finance',
    query: {
      resource: 'payment-methods',
    },
  },
  {
    id: 'master-data.resource.countries',
    group: 'master-data',
    title: 'کشورها',
    route: '/master-data/geography',
    query: {
      resource: 'countries',
    },
  },
  {
    id: 'master-data.resource.regions',
    group: 'master-data',
    title: 'استان‌ها و نواحی',
    route: '/master-data/geography',
    query: {
      resource: 'regions',
    },
  },
  {
    id: 'master-data.resource.cities',
    group: 'master-data',
    title: 'شهرها',
    route: '/master-data/geography',
    query: {
      resource: 'cities',
    },
  },
  {
    id: 'master-data.resource.airports',
    group: 'master-data',
    title: 'فرودگاه‌ها',
    route: '/master-data/geography',
    query: {
      resource: 'airports',
    },
  },
  {
    id: 'master-data.resource.terminals',
    group: 'master-data',
    title: 'ترمینال‌ها',
    route: '/master-data/geography',
    query: {
      resource: 'terminals',
    },
  },
  {
    id: 'master-data.resource.organizations',
    group: 'master-data',
    title: 'آژانس‌ها و شرکت‌ها',
    route: '/master-data/organizations-suppliers',
    query: {
      resource: 'organizations',
    },
  },
  {
    id: 'master-data.resource.suppliers',
    group: 'master-data',
    title: 'تأمین‌کنندگان',
    route: '/master-data/organizations-suppliers',
    query: {
      resource: 'suppliers',
    },
  },
  {
    id: 'master-data.resource.brokers',
    group: 'master-data',
    title: 'کارگزاران',
    route: '/master-data/organizations-suppliers',
    query: {
      resource: 'brokers',
    },
  },
  {
    id: 'master-data.resource.travel-services',
    group: 'master-data',
    title: 'خدمات مرجع سفر',
    route: '/master-data/organizations-suppliers',
    query: {
      resource: 'travel-services',
    },
  },
  {
    id: 'master-data.resource.organization-contacts',
    group: 'master-data',
    title: 'اطلاعات تماس',
    route: '/master-data/organizations-suppliers',
    query: {
      resource: 'organization-contacts',
    },
  },
  {
    id: 'master-data.resource.hotels',
    group: 'master-data',
    title: 'هتل‌ها',
    route: '/master-data/accommodation',
    query: {
      resource: 'hotels',
    },
  },
  {
    id: 'master-data.resource.hotel-chains',
    group: 'master-data',
    title: 'زنجیره‌های هتل',
    route: '/master-data/accommodation',
    query: {
      resource: 'hotel-chains',
    },
  },
  {
    id: 'master-data.resource.composite-hotels',
    group: 'master-data',
    title: 'هتل‌های ترکیبی',
    route: '/master-data/accommodation',
    query: {
      resource: 'composite-hotels',
    },
  },
  {
    id: 'master-data.resource.airlines',
    group: 'master-data',
    title: 'ایرلاین‌ها',
    route: '/master-data/transportation',
    query: {
      resource: 'airlines',
    },
  },
  {
    id: 'master-data.resource.aircraft-types',
    group: 'master-data',
    title: 'انواع هواپیما',
    route: '/master-data/transportation',
    query: {
      resource: 'aircraft-types',
    },
  },
  {
    id: 'master-data.resource.cabin-classes',
    group: 'master-data',
    title: 'کلاس‌های پروازی',
    route: '/master-data/transportation',
    query: {
      resource: 'cabin-classes',
    },
  },
  {
    id: 'master-data.resource.baggage-rules',
    group: 'master-data',
    title: 'قواعد بار',
    route: '/master-data/transportation',
    query: {
      resource: 'baggage-rules',
    },
  },
  {
    id: 'master-data.resource.manifest-templates',
    group: 'master-data',
    title: 'قالب‌های Manifest',
    route: '/master-data/transportation',
    query: {
      resource: 'manifest-templates',
    },
  },
  {
    id: 'master-data.resource.rail-companies',
    group: 'master-data',
    title: 'شرکت‌های ریلی',
    route: '/master-data/transportation',
    query: {
      resource: 'rail-companies',
    },
  },
  {
    id: 'master-data.resource.train-types',
    group: 'master-data',
    title: 'انواع قطار',
    route: '/master-data/transportation',
    query: {
      resource: 'train-types',
    },
  },
  {
    id: 'master-data.resource.bus-companies',
    group: 'master-data',
    title: 'شرکت‌های اتوبوس',
    route: '/master-data/transportation',
    query: {
      resource: 'bus-companies',
    },
  },
  {
    id: 'master-data.resource.bus-types',
    group: 'master-data',
    title: 'انواع اتوبوس',
    route: '/master-data/transportation',
    query: {
      resource: 'bus-types',
    },
  },
  {
    id: 'master-data.resource.insurers',
    group: 'master-data',
    title: 'شرکت‌های بیمه',
    route: '/master-data/insurance',
    query: {
      resource: 'insurers',
    },
  },
  {
    id: 'master-data.resource.insurance-plans',
    group: 'master-data',
    title: 'طرح‌های بیمه',
    route: '/master-data/insurance',
    query: {
      resource: 'insurance-plans',
    },
  },
  {
    id: 'master-data.resource.insurance-coverages',
    group: 'master-data',
    title: 'پوشش‌ها',
    route: '/master-data/insurance',
    query: {
      resource: 'insurance-coverages',
    },
  },
  {
    id: 'master-data.resource.leaders',
    group: 'master-data',
    title: 'لیدرها',
    route: '/master-data/tours-travel-services',
    query: {
      resource: 'leaders',
    },
  },
  {
    id: 'master-data.resource.tour-types',
    group: 'master-data',
    title: 'نوع تور',
    route: '/master-data/tours-travel-services',
    query: {
      resource: 'tour-types',
    },
  },
  {
    id: 'master-data.resource.transfer-types',
    group: 'master-data',
    title: 'نوع ترانسفر',
    route: '/master-data/tours-travel-services',
    query: {
      resource: 'transfer-types',
    },
  },
  {
    id: 'master-data.resource.visa-services',
    group: 'master-data',
    title: 'خدمات ویزا',
    route: '/master-data/tours-travel-services',
    query: {
      resource: 'visa-services',
    },
  },
  {
    id: 'master-data.resource.acquaintance-methods',
    group: 'master-data',
    title: 'نحوه آشنایی',
    route: '/master-data/sales-references',
    query: {
      resource: 'acquaintance-methods',
    },
  },
  {
    id: 'master-data.resource.sales-channels',
    group: 'master-data',
    title: 'کانال‌های فروش',
    route: '/master-data/sales-references',
    query: {
      resource: 'sales-channels',
    },
  },
  {
    id: 'finance.accounting.general-ledger.base-information',
    group: 'finance',
    title: 'اطلاعات پایه',
    route: '/finance/accounting/general-ledger/base-information',
  },
  {
    id: 'finance.accounting.general-ledger.accounts',
    group: 'finance',
    title: 'حساب‌ها',
    route: '/finance/accounting/general-ledger/accounts',
  },
  {
    id: 'finance.accounting.general-ledger.documents',
    group: 'finance',
    title: 'اسناد',
    route: '/finance/accounting/general-ledger/documents',
  },
  {
    id: 'finance.accounting.general-ledger.year-end',
    group: 'finance',
    title: 'عملیات پایان سال',
    route: '/finance/accounting/general-ledger/year-end',
  },
  {
    id: 'finance.accounting.general-ledger.reports',
    group: 'finance',
    title: 'گزارش‌ها',
    route: '/finance/accounting/general-ledger/reports',
  },
  {
    id: 'finance.accounting.receipts-payments.reports',
    group: 'finance',
    title: 'گزارش پرداخت و دریافت',
    route: '/finance/accounting/receipts-payments/reports',
  },
];
export const USER_ACCESS_PROFILE_PERMISSION = 'ui.profile' as const;
export const screenPermission = (id: string): `ui.screen.${string}` =>
  `ui.screen.${id}`;
export function hasManagedAccess(permissions: readonly string[]) {
  return permissions.includes(USER_ACCESS_PROFILE_PERMISSION);
}
function hasGroupPermission(permissions: readonly string[], groupId: string) {
  const group = USER_ACCESS_GROUPS.find((item) => item.id === groupId);
  return (
    !!group &&
    permissions.some(
      (code) =>
        !['legal-entity.read', 'legal-entity.switch'].includes(code) &&
        group.prefixes.some(
          (prefix) => code === prefix || code.startsWith(prefix + '.'),
        ),
    )
  );
}
export function canViewScreen(permissions: readonly string[], id: string) {
  const screen = USER_ACCESS_SCREENS.find((item) => item.id === id);
  if (!screen || !hasGroupPermission(permissions, screen.group)) return false;
  if (
    hasManagedAccess(permissions) &&
    !permissions.includes(screenPermission(id))
  )
    return false;
  if (id === 'sales.home')
    return ['own', 'branch', 'all'].some((scope) =>
      permissions.includes('sales.contracts.read.' + scope),
    );
  if (id === 'sales.new-contract')
    return permissions.includes('sales.contracts.create');
  if (id === 'ticket-catalog.tab.issued')
    return permissions.includes('reservations.read');
  if (id.startsWith('sales.pricing') || id === 'sales.ticket-prices')
    return permissions.includes('package_pricing.read');
  return true;
}
export function screenForTab(
  route: string,
  tab: string,
  query: Readonly<Record<string, string>> = {},
) {
  const group = accessGroupForRoute(route);
  return USER_ACCESS_SCREENS.find(
    (s) =>
      s.group === group?.id &&
      s.tab === tab &&
      (!s.query ||
        Object.entries(s.query).every(([key, value]) => query[key] === value)),
  );
}
export function accessGroupForRoute(route: string) {
  if (route.startsWith('/users') || route.startsWith('/settings'))
    return USER_ACCESS_GROUPS.find((g) => g.id === 'system');
  if (route === '/hr' || route.startsWith('/hr/'))
    return USER_ACCESS_GROUPS.find((g) => g.id === 'hr');
  return [...USER_ACCESS_GROUPS]
    .sort((a, b) => b.route.length - a.route.length)
    .find((g) => route === g.route || route.startsWith(g.route + '/'));
}
export function canViewRoute(permissions: readonly string[], href: string) {
  if (!href.startsWith('/')) return true;
  const [pathname, search = ''] = href.split('?');
  const query: Record<string, string> = {};
  try {
    for (const item of search.split('#')[0]!.split('&').filter(Boolean)) {
      const [key, value = ''] = item.split('=');
      query[decodeURIComponent(key!)] = decodeURIComponent(value);
    }
  } catch {
    return false;
  }
  const url = {
    pathname:
      pathname!.split('#')[0] === '/users'
        ? '/system/users'
        : pathname!.split('#')[0]!,
    searchParams: {
      get: (key: string) => query[key] ?? null,
      has: (key: string) => Object.hasOwn(query, key),
    },
  };
  const group = accessGroupForRoute(url.pathname);
  if (!group) return true;
  if (!hasGroupPermission(permissions, group.id)) return false;
  if (
    url.pathname === '/sales/contracts/new' &&
    !permissions.includes('sales.contracts.create')
  )
    return false;
  if (!hasManagedAccess(permissions)) {
    if (url.pathname === '/sales/contracts/new')
      return permissions.includes('sales.contracts.create');
    if (!hasGroupPermission(permissions, group.id)) return false;
  }
  const route = url.pathname === '/hr' ? '/human-resources' : url.pathname;
  const candidates = USER_ACCESS_SCREENS.filter(
    (s) =>
      s.group === group.id &&
      (route === s.route || route.startsWith(s.route + '/')) &&
      (!s.query ||
        Object.entries(s.query).every(
          ([k, v]) => url.searchParams.get(k) === v,
        )),
  );
  const specific = candidates.filter((s) => s.query);
  if (specific.length) {
    const specificity = Math.max(
      ...specific.map((s) => Object.keys(s.query!).length),
    );
    return specific
      .filter((s) => Object.keys(s.query!).length === specificity)
      .some((s) => canViewScreen(permissions, s.id));
  }
  if (
    ['section', 'workspace', 'resource'].some((key) =>
      url.searchParams.has(key),
    )
  )
    return false;
  const longest = candidates.reduce((n, s) => Math.max(n, s.route.length), 0);
  if (route === group.route && !url.searchParams.has('section'))
    return USER_ACCESS_SCREENS.some(
      (s) => s.group === group.id && canViewScreen(permissions, s.id),
    );
  return candidates
    .filter((s) => s.route.length === longest && !s.tab)
    .some((s) => canViewScreen(permissions, s.id));
}
