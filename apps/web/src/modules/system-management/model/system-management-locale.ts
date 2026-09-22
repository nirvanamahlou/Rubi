import type {
  SettingField,
  SettingGroup,
  SettingModule,
} from './settings-catalog';

export type SystemManagementLanguage = 'en' | 'fa';

const moduleTitles: Record<string, string> = {
  general: 'Organization & display',
  access: 'Users & security',
  customers: 'Customers & travelers',
  affairs: 'Customer service & support',
  sales: 'Sales, contracts & pricing',
  catalog: 'Tickets & itineraries',
  operations: 'Reservations & travel services',
  procurement: 'Purchasing & procurement',
  finance: 'Finance & treasury',
  marketing: 'Marketing',
  b2b: 'Agencies & corporate customers',
  hr: 'Human resources',
  tasks: 'Workspace',
  messages: 'Messages & notifications',
  documents: 'Documents & files',
  reports: 'Reports & management views',
  integrations: 'Integrations & websites',
  master: 'Master data',
};

const categoryTitles: Record<string, string> = {
  'فضای کار': 'Workspace',
  'فروش و ارتباط با مشتری': 'Sales & customer relations',
  'رزرواسیون و تأمین سفر': 'Reservations & travel supply',
  مالی: 'Finance',
  'سرمایه انسانی': 'Human resources',
  'اسناد و گزارش‌ها': 'Documents & reports',
  'تنظیمات شرکت': 'Company settings',
  مدیریت: 'Management',
  'مشتری و فروش': 'Customers & sales',
  'عملیات سفر': 'Travel operations',
  'مالی و همکاری': 'Finance & partnerships',
  'سازمان و بهره‌وری': 'Organization & productivity',
  'زیرساخت و داده': 'Infrastructure & data',
};

const groupTitles: Record<string, string> = {
  'زبان و قالب نمایش': 'Language & display format',
  'تقویم کاری و منطقه زمانی': 'Working calendar & time zone',
  'شماره‌گذاری اسناد': 'Document numbering',
  'نشست و ورود': 'Sessions & sign-in',
  'احراز هویت': 'Authentication',
  'جانشینی و دسترسی موقت': 'Delegation & temporary access',
  'بازبینی دسترسی‌ها': 'Access reviews',
  'تشخیص و ادغام تکراری‌ها': 'Duplicate detection & merge',
  'مدارک سفر': 'Travel documents',
  'زمان پاسخ و حل درخواست': 'Response & resolution time',
  'تخصیص و ارجاع': 'Assignment & escalation',
  'بستن درخواست': 'Request closure',
  'پیشنهاد و پیش‌فاکتور': 'Quotation & proforma invoice',
  'تخفیف و حاشیه سود': 'Discounts & profit margin',
  'قرارداد و الحاقیه': 'Contracts & amendments',
  'تحویل اسناد سفر': 'Travel-document delivery',
  'پنجره فروش و ظرفیت': 'Sales window & capacity',
  'انتشار نرخ و کلاس': 'Fare & class publishing',
  'Manifest و ارسال': 'Manifest & dispatch',
  'ویزا، ترانسفر و CIP': 'Visa, transfer & CIP',
  'بیمه، لغو و استرداد': 'Insurance, cancellation & refund',
  'حد اختیار و مراحل تأیید': 'Approval limits & workflow',
  'دریافت خدمت و فاکتور': 'Service receipt & invoice',
  'پرداخت و استرداد': 'Payment & refund',
  'آزادسازی مدارک سفر': 'Travel-document release',
  'چک و یادآوری سررسید': 'Checks & due-date reminders',
  'تطبیق بانکی و تسویه': 'Bank reconciliation & settlement',
  'نرخ ارز و دریافت‌ها': 'Exchange rates & receipts',
  'مخاطبان و دفعات ارتباط': 'Audiences & contact frequency',
  'بودجه و تأیید کمپین': 'Campaign budget & approval',
  'کد تخفیف و زمان ارسال': 'Promo codes & send time',
  'کنترل اعتبار سازمانی': 'Corporate credit control',
  'صورتحساب و دوره تسویه': 'Billing & settlement cycle',
  'نرخ توافقی و پورسانت': 'Negotiated rates & commission',
  'کارکرد و شیفت': 'Attendance & shifts',
  'مرخصی و اضافه‌کاری': 'Leave & overtime',
  'حقوق و مبانی پرداخت': 'Payroll & payment basis',
  'استخدام و پایان همکاری': 'Hiring & offboarding',
  'محرمانگی و هزینه کارکنان': 'Employee privacy & expenses',
  'وظایف و سررسید': 'Tasks & due dates',
  'نمای میزکار': 'Workspace view',
  'کانال و هشدار فوری': 'Channels & urgent alerts',
  'سکوت و خلاصه روزانه': 'Quiet hours & daily digest',
  'گفت‌وگوی سازمانی': 'Team chat',
  'قالب و زبان پیام': 'Message template & language',
  'بارگذاری و انواع فایل': 'Upload & file types',
  'دسترسی و دانلود': 'Access & downloads',
  'نسخه و انقضا': 'Versions & expiration',
  'چاپ و خروجی': 'Print & export',
  'فیلترهای پیش‌فرض': 'Default filters',
  'خروجی و فایل گزارش': 'Report exports & files',
  'گزارش زمان‌بندی‌شده': 'Scheduled reports',
  'هشدار کیفیت داده': 'Data-quality alerts',
  'پاسخ و بازیابی اتصال': 'Connection response & recovery',
  'Webhook و همگام‌سازی': 'Webhooks & synchronization',
  'پیش‌فرض دو وب‌سایت': 'Website defaults',
  'سلامت و هشدار سرویس': 'Service health & alerts',
  'ورود گروهی و فایل Excel': 'Bulk import & Excel',
  'تأیید و اعتبار نرخ ارز': 'Exchange-rate approval & validity',
  'کارگزار و مراجع خدمات': 'Suppliers & service providers',
};

const fieldLabels: Record<string, string> = {
  'زبان پیش‌فرض': 'Default language',
  'تقویم نمایش': 'Display calendar',
  'نمایش اعداد': 'Number format',
  'نمایش مبلغ ریالی': 'Rial amount display',
  'منطقه زمانی': 'Time zone',
  'شروع ساعت کاری': 'Workday starts',
  'پایان ساعت کاری': 'Workday ends',
  'تعطیلی هفتگی': 'Weekly days off',
  'آغاز دوباره شمارنده': 'Counter reset',
  'تعداد ارقام شمارنده': 'Counter digits',
  'درج کد شعبه': 'Include branch code',
  'هشدار پایان مجوز': 'License expiry warning',
  'وضعیت همکاری اولیه': 'Initial cooperation status',
  'مرجع تأیید پروفایل': 'Profile approval authority',
  'مرجع تأیید نرخ': 'Exchange-rate approval authority',
  'نام قالب': 'Template name',
  'فایل قالب': 'Template file',
};

const valueLabels: Record<string, string> = {
  فارسی: 'Persian',
  شمسی: 'Persian',
  میلادی: 'Gregorian',
  لاتین: 'Latin',
  ریال: 'Rial',
  تومان: 'Toman',
  جمعه: 'Friday',
  'پنجشنبه و جمعه': 'Thursday & Friday',
  سالانه: 'Annually',
  'بدون بازنشانی': 'Never reset',
  'در حال بررسی': 'Under review',
  'در انتظار تکمیل مدارک': 'Awaiting documents',
  'تأیید مشروط': 'Conditionally approved',
  فعال: 'Active',
  معلق: 'Suspended',
  غیرفعال: 'Inactive',
  ردشده: 'Rejected',
  'مدیر تأمین': 'Procurement manager',
  'سرپرست اطلاعات پایه': 'Master data supervisor',
  'مدیر عملیات': 'Operations manager',
  'مدیر مالی': 'Finance manager',
  'مدیر ارشد اجرایی': 'Chief executive officer',
  'کمیته ارزیابی تأمین‌کنندگان': 'Supplier evaluation committee',
  'مسئول نرخ ارز': 'Exchange-rate officer',
  'سرپرست خزانه‌داری': 'Treasury supervisor',
  'مدیر حسابداری': 'Accounting manager',
  'مدیر ارشد مالی': 'Chief financial officer',
  'کمیته نرخ ارز': 'Exchange-rate committee',
  'قالب قرارداد خدمات سفر': 'Travel services contract template',
  'فایلی بارگذاری نشده است': 'No file uploaded',
  'داخل سامانه': 'In-app',
  ایمیل: 'Email',
  واتساپ: 'WhatsApp',
  تلگرام: 'Telegram',
  'مسئول پرونده': 'Case owner',
  'مسئول پرونده و سرپرست': 'Case owner and supervisor',
  'کارشناس فروش': 'Sales specialist',
  'سرپرست فروش': 'Sales supervisor',
  'واحد عملیات سفر': 'Travel operations team',
  'مدیر شعبه': 'Branch manager',
  'سرپرست پشتیبانی': 'Support supervisor',
  'مدیر امور مشتریان': 'Customer service manager',
  'مدیر تجربه مشتری': 'Customer experience manager',
  'مدیر سیستم': 'System administrator',
  'مدیر فروش': 'Sales manager',
  'مدیر قراردادها': 'Contracts manager',
  'مدیر بازرگانی': 'Commercial manager',
  مدیرعامل: 'Chief executive officer',
  'مدیر تعریف بلیت': 'Ticketing configuration manager',
  'سرپرست نرخ‌گذاری': 'Pricing supervisor',
  'کمیته نرخ‌گذاری': 'Pricing committee',
  'سرپرست رزرواسیون': 'Reservations supervisor',
  'مسئول پرواز': 'Flight operations officer',
  'کارشناس کنترل مدارک': 'Document control specialist',
  'مدیر عملیات سفر': 'Travel operations manager',
  'مسئول خدمات فرودگاهی': 'Airport services officer',
  'تیم رزرواسیون': 'Reservations team',
  'سرپرست عملیات': 'Operations supervisor',
  'کارشناس خدمات پس از فروش': 'After-sales specialist',
  'مدیر خرید ← مدیر مالی': 'Procurement manager → Finance manager',
  'مدیر خرید ← مدیر مالی ← مدیرعامل':
    'Procurement manager → Finance manager → CEO',
  'سرپرست تأمین ← مدیر خرید': 'Procurement supervisor → Procurement manager',
  'مدیر واحد ← مدیر خرید ← مدیر مالی':
    'Department manager → Procurement manager → Finance manager',
  'کمیته خرید ← مدیرعامل': 'Procurement committee → CEO',
  'مدیر خرید و مدیر مالی': 'Procurement and finance managers',
  'مدیر واحد و مدیر خرید': 'Department and procurement managers',
  'کمیته خرید': 'Procurement committee',
  'مدیر خرید': 'Procurement manager',
  'سرپرست تأمین': 'Procurement supervisor',
  'مدیر واحد درخواست‌کننده': 'Requesting department manager',
  'مدیر مالی ارشد': 'Senior finance manager',
  'کمیته مالی': 'Finance committee',
  'مسئول مالی شعبه': 'Branch finance officer',
  'سرپرست خزانه': 'Treasury supervisor',
  'کارشناس خزانه': 'Treasury specialist',
  'مالک چک': 'Check owner',
  'کارشناس تطبیق بانکی': 'Bank reconciliation specialist',
  'مدیر بازاریابی': 'Marketing manager',
  'مدیر برند': 'Brand manager',
  'مدیر حساب': 'Account manager',
  'مدیر B2B': 'B2B manager',
  'سرپرست فروش سازمانی': 'Corporate sales supervisor',
  'مدیر مستقیم': 'Direct manager',
  'مدیر مستقیم و منابع انسانی': 'Direct manager and HR',
  'مدیر واحد': 'Department manager',
  'مدیر منابع انسانی': 'HR manager',
  'جانشین مدیر': 'Acting manager',
  'مدیر واحد و منابع انسانی': 'Department manager and HR',
  'مدیر ارشد منابع انسانی': 'Chief human resources officer',
  'کمیته جبران خدمات': 'Compensation committee',
  'کارشناس منابع انسانی': 'HR specialist',
  'مسئول فناوری اطلاعات': 'IT officer',
  'مسئول اموال': 'Asset custodian',
  'کارشناس اداری': 'Administrative specialist',
  'مدیر مستقیم و مالی': 'Direct manager and finance',
  'مدیر واحد و مالی': 'Department manager and finance',
  'سرپرست واحد': 'Department supervisor',
  'کارشناس DevOps': 'DevOps specialist',
  'پشتیبانی فناوری اطلاعات': 'IT support',
  'مالک فرایند': 'Process owner',
  'مالک پرونده': 'Record owner',
  'مالک پرونده و سرپرست': 'Record owner and supervisor',
  'مسئول بایگانی': 'Records custodian',
  'کارشناس اسناد': 'Documents specialist',
  'مسئول گزارش‌ها': 'Reporting officer',
  'تحلیلگر هوش تجاری': 'Business intelligence analyst',
  'مدیر داده': 'Data manager',
  'مدیر ماژول مربوط': 'Relevant module manager',
  'مدیر زیرساخت': 'Infrastructure manager',
  'مسئول امنیت': 'Security officer',
  'مالک سرویس': 'Service owner',
  روز: 'days',
  'روز قبل': 'days before',
  'روز ماه': 'day of month',
  ساعت: 'hours',
  دقیقه: 'minutes',
  ثانیه: 'seconds',
  درصد: 'percent',
  بار: 'attempts',
  نشست: 'sessions',
  پرونده: 'cases',
  صندلی: 'seats',
  فایل: 'files',
  ردیف: 'rows',
  رقم: 'digits',
  خطا: 'errors',
};

const persianPattern = /[\u0600-\u06ff]/;

function humanize(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/^./, (character) => character.toUpperCase());
}

export function englishText(value: string, fallback = 'Configured value') {
  if (!persianPattern.test(value)) return value;
  return valueLabels[value] ?? fallback;
}

export function localizeCategory(
  title: string,
  language: SystemManagementLanguage,
) {
  return language === 'en' ? (categoryTitles[title] ?? title) : title;
}

function localizeField(field: SettingField): SettingField {
  return {
    ...field,
    label: fieldLabels[field.label] ?? humanize(field.key),
    ...(field.unit ? { unit: englishText(field.unit, 'units') } : {}),
  };
}

function localizeGroup(group: SettingGroup): SettingGroup {
  return {
    ...group,
    title: groupTitles[group.title] ?? humanize(group.id),
    fields: group.fields.map(localizeField),
    rules: group.rules.map(
      () => 'This policy is enforced and audited by the owning module.',
    ),
  };
}

export function localizeSettingModules(
  modules: readonly SettingModule[],
  language: SystemManagementLanguage,
): SettingModule[] {
  if (language === 'fa') return [...modules];
  return modules.map((module) => ({
    ...module,
    title: moduleTitles[module.id] ?? humanize(module.id),
    category: localizeCategory(module.category, language),
    groups: module.groups.map(localizeGroup),
  }));
}

export function localizeOption(option: string, index: number) {
  return englishText(option, `Option ${index + 1}`);
}

export function containsPersian(value: string) {
  return persianPattern.test(value);
}
