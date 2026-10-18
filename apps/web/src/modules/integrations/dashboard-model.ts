import type { IntegrationSystemConfigV1 } from '@nora/contracts';
import {
  calendarParts,
  parseIsoDate,
  toIsoDate,
} from '@/components/ui/date-picker.utils';

export type MetricKey = 'sales' | 'orders' | 'users' | 'pending';
export type PeriodKey = 'today' | 'week' | 'month' | 'current' | 'custom';
export const metricTitles: Record<MetricKey, string> = {
  sales: 'فروش کل',
  orders: 'سفارش‌ها',
  users: 'کاربران جدید',
  pending: 'در انتظار اقدام',
};
export const metricDetails: Record<MetricKey, string> = {
  sales: 'جزئیات فروش کل',
  orders: 'جزئیات سفارش‌ها',
  users: 'جزئیات کاربران جدید',
  pending: 'جزئیات موارد در انتظار اقدام',
};

/** Catalogue readiness is never a business count. No producer is connected yet. */
export function metricState(
  system: IntegrationSystemConfigV1,
  metric: MetricKey,
) {
  return metric === 'sales' && system.businessDomain !== 'TRAVEL'
    ? 'نامرتبط'
    : 'داده موجود نیست';
}

export function periodRange(
  period: Exclude<PeriodKey, 'custom'>,
  now = new Date(),
) {
  // Anchor the reporting date to Tehran even when the browser uses another zone.
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const end = parseIsoDate(day)!;
  const start = new Date(end);
  const offset =
    period === 'today'
      ? 0
      : period === 'week'
        ? 6
        : period === 'month'
          ? 29
          : calendarParts(end, 'persian').day - 1;
  start.setDate(start.getDate() - offset);
  return { from: toIsoDate(start), to: toIsoDate(end) };
}

export function validRange(from: string, to: string) {
  return !!parseIsoDate(from) && !!parseIsoDate(to) && from <= to;
}

export function periodLabel(from: string, to: string) {
  if (!validRange(from, to)) return 'بازه زمانی را کامل کنید';
  const format = (value: string) =>
    parseIsoDate(value)!.toLocaleDateString('fa-IR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  return `${format(from)} — ${format(to)}`;
}
