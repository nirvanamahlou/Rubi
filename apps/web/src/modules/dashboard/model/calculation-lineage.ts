// Audited against ReportingNativeDashboard and its owner-controlled readers.
// Required registry sources describe future contracts, not active database views.
const nativeFeatures = {
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
