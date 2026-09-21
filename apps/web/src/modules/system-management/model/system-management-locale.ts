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
  tasks: 'Workspace & automation',
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
  'ارتباط با مشتری': 'Customer communication',
  'رضایت و حریم خصوصی': 'Consent & privacy',
  'زمان پاسخ و حل درخواست': 'Response & resolution time',
  'تخصیص و ارجاع': 'Assignment & escalation',
  'بستن درخواست': 'Request closure',
  'پیشنهاد و پیش‌فاکتور': 'Quotation & proforma invoice',
  'تخفیف و حاشیه سود': 'Discounts & profit margin',
  'قیمت کانال‌های فروش': 'Sales-channel pricing',
  'قرارداد و الحاقیه': 'Contracts & amendments',
  'تحویل اسناد سفر': 'Travel-document delivery',
  'پنجره فروش و ظرفیت': 'Sales window & capacity',
  'انتشار نرخ و کلاس': 'Fare & class publishing',
  'هوایی، قطار و اتوبوس': 'Air, rail & bus',
  'پکیج و نوبت تور': 'Tour packages & departures',
  'استعلام و نگهداشت ظرفیت': 'Availability inquiry & hold',
  'صدور و مدیریت خطا': 'Issuance & error management',
  'فرم کارگزار و واچر هتل': 'Supplier form & hotel voucher',
  'Manifest و ارسال': 'Manifest & dispatch',
  'ویزا، ترانسفر و CIP': 'Visa, transfer & CIP',
  'بیمه، لغو و استرداد': 'Insurance, cancellation & refund',
  'حد اختیار و مراحل تأیید': 'Approval limits & workflow',
  'استعلام و تأمین‌کننده': 'RFQ & suppliers',
  'خرید اضطراری و برآورد': 'Emergency purchase & estimate',
  'دریافت خدمت و فاکتور': 'Service receipt & invoice',
  'پرداخت و استرداد': 'Payment & refund',
  'آزادسازی مدارک سفر': 'Travel-document release',
  'چک و یادآوری سررسید': 'Checks & due-date reminders',
  'تطبیق بانکی و تسویه': 'Bank reconciliation & settlement',
  'نرخ ارز و دریافت‌ها': 'Exchange rates & receipts',
  'مخاطبان و دفعات ارتباط': 'Audiences & contact frequency',
  'بودجه و تأیید کمپین': 'Campaign budget & approval',
  'انتساب و رهگیری': 'Attribution & tracking',
  'کد تخفیف و زمان ارسال': 'Promo codes & send time',
  'کنترل اعتبار سازمانی': 'Corporate credit control',
  'صورتحساب و دوره تسویه': 'Billing & settlement cycle',
  'نرخ توافقی و پورسانت': 'Negotiated rates & commission',
  'کاربران و همکاری': 'Users & collaboration',
  'کارکرد و شیفت': 'Attendance & shifts',
  'مرخصی و اضافه‌کاری': 'Leave & overtime',
  'حقوق و مبانی پرداخت': 'Payroll & payment basis',
  'استخدام و پایان همکاری': 'Hiring & offboarding',
  'ارزیابی و آموزش': 'Performance & training',
  'محرمانگی و هزینه کارکنان': 'Employee privacy & expenses',
  'وظایف و سررسید': 'Tasks & due dates',
  'اجرای خودکار': 'Automated execution',
  'نمای میزکار': 'Workspace view',
  'درخواست و تأیید داخلی': 'Internal requests & approval',
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
  'نمایش کاتالوگ‌ها': 'Catalog display',
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
  'فرم و تأیید مشتری': 'Form with customer confirmation',
  'تأیید دیجیتال': 'Digital confirmation',
  'پیامک و کد تأیید': 'SMS verification code',
  'ایمیل و لینک تأیید': 'Email verification link',
  'امضای الکترونیکی': 'Electronic signature',
  'ضبط مکالمه با اعلام رضایت': 'Recorded call with explicit consent',
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
