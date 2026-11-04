import type { SiteReport } from './api/client';
import type { MetricKey } from './dashboard-model';
export function reportCount(value: number | null | undefined) {
  return value === null || value === undefined
    ? 'بدون داده یا مجوز'
    : value.toLocaleString('fa-IR');
}
export function decimalText(value: string) {
  if (!/^-?\d+(?:\.\d+)?$/.test(value)) return 'مبلغ نامعتبر';
  const [whole, fraction] = value.split('.');
  const format = (s: string) =>
    s.replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]!);
  return (
    format(whole!.replace(/\B(?=(\d{3})+(?!\d))/g, '٬')) +
    (fraction ? '٫' + format(fraction) : '')
  );
}
export function reportMetricText(report: SiteReport, key: MetricKey) {
  const fact = report.metrics[key];
  if (!fact || fact.value === null) return 'بدون مجوز';
  if (key !== 'sales') return reportCount(fact.value);
  if (!report.salesByCurrency) return 'مبلغ در دسترس نیست';
  if (!report.salesByCurrency.length)
    return fact.value === 0 ? '۰ · بدون فروش' : 'مبلغ ثبت نشده';
  return report.salesByCurrency
    .map(
      (item) =>
        `${item.complete && item.amount !== null ? decimalText(item.amount) : 'مبلغ ناقص'} ${item.currency}`,
    )
    .join(' / ');
}
export function dailySeries(report: SiteReport, metric: string) {
  const values = new Map(
    (report.trends[metric] ?? []).map((row) => [row.date, row.value]),
  );
  const cursor = new Date(`${report.from}T00:00:00Z`),
    until = new Date(`${report.to}T00:00:00Z`);
  const series: { date: string; value: number }[] = [];
  while (cursor <= until && series.length < 366) {
    const date = cursor.toISOString().slice(0, 10);
    series.push({ date, value: values.get(date) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return series;
}

export type SiteReportResult = {
  report: SiteReport | null;
  state: 'available' | 'unconfigured' | 'forbidden' | 'error';
  message?: string;
};
export function scopedSiteReport(
  result: SiteReportResult | undefined,
  systemId: string,
  from: string,
  to: string,
) {
  const report = result?.state === 'available' ? result.report : null;
  return report?.registrySystemId === systemId &&
    report.from === from &&
    report.to === to
    ? report
    : null;
}

/** Sum source facts, never identities or inferred missing-source zeroes. */
export function aggregateSiteMetric(
  systemIds: readonly string[],
  results: Readonly<Record<string, SiteReportResult>>,
  from: string,
  to: string,
  metric: MetricKey,
) {
  const ids = [...new Set(systemIds)];
  let count = 0n;
  const currencies = new Map<string, string>();
  const included: string[] = [];
  for (const id of ids) {
    const report = scopedSiteReport(results[id], id, from, to);
    const fact = report?.metrics[metric];
    if (
      !report ||
      fact?.state !== 'AVAILABLE' ||
      fact.value === null ||
      !Number.isSafeInteger(fact.value) ||
      fact.value < 0
    )
      continue;
    if (metric === 'sales') {
      const amounts = report.salesByCurrency;
      if (
        !amounts ||
        (!amounts.length && fact.value !== 0) ||
        amounts.some(
          (row) =>
            !row.complete ||
            !row.amount ||
            !/^-?\d+(?:\.\d+)?$/.test(row.amount) ||
            !/^[A-Z]{3,8}$/.test(row.currency),
        )
      )
        continue;
      for (const row of amounts)
        currencies.set(
          row.currency,
          addExactDecimal(currencies.get(row.currency) ?? '0', row.amount!),
        );
    }
    count += BigInt(fact.value);
    included.push(id);
  }
  return {
    text: !included.length
      ? 'داده موجود نیست'
      : metric !== 'sales'
        ? count.toLocaleString('fa-IR')
        : currencies.size
          ? [...currencies]
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([currency, amount]) => `${decimalText(amount)} ${currency}`)
              .join(' / ')
          : '۰ · بدون فروش',
    covered: included.length,
    total: ids.length,
    complete: ids.length > 0 && included.length === ids.length,
    included,
  };
}

function addExactDecimal(left: string, right: string) {
  const parts = (value: string) => {
    const negative = value.startsWith('-');
    const [whole, fraction = ''] = value.replace(/^-/, '').split('.');
    return { whole: whole!, fraction, negative };
  };
  const a = parts(left),
    b = parts(right),
    scale = Math.max(a.fraction.length, b.fraction.length);
  const integer = (part: ReturnType<typeof parts>) =>
    BigInt(part.whole + part.fraction.padEnd(scale, '0')) *
    (part.negative ? -1n : 1n);
  const sum = integer(a) + integer(b);
  const digits = (sum < 0n ? -sum : sum).toString().padStart(scale + 1, '0');
  const whole = scale ? digits.slice(0, -scale) : digits;
  const fraction = scale ? digits.slice(-scale).replace(/0+$/, '') : '';
  return `${sum < 0n ? '-' : ''}${whole}${fraction ? '.' + fraction : ''}`;
}
const resourceTitles: Record<string, string> = {
  'customer-orders': 'سفارش',
  'customer-accounts': 'حساب مشتری',
  'customer-travelers': 'مسافر',
  'customer-cart-items': 'سبد خرید',
  tours: 'تور',
  hotels: 'هتل',
  countries: 'کشور',
  airlines: 'شرکت هواپیمایی',
  destinations: 'مقصد',
  categories: 'دسته‌بندی',
  visas: 'ویزا',
  'service-offers': 'بلیت و خدمات',
  'editorial-content': 'محتوا',
  'exchange-rates': 'نرخ ارز',
  'support-threads': 'گفتگوی پشتیبانی',
  'travel-requests': 'درخواست سفر',
  catalogue: 'کاتالوگ',
  'customer-payments': 'پرداخت',
};
export function activityTitle(resource: string, operation: string) {
  const sourceAction: Record<string, string> = {
    'payment.approved': 'تأیید پرداخت',
    'payment.rejected': 'رد پرداخت',
    'checkout.activated': 'فعال‌سازی خرید',
    'case.issued': 'صدور سفر',
    'case.created': 'ایجاد پرونده',
    'request.updated': 'پیگیری درخواست',
  };
  if (sourceAction[operation]) return sourceAction[operation];
  const verb = operation.split('.').at(-1) ?? operation;
  const action =
    (
      {
        upsert: 'ثبت یا ویرایش',
        create: 'ثبت',
        update: 'ویرایش',
        archive: 'بایگانی',
        delete: 'حذف',
      } as Record<string, string>
    )[
      verb
        .replace(/created$/, 'create')
        .replace(/updated$/, 'update')
        .replace(/deleted$/, 'delete')
    ] ?? 'تغییر';
  return `${action} ${resourceTitles[resource] ?? 'اطلاعات سایت'}`;
}
