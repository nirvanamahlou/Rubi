export type MarketingSectionKey =
  | 'dashboard'
  | 'campaigns'
  | 'audiences'
  | 'content'
  | 'offers'
  | 'journeys'
  | 'settings';

export interface MarketingSectionDefinition {
  key: MarketingSectionKey;
  title: string;
  description: string;
  highlights: readonly string[];
  tone: 'blue' | 'violet' | 'emerald' | 'amber' | 'rose' | 'cyan';
}

export interface MarketingSubtabDefinition {
  key: string;
  label: string;
  description: string;
}

export interface MarketingPreviewItem {
  id: `preview-${string}`;
  section: Exclude<MarketingSectionKey, 'dashboard'>;
  tab: string;
  title: string;
  description: string;
  status: string;
  meta: string;
  updatedAt: string;
}

export const marketingSections: readonly MarketingSectionDefinition[] = [
  {
    key: 'dashboard',
    title: 'داشبورد',
    description: 'نمای یکپارچه از شاخص‌ها، روندها، قیف و هشدارهای مارکتینگ',
    highlights: ['شاخص‌ها', 'روند', 'قیف', 'هشدار'],
    tone: 'blue',
  },
  {
    key: 'campaigns',
    title: 'کمپین‌ها',
    description: 'طراحی، زمان‌بندی، بودجه‌بندی و گردش تأیید کمپین‌ها',
    highlights: ['طراحی', 'زمان‌بندی', 'بودجه', 'تأیید'],
    tone: 'violet',
  },
  {
    key: 'audiences',
    title: 'مخاطبان',
    description: 'سگمنت‌ها، سرنخ‌ها، منابع ورود و کنترل رضایت مخاطبان',
    highlights: ['سگمنت', 'سرنخ', 'منبع', 'رضایت'],
    tone: 'emerald',
  },
  {
    key: 'content',
    title: 'محتوا و جذب',
    description: 'کتابخانه محتوا، فرم‌ها، صفحات فرود و لینک‌های رهگیری',
    highlights: ['کتابخانه', 'فرم', 'صفحه فرود'],
    tone: 'amber',
  },
  {
    key: 'offers',
    title: 'تخفیف‌ها و پیشنهادها',
    description: 'کدهای تخفیف، پیشنهادهای ویژه، قوانین و گزارش استفاده',
    highlights: ['کد تخفیف', 'پیشنهاد ویژه', 'استفاده'],
    tone: 'rose',
  },
  {
    key: 'journeys',
    title: 'سفر مشتری',
    description: 'ساخت سفر، اتوماسیون، سناریوهای آماده و تاریخچه اجرا',
    highlights: ['سفر', 'اتوماسیون', 'سناریو'],
    tone: 'violet',
  },
  {
    key: 'settings',
    title: 'تنظیمات',
    description: 'کانال‌ها، سایت‌ها، دسترسی‌ها، هشدارها و لاگ‌های امن',
    highlights: ['کانال', 'دو سایت', 'دسترسی', 'هشدار'],
    tone: 'emerald',
  },
] as const;

export const marketingSectionTabs = {
  campaigns: [
    ['list', 'همه کمپین‌ها', 'فهرست قابل جست‌وجو و فیلتر کمپین‌ها'],
    ['calendar', 'تقویم کمپین‌ها', 'نمای ماهانه بازه اجرای کمپین‌ها'],
    ['budget', 'بودجه و هزینه‌ها', 'مقایسه بودجه مصوب و هزینه ثبت‌شده'],
    ['approval', 'گردش تأیید', 'صف وضعیت و سوابق تأیید'],
  ],
  audiences: [
    ['segments', 'گروه‌ها و سگمنت‌ها', 'قواعد مخاطب بدون نگهداری PII'],
    ['campaign-audience', 'مخاطبان کمپین', 'انتساب سگمنت‌ها به کمپین‌ها'],
    ['leads', 'سرنخ‌های مارکتینگ', 'نمای تجمیعی سرنخ‌های ورودی'],
    ['scoring', 'امتیازدهی سرنخ', 'قواعد پیشنهادی امتیازدهی'],
    ['sources', 'منابع ورود', 'کانال و منبع اولیه ورود'],
  ],
  content: [
    ['library', 'کتابخانه محتوا و فایل‌ها', 'دارایی‌های نسخه‌دار بازاریابی'],
    ['forms', 'فرم‌ها', 'فرم‌های جذب و رضایت'],
    ['landing', 'صفحات فرود', 'صفحات فرود دو برند'],
    ['links', 'UTM، لینک کوتاه و QR', 'لینک‌های رهگیری ساختگی'],
  ],
  offers: [
    ['discounts', 'کدهای تخفیف', 'پیشنهادهای نیازمند اعتبارسنجی Sales'],
    ['specials', 'پیشنهادهای ویژه', 'بسته‌های پیشنهادی فروش'],
    ['usage', 'گزارش استفاده', 'نمای تجمیعی بدون داده مشتری'],
  ],
  journeys: [
    ['all', 'همه سفرها', 'سفرهای فعال و پیش‌نویس'],
    ['builder', 'ساخت اتوماسیون', 'مراحل و شرط‌های سناریوی نمایشی'],
    ['runs', 'اجرای اتوماسیون‌ها', 'اجرای ساختگی و بدون ارسال واقعی'],
    ['scenarios', 'سناریوهای آماده', 'الگوهای قابل کپی'],
    ['history', 'تاریخچه اجرا', 'خط زمانی نسخه‌دار'],
  ],
  settings: [
    ['channels', 'کانال‌ها و سرویس‌ها', 'وضعیت Adapterهای موردنیاز'],
    ['sites', 'تنظیمات دو سایت', 'تنظیمات برند و دامنه بدون Secret'],
    ['roles', 'نقش‌ها و دسترسی‌ها', 'پیشنهاد مجوزهای deny-by-default'],
    ['alerts', 'اعلان‌ها و هشدارها', 'قواعد هشدار عملیاتی'],
    ['general', 'تنظیمات عمومی', 'پیش‌فرض‌های محیط Preview'],
    ['logs', 'لاگ‌ها و خطاها', 'Trace ID امن و بدون داده حساس'],
  ],
} satisfies Record<
  Exclude<MarketingSectionKey, 'dashboard'>,
  readonly (readonly [string, string, string])[]
>;

const itemOverrides: Readonly<
  Record<string, readonly [string, string, string]>
> = {
  'audiences-segments': [
    'سگمنت سفر داخلی فعال',
    'قاعده رضایت معتبر + تعامل اخیر',
    'آماده بررسی',
  ],
  'audiences-campaign-audience': [
    'مخاطب کمپین بهاری',
    'اتصال به preview-segment-domestic',
    'متصل',
  ],
  'audiences-leads': [
    'سرنخ‌های ورودی هفته',
    'نمای تجمیعی؛ رکورد فردی نمایش داده نمی‌شود',
    'در انتظار قرارداد',
  ],
  'content-library': [
    'راهنمای تصویری سفر پاییز',
    'دارایی ساختگی با مالک نقش محتوا',
    'نسخه ۲',
  ],
  'content-forms': [
    'فرم درخواست مشاوره سفر',
    'چهار فیلد و کنترل رضایت کانال',
    'فعال Preview',
  ],
  'content-landing': [
    'صفحه فرود سفرهای فرهنگی',
    'نسخه مختص برند جهان باستان',
    'آماده انتشار',
  ],
  'content-links': [
    'لینک کمپین بهاری',
    'utm_campaign=spring-domestic-preview',
    'فعال Preview',
  ],
  'offers-discounts': [
    'SPRING-PREVIEW',
    'کد پیشنهادی؛ اعتبارسنجی نهایی با Sales',
    'پیشنهادی',
  ],
  'offers-specials': [
    'بسته پرداخت مرحله‌ای',
    'قیمت نهایی در این ماژول محاسبه نمی‌شود',
    'پیشنهادی',
  ],
  'journeys-all': [
    'سفر بازگشت مشتری غیرفعال',
    'سه مرحله با کنترل رضایت پیش از هر ارسال',
    'پیش‌نویس',
  ],
  'journeys-builder': [
    'شروع ← بررسی رضایت ← نیت ارسال',
    'گردش نمایشی بدون اجرای Provider',
    'قابل ویرایش',
  ],
  'journeys-scenarios': [
    'سناریوی خوش‌آمدگویی سرنخ',
    'الگوی چهارمرحله‌ای قابل کپی',
    'آماده استفاده',
  ],
  'settings-channels': [
    'Adapter پیامک سازمانی',
    'Credential در Marketing نگهداری نمی‌شود',
    'در انتظار اتصال',
  ],
  'settings-sites': [
    'پروفایل دو برند روبی',
    'تنظیمات نمایشی نیایش سیر سحر و جهان باستان',
    'پیکربندی‌شده',
  ],
  'settings-roles': [
    'نقش مدیر کمپین',
    'دسترسی‌های پیشنهادی و deny-by-default',
    'نیازمند IAM',
  ],
  'settings-alerts': [
    'هشدار عبور هزینه از بودجه',
    'آستانه پیشنهادی ۸۰٪ و ۱۰۰٪',
    'فعال Preview',
  ],
  'settings-logs': [
    'Trace امن عملیات Preview',
    'بدون نام، شماره تماس، ایمیل یا Secret',
    'قابل مشاهده',
  ],
};

export const marketingPreviewItems: readonly MarketingPreviewItem[] =
  Object.entries(marketingSectionTabs).flatMap(([section, tabs]) =>
    section === 'campaigns'
      ? []
      : tabs.map(([tab, label, description], index) => {
          const override = itemOverrides[`${section}-${tab}`];
          return {
            id: `preview-${section}-${tab}` as const,
            section: section as MarketingPreviewItem['section'],
            tab,
            title: override?.[0] ?? label,
            description: override?.[1] ?? description,
            status: override?.[2] ?? 'آماده Preview',
            meta: `نسخه نمایشی ${(index + 1).toLocaleString('fa-IR')}`,
            updatedAt: `2026-09-${String(Math.min(9, index + 1)).padStart(2, '0')}T08:30:00.000Z`,
          };
        }),
  );

export function previewItemsFor(
  section: MarketingPreviewItem['section'],
  tab: string,
): readonly MarketingPreviewItem[] {
  return marketingPreviewItems.filter(
    (item) => item.section === section && item.tab === tab,
  );
}
