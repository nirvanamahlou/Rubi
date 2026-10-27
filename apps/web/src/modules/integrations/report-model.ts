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
