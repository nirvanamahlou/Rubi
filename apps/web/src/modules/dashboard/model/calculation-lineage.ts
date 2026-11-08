// Audited against ReportingNativeDashboard and its owner-controlled readers.
// Required registry sources describe future contracts, not active database views.
const nativeFeatures = {
  behavior: {
    label: 'سیگنال معتبر درخواست و خرید مشتری',
    description:
      'درخواست ساختاریافته و خرید دارای پرداخت تأییدشده از مالکان دامنه خوانده می‌شوند؛ مشتری اصلی و هر دسته فقط یک‌بار شمرده می‌شوند و استرداد بدون تخصیص خدمت، جمع ناقص تولید نمی‌کند.',
  },
  issued: {
    label: 'اسناد صدور رزرو',
    description:
      'سند واقعی مسافر در رزرو قرارداد معتبر و غیرلغوشده با زمان صدور خوانده می‌شود؛ ثبت خرید، تخصیص صندلی و فایل عمومی جای سند صدور نیست.',
  },
  staff: {
    label: 'انتساب کارشناس و مقصد',
    description:
      'مالک قرارداد و مقصد و کشور مرجع از ارتباط‌های واقعی خوانده می‌شوند؛ نام کارشناس از مرجع مجاز هویت و مقصد از اطلاعات پایه می‌آید.',
  },
  cancellation: {
    label: 'رخدادهای لغو قرارداد',
    description:
      'تغییر واقعی وضعیت به لغوشده و زمان همان رخداد را می‌شمارد؛ مبلغ استرداد و زمان ایجاد قرارداد جای رخداد لغو نیست.',
  },
  stays: {
    label: 'اقامت‌های معتبر هتل',
    description:
      'انتخاب هتل و اقامت‌های بعدی قرارداد نهایی را با تاریخ ورود و خروج می‌خواند؛ هر قرارداد/هتل یک‌بار و شب اقامت از اختلاف تاریخ واقعی محاسبه می‌شود.',
  },
  inventory: {
    label: 'ظرفیت فعال پرواز',
    description:
      'ظرفیت عرضه فعال، تخصیص فعال و نگه‌داشت منقضی‌نشده را از موجودی واقعی می‌خواند؛ تاریخچه ظرفیت از وضعیت فعلی ساخته نمی‌شود.',
  },
  calls: {
    label: 'گزارش مجاز تماس کارشناسان',
    description:
      'از گزارش بومی کال‌سنتر با همان محدودیت دسترسی، انتساب پاسخ‌دهنده و تماس یکتا استفاده می‌کند؛ تماس فاقد انتساب یا دستی بدون پوشش کامل وارد جمع نمی‌شود.',
  },
  support: {
    label: 'درخواست‌های واقعی پشتیبانی',
    description:
      'وضعیت و زمان نخستین پاسخ ثبت‌شده را می‌خواند؛ درخواست داخلی و کال‌سنتر از پشتیبانی جدا هستند و پاسخ ثبت‌نشده صفر دقیقه نیست.',
  },
  attendance: {
    label: 'کارکرد روزانه معتبر کارکنان',
    description:
      'آخرین رکورد هر کارمند/روز با حضور معتبر و دقیقه کار مثبت را می‌خواند؛ غیبت، روز غیرکاری و نیازمند بررسی حذف می‌شوند و اضافه‌کاری از دقیقه واقعی به ساعت تبدیل می‌شود.',
  },
  acquisition: {
    label: 'روش آشنایی مرجع مشتری',
    description:
      'مشتری فعال و ادغام‌نشده با روش آشنایی ثبت‌شده و زمان ایجاد را می‌خواند؛ مشتری با روش نامشخص به کانالی نسبت داده نمی‌شود.',
  },
  documents: {
    label: 'فراداده اسناد مجاز',
    description:
      'نسخه جاری، نقص، انقضا و ماژول سند داخلی مجاز را می‌خواند؛ اسناد محرمانه، حذف‌شده و ضمیمه بازخورد دیگران خارج‌اند.',
  },
  contracts: {
    label: 'قراردادهای فروش',
    description:
      'وضعیت قرارداد، زمان ایجاد و تأیید، خریدار و شعبه را از اطلاعات قرارداد می‌خواند؛ هر قرارداد مستقل از تعداد مسافران شمرده می‌شود.',
  },
  prices: {
    label: 'اجزای مبلغ قرارداد',
    description:
      'مبلغ، نوع جزء قیمت، تخفیف و ارز را از مبالغ ثبت‌شده قرارداد می‌خواند؛ مبلغ فروش از این اجزا به دست می‌آید، نه از مبلغ وصول.',
  },
  refunds: {
    label: 'بازپرداخت‌های انجام‌شده',
    description:
      'مبلغ و زمان بازپرداخت ثبت‌شده و ارتباط آن با پرداخت و قرارداد را می‌خواند. در فروش خالص، بازپرداخت همان قرارداد تا پایان بازه کسر می‌شود؛ در شاخص استرداد، زمان خود بازپرداخت ملاک است.',
  },
  receipts: {
    label: 'پرداخت‌های تأییدشده مالی',
    description:
      'مبلغ، ارز و زمان تأیید مالی پرداخت قرارداد را می‌خواند. وصول بر اساس زمان تأیید مالی محاسبه می‌شود؛ برنامه پرداخت یا رسید تأییدنشده وصول محسوب نمی‌شود.',
  },
  buyers: {
    label: 'سابقه خرید پرداخت‌شده مشتری',
    description:
      'شناسه خریدار قرارداد، زمان تأیید قرارداد و اولین پرداخت تأییدشده را بررسی می‌کند. سابقه خرید موفق قبلی در کل شرکت برای تفکیک مشتری جدید و بازگشتی بررسی می‌شود؛ نام، تلفن یا تعداد مسافران جای شناسه مشتری را نمی‌گیرد.',
  },
  leads: {
    label: 'درخواست‌های اولیه و ارجاع به فروش',
    description:
      'زمان ایجاد لید، مشتری متصل و ارجاع پذیرفته‌شده به قرارداد را می‌خواند؛ لید دارای خرید موفق مرتبط تا پایان بازه از لیدهای جدید خارج می‌شود.',
  },
  services: {
    label: 'نوع خدمات قرارداد',
    description:
      'نوع خدمات ثبت‌شده قرارداد را فقط برای دسته‌بندی فروش می‌خواند. مبلغ از اجزای قیمت قرارداد می‌آید؛ قرارداد چندخدمتی بدون مبلغ تفکیکی یک بار در خدمات ترکیبی قرار می‌گیرد.',
  },
} as const;
type Feature = keyof typeof nativeFeatures;
const metrics: Readonly<Record<string, readonly Feature[]>> = {
  'customer-interest-coverage': ['behavior'],
  'customer-service-usage': ['behavior'],
  'customer-interest-count': ['behavior'],
  'employee-finalized-sales-count': ['contracts', 'staff'],
  'employee-sales-amount': ['contracts', 'prices', 'refunds', 'staff'],
  'employee-average-sale': ['contracts', 'prices', 'refunds', 'staff'],
  'employee-contract-count': ['contracts', 'staff'],
  'employee-cancellation-count': ['cancellation', 'staff'],
  'cancelled-orders': ['cancellation'],
  'hotel-reservations': ['contracts', 'stays'],
  'average-stay-length': ['contracts', 'stays'],
  'active-offers': ['inventory'],
  'remaining-capacity': ['inventory'],
  'sell-through-rate': ['inventory'],
  'inventory-allocated': ['inventory'],
  'inventory-held': ['inventory'],
  'inventory-free': ['inventory'],
  'employee-call-count': ['calls'],
  'employee-connected-call-count': ['calls'],
  'open-tickets': ['support'],
  'support-ticket-count': ['support'],
  'first-response-time': ['support'],
  'employee-workdays': ['attendance'],
  'employee-overtime': ['attendance'],
  'customers-by-acquisition-channel': ['acquisition'],
  'customer-destination-demand': ['contracts', 'staff'],
  'issued-documents': ['contracts', 'issued'],
  'document-count': ['documents'],
  'document-incomplete': ['documents'],
  'document-expired': ['documents'],
  'gross-sales': ['contracts', 'prices'],
  'net-sales': ['contracts', 'prices', 'refunds'],
  'discount-amount': ['contracts', 'prices'],
  'average-sale-value': ['contracts', 'prices', 'refunds'],
  'new-orders': ['contracts', 'prices'],
  'finalized-sales-count': ['contracts', 'prices'],
  collected: ['receipts', 'contracts'],
  refunded: ['refunds', 'contracts'],
  'new-customers': ['buyers', 'receipts', 'contracts'],
  'returning-customers': ['buyers', 'receipts', 'contracts'],
  'new-leads': ['leads', 'buyers', 'receipts'],
  'lead-growth-rate': ['leads', 'buyers', 'receipts'],
};
const visualMetrics: Readonly<Record<string, readonly string[]>> = {
  'treasury-flow': ['collected', 'refunded'],

  'customer-service-distribution': ['customer-service-usage'],
  'customer-interest-distribution': ['customer-interest-count'],
  'employee-calls-by-agent': [
    'employee-call-count',
    'employee-connected-call-count',
  ],
  'workforce-capacity': ['employee-workdays'],
  'customer-acquisition-channel-mix': ['customers-by-acquisition-channel'],
  'customer-acquisition-channel-trend': ['customers-by-acquisition-channel'],
  'sales-destination-ranking': ['net-sales'],
  'sales-country-ranking': ['net-sales'],
  'agent-ranking': ['net-sales'],
  'employee-sales-count-by-agent': ['employee-finalized-sales-count'],
  'employee-sales-amount-by-agent': ['employee-sales-amount'],
  'employee-average-sale-by-agent': ['employee-average-sale'],
  'employee-contracts-by-agent': [
    'employee-contract-count',
    'employee-finalized-sales-count',
  ],
  'employee-cancellations-by-agent': ['employee-cancellation-count'],
  'discount-analysis': ['discount-amount'],
  'average-sale-trend': ['average-sale-value'],
  'inventory-capacity': [
    'inventory-allocated',
    'inventory-held',
    'inventory-free',
  ],
  'inventory-departure-curve': ['remaining-capacity'],
  'hotel-sales-ranking': ['hotel-reservations'],
  'average-stay-analysis': ['average-stay-length'],
  'document-quality-overview': [
    'document-count',
    'document-incomplete',
    'document-expired',
  ],
  'support-breakdown': ['support-ticket-count'],
  'revenue-collections': ['net-sales'],
  'executive-trend': ['net-sales', 'collected'],
  'sales-collection-trend': ['net-sales', 'collected', 'refunded'],
  'finalized-sales-trend': ['net-sales'],
  'discount-trend': ['discount-amount'],
  'executive-lead-acquisition': ['new-leads'],
  'customer-growth-overview': ['new-leads', 'new-customers', 'new-orders'],
  'finance-profit-trend': ['net-sales'],
  'executive-customer-retention': ['new-customers', 'returning-customers'],
  'executive-sales-by-service': ['net-sales'],
  'service-type': ['net-sales'],
  'service-sales-portfolio': ['net-sales'],
  'sales-weekday-pattern': ['net-sales'],
};
const serviceVisuals = new Set([
  'executive-sales-by-service',
  'service-type',
  'service-sales-portfolio',
]);

export function nativeCalculationFeatures(id: string) {
  const ids = metrics[id] ? [id] : visualMetrics[id];
  if (!ids) return null;
  const keys = new Set(ids.flatMap((metric) => metrics[metric] ?? []));
  if (serviceVisuals.has(id)) keys.add('services');
  return [...keys].map((key) => nativeFeatures[key]);
}
