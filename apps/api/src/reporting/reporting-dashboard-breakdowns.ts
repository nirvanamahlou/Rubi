import { Prisma } from '@nora/database';
import type {
  DashboardObservation,
  DashboardSourceMetric,
} from '../common/dashboard-source';
import type { DashboardProjectionV1 } from './reporting.contracts';

type Breakdown = {
  metrics: readonly string[];
  dimension: string;
  notice?: string;
  seriesDimension?: string;
  missingMetrics?: readonly string[];
};
/** Explicit chart/measure lineage. Never infer a missing source from a chart title. */
export const dashboardBreakdowns: Readonly<Record<string, Breakdown>> = {
  'customer-destination-distribution': {
    metrics: ['finalized-sales-count'],
    dimension: 'destination',
    notice:
      'تعداد قرارداد نهایی‌شده به تفکیک مقصد؛ هر قرارداد یک‌بار شمرده می‌شود. شمار مسافران منبع مستقل می‌خواهد و از تعداد قرارداد حدس زده نمی‌شود.',
  },
  'support-time-trend': {
    metrics: ['first-response-time'],
    missingMetrics: ['resolution-time'],
    dimension: 'date',
    notice:
      'میانگین زمان نخستین پاسخ واقعی به تفکیک روز پاسخ در زمان تهران؛ روز فاقد پاسخ صفر نیست. زمان حل تا انتشار منبع معتبر نمایش داده نمی‌شود.',
  },
  'workforce-performance': {
    metrics: ['employee-overtime'],
    missingMetrics: ['employee-performance'],
    dimension: 'date',
    notice:
      'ساعت اضافه‌کاری ثبت‌شده در آخرین حضور معتبر هر کارمند و روز؛ امتیاز ارزیابی عملکرد تا اتصال منبع مصوب نمایش داده نمی‌شود.',
  },
  'customer-service-distribution': {
    metrics: ['customer-service-usage'],
    dimension: 'service',
    notice:
      'مشتری در هر نوع خدمت یک‌بار شمرده می‌شود و می‌تواند در چند خدمت حضور داشته باشد؛ تعداد سفارش و مبلغ فروش جای این شمارنده نیستند.',
  },
  'customer-interest-distribution': {
    metrics: ['customer-interest-count'],
    dimension: 'interest',
    notice:
      'درخواست ساختاریافته و خرید موفق مشتری اصلی؛ هر مشتری در هر دسته یک‌بار و بدون حدس از متن آزاد.',
  },
  'employee-calls-by-agent': {
    metrics: ['employee-call-count', 'employee-connected-call-count'],
    dimension: 'agent',
  },
  'workforce-capacity': {
    metrics: ['employee-workdays'],
    missingMetrics: ['employee-leave'],
    dimension: 'unit',
    notice:
      'فقط روز کارکرد معتبر واحدها؛ بار مرخصی تا اتصال روزهای مرخصی تأییدشده محاسبه نمی‌شود.',
  },
  'customer-acquisition-channel-mix': {
    metrics: ['customers-by-acquisition-channel'],
    dimension: 'channel',
  },
  'customer-acquisition-channel-trend': {
    metrics: ['customers-by-acquisition-channel'],
    dimension: 'date',
    seriesDimension: 'channel',
    notice:
      'تعداد مشتریان فعال دارای روش آشنایی ثبت‌شده به تفکیک کانال و روز ایجاد؛ منبع نامشخص خارج است.',
  },
  'sales-destination-ranking': {
    metrics: ['net-sales'],
    dimension: 'destination',
  },
  'sales-country-ranking': { metrics: ['net-sales'], dimension: 'country' },
  'agent-ranking': { metrics: ['net-sales'], dimension: 'agent' },
  'employee-sales-count-by-agent': {
    metrics: ['employee-finalized-sales-count'],
    dimension: 'agent',
  },
  'employee-sales-amount-by-agent': {
    metrics: ['employee-sales-amount'],
    dimension: 'agent',
  },
  'employee-average-sale-by-agent': {
    metrics: ['employee-average-sale'],
    dimension: 'agent',
  },
  'employee-contracts-by-agent': {
    metrics: ['employee-contract-count', 'employee-finalized-sales-count'],
    dimension: 'agent',
  },
  'employee-cancellations-by-agent': {
    metrics: ['employee-cancellation-count'],
    dimension: 'agent',
    notice:
      'تعداد رخداد لغو به نام مالک قرارداد نمایش داده می‌شود؛ علت طبقه‌بندی‌شده لغو هنوز منبع مستقل ندارد.',
  },
  'discount-analysis': {
    metrics: ['discount-amount'],
    dimension: 'agent-service',
  },
  'average-sale-trend': {
    metrics: ['average-sale-value'],
    dimension: 'date',
    notice:
      'میانگین از قراردادهای همان روز و ارز دوباره محاسبه می‌شود؛ روز فاقد فروش، میانگین صفر ندارد و نمایش داده نمی‌شود.',
  },
  'inventory-capacity': {
    metrics: ['inventory-allocated', 'inventory-held', 'inventory-free'],
    dimension: 'route',
    notice:
      'وضعیت فعلی تخصیص، نگه‌داشت معتبر و ظرفیت قابل فروش عرضه‌های فعال در بازه حرکت؛ این نمودار تاریخچه مصرف ظرفیت نیست.',
  },
  'inventory-departure-curve': {
    metrics: ['remaining-capacity'],
    dimension: 'date',
    notice:
      'ظرفیت فعلی به تفکیک تاریخ حرکت؛ تاریخچه ظرفیت در روزهای گذشته بازسازی نمی‌شود.',
  },
  'hotel-sales-ranking': {
    metrics: ['hotel-reservations'],
    dimension: 'hotel',
    notice:
      'تعداد قرارداد/هتل معتبر نمایش داده می‌شود؛ مبلغ فروش مستقل هر هتل بدون تخصیص مبلغ قرارداد به اقامت قابل محاسبه نیست.',
  },
  'average-stay-analysis': {
    metrics: ['average-stay-length'],
    dimension: 'date',
    notice:
      'میانگین شب اقامت از تاریخ‌های ورود و خروج واقعی؛ روزهای فاقد اقامت از میانگین حذف می‌شوند.',
  },
  'document-quality-overview': {
    metrics: ['document-count', 'document-incomplete', 'document-expired'],
    dimension: 'source',
    notice:
      'صرفاً فراداده اسناد داخلی مجاز و حذف‌نشده؛ اسناد محرمانه و محتوای فایل نمایش داده نمی‌شوند.',
  },
  'support-breakdown': {
    metrics: ['support-ticket-count'],
    missingMetrics: ['sla-breach-rate'],
    dimension: 'status',
    notice:
      'حجم واقعی درخواست پشتیبانی بر اساس وضعیت؛ درخواست داخلی و کال‌سنتر حذف‌اند. نقض SLA بدون رخدادهای معتبر زمان پاسخ و توقف محاسبه نمی‌شود.',
  },
};
const labels: Readonly<Record<string, string>> = {
  'customer-service-usage': 'مشتری/نوع خدمت',
  'customer-interest-count': 'مشتری دارای علاقه',
  'employee-call-count': 'تمام تماس‌ها',
  'employee-connected-call-count': 'تماس متصل/پاسخ‌داده‌شده',
  'employee-workdays': 'روز کارکرد معتبر',
  'employee-overtime': 'ساعت اضافه‌کاری',
  'customers-by-acquisition-channel': 'مشتری دارای روش آشنایی',
  'net-sales': 'فروش خالص',
  'discount-amount': 'تخفیف',
  'employee-finalized-sales-count': 'فروش نهایی',
  'finalized-sales-count': 'قرارداد نهایی‌شده',
  'employee-sales-amount': 'فروش خالص',
  'employee-average-sale': 'میانگین فروش',
  'employee-contract-count': 'قرارداد ایجادشده',
  'employee-cancellation-count': 'لغو',
  'average-sale-value': 'میانگین فروش',
  'remaining-capacity': 'ظرفیت باقی‌مانده',
  'inventory-allocated': 'تخصیص فعال',
  'inventory-held': 'نگه‌داشت معتبر',
  'inventory-free': 'ظرفیت قابل فروش',
  'hotel-reservations': 'قرارداد/هتل',
  'average-stay-length': 'میانگین شب اقامت',
  'document-count': 'تمام اسناد مجاز',
  'document-incomplete': 'ناقص',
  'document-expired': 'منقضی',
  'support-ticket-count': 'درخواست پشتیبانی',
  'first-response-time': 'میانگین زمان نخستین پاسخ',
};
const aggregate = (
  rows: readonly DashboardObservation[],
  metric: DashboardSourceMetric,
) => {
  const total = rows.reduce((n, r) => n.plus(r.value), new Prisma.Decimal(0));
  return metric.calculation === 'mean' && rows.length
    ? total.div(rows.length)
    : total;
};
export function renderDashboardBreakdown(
  id: string,
  available: Readonly<Record<string, DashboardSourceMetric>>,
): { visual?: DashboardProjectionV1['visuals'][string]; reason: string } {
  const config = dashboardBreakdowns[id];
  if (!config || config.metrics.some((m) => !available[m]))
    return { reason: 'SOURCE_OR_SCOPE_UNAVAILABLE' };
  const first = available[config.metrics[0]!]!;
  const money = first.kind === 'money';
  if (config.metrics.some((m) => available[m]!.kind !== first.kind))
    return { reason: 'INCOMPATIBLE_MEASURES' };
  const category = (r: DashboardObservation) =>
    config.dimension === 'date'
      ? new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Tehran',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(r.at)
      : config.dimension === 'agent-service'
        ? `${r.dimensions?.agent ?? 'ثبت‌نشده'} · ${r.dimensions?.service ?? 'ثبت‌نشده'}`
        : (r.dimensions?.[config.dimension] ?? 'ثبت‌نشده');
  const categoryKey = (r: DashboardObservation) =>
    config.dimension === 'date'
      ? category(r)
      : config.dimension === 'agent-service'
        ? JSON.stringify([
            r.dimensionKeys?.agent ?? r.dimensions?.agent,
            r.dimensions?.service,
          ])
        : (r.dimensionKeys?.[config.dimension] ?? category(r));
  const namedKeys = (
    rows: readonly DashboardObservation[],
    key: (r: DashboardObservation) => string,
    label: (r: DashboardObservation) => string,
  ) => {
    const names = new Map(rows.map((r) => [key(r), label(r)]));
    const keys = [...names.keys()].sort(
      (a, b) =>
        names.get(a)!.localeCompare(names.get(b)!) || a.localeCompare(b),
    );
    const counts = new Map<string, number>();
    for (const label of names.values())
      counts.set(label, (counts.get(label) ?? 0) + 1);
    const ordinals = new Map<string, number>();
    for (const key of keys) {
      const label = names.get(key)!;
      if (counts.get(label)! > 1) {
        const n = (ordinals.get(label) ?? 0) + 1;
        ordinals.set(label, n);
        names.set(key, label + ' · ' + n);
      }
    }
    return { keys, names };
  };
  const currencies = money
    ? [
        ...new Set(
          config.metrics.flatMap((m) =>
            available[m]!.observations.flatMap((r) =>
              r.currencyCode ? [r.currencyCode] : [],
            ),
          ),
        ),
      ].sort()
    : [undefined];
  let precise = true;
  const groups = currencies.map((currencyCode) => {
    const rowsFor = (m: string) =>
      available[m]!.observations.filter(
        (r) => !money || r.currencyCode === currencyCode,
      );
    const categories = namedKeys(
      config.metrics.flatMap(rowsFor),
      categoryKey,
      category,
    );
    const seriesKey = (r: DashboardObservation) =>
      r.dimensionKeys?.[config.seriesDimension!] ??
      r.dimensions?.[config.seriesDimension!] ??
      'ثبت‌نشده';
    const seriesNames = config.seriesDimension
      ? namedKeys(
          rowsFor(config.metrics[0]!),
          seriesKey,
          (r) => r.dimensions?.[config.seriesDimension!] ?? 'ثبت‌نشده',
        )
      : undefined;
    const seriesKeys = seriesNames?.keys ?? config.metrics;
    const series = seriesKeys.map((key) => {
      const m = config.seriesDimension ? config.metrics[0]! : key;
      return {
        label: seriesNames ? seriesNames.names.get(key)! : (labels[m] ?? m),
        values: categories.keys.map((name) => {
          const value = aggregate(
            rowsFor(m).filter(
              (r) =>
                categoryKey(r) === name &&
                (!config.seriesDimension || seriesKey(r) === key),
            ),
            available[m]!,
          );
          if (!value.abs().lte(Number.MAX_SAFE_INTEGER)) precise = false;
          return value.toNumber();
        }),
      };
    });
    return {
      currencyCode,
      labels: categories.keys.map((key) => categories.names.get(key)!),
      values: series[0]?.values ?? [],
      series,
    };
  });
  if (
    !precise ||
    groups.some((g) =>
      g.series.some((s) =>
        s.values.some(
          (n) => !Number.isFinite(n) || Math.abs(n) > Number.MAX_SAFE_INTEGER,
        ),
      ),
    )
  )
    return { reason: 'CHART_NUMERIC_RANGE' };
  const primary = groups[0] ?? { labels: [], values: [], series: [] };
  return {
    reason: '',
    visual: {
      labels: primary.labels,
      values: primary.values,
      series: primary.series,
      unit: first.unit ?? (money ? 'ارز منبع' : 'تعداد'),
      ...(money
        ? {
            currencySeries: groups.map((g) => ({
              ...g,
              currencyCode: g.currencyCode!,
            })),
          }
        : {}),
      ...(config.notice ? { notice: config.notice } : {}),
      ...(config.missingMetrics?.some((m) => !available[m])
        ? {
            missingMetrics: Object.fromEntries(
              config.missingMetrics
                .filter((m) => !available[m])
                .map((m) => [m, 'MEASUREMENT_INPUTS_REQUIRED']),
            ),
          }
        : {}),
    },
  };
}
