import {
  accountReviewAxes,
  type AccountReviewAxis,
  type AccountReviewSelection,
} from '@nora/contracts';
import {
  calendarMonthDays,
  calendarMonthLabel,
  parseIsoDate,
} from '@/components/ui/date-picker.utils';

export const reviewLabels: Record<AccountReviewAxis, string> = {
  GROUP: 'گروه حساب',
  GENERAL: 'حساب کل',
  SUBSIDIARY: 'حساب معین',
  DETAIL4: 'تفصیلی سطح چهار',
  DETAIL5: 'تفصیلی سطح پنج',
  DETAIL6: 'تفصیلی سطح شش',
  DETAIL: 'حساب تفصیلی (همه سطوح)',
  DETAIL_TYPE: 'نوع تفصیلی',
  CURRENCY: 'ارز',
  TRACKING: 'پیگیری',
};

export type ReviewScope = AccountReviewSelection & { label: string };

export const reviewStatuses = {
  DRAFT: 'پیش‌نویس',
  PENDING_APPROVAL: 'در انتظار تأیید',
  APPROVED: 'تأییدشده',
  POSTED: 'قطعی',
};

export const defaultReviewFilters = {
  from: '',
  to: '',
  mode: 'date',
  numberFrom: '',
  numberTo: '',
  minAmount: '',
  maxAmount: '',
  statuses: 'POSTED',
  typeIds: '',
  accountIds: '',
  accountType: '',
  detailTypeId: '',
  traceableOnly: 'false',
  currencyOnly: 'false',
  hasBalance: 'false',
};

export type ReviewFilters = typeof defaultReviewFilters;

export function readReviewFilters(value: string | null): ReviewFilters {
  const result = { ...defaultReviewFilters };
  if (!value || value.length > 9000) return result;
  try {
    const record = JSON.parse(value) as Record<string, unknown>;
    for (const key of Object.keys(result) as (keyof ReviewFilters)[]) {
      const item = record?.[key];
      if (typeof item === 'string') result[key] = item;
    }
  } catch {
    // A malformed link opens the report with its default filters.
  }
  return result;
}

export function readReviewAxis(value: unknown): AccountReviewAxis | undefined {
  return accountReviewAxes.find((axis) => axis === value);
}

export function readReviewScope(value: string | null): ReviewScope[] {
  if (!value || value.length > 4000) return [];
  try {
    const items: unknown = JSON.parse(value);
    if (!Array.isArray(items) || items.length > 10) return [];
    return items.flatMap((item: unknown) => {
      if (!item || typeof item !== 'object') return [];
      const { axis, key, label, typeId, trackingDate } = item as Record<
        string,
        unknown
      >;
      const parsed = readReviewAxis(axis);
      if (
        !parsed ||
        typeof key !== 'string' ||
        !key ||
        key.length > 160 ||
        typeof label !== 'string' ||
        label.length > 220
      )
        return [];
      return [
        {
          axis: parsed,
          key,
          label,
          ...(typeof typeId === 'string' ? { typeId } : {}),
          ...(trackingDate === null || typeof trackingDate === 'string'
            ? { trackingDate }
            : {}),
        },
      ];
    });
  } catch {
    return [];
  }
}

export function addReviewSelection(
  scope: ReviewScope[],
  selected: ReviewScope,
) {
  const existing = scope.findIndex(
    (item) =>
      item.axis === selected.axis &&
      item.key === selected.key &&
      item.typeId === selected.typeId &&
      item.trackingDate === selected.trackingDate,
  );
  return existing >= 0 ? scope : [...scope, selected];
}

export function fiscalReviewMonths(start: string, end: string) {
  const first = parseIsoDate(start);
  const last = parseIsoDate(end);
  const options: { label: string; from: string; to: string }[] = [];
  if (!first || !last || first > last) return options;
  let month = first;
  while (month <= last && options.length < 25) {
    const days = calendarMonthDays(month, 'persian').filter(
      (day) => day.isCurrentMonth,
    );
    const from = days[0]?.isoDate;
    const to = days.at(-1)?.isoDate;
    if (!from || !to) break;
    options.push({
      label: calendarMonthLabel(month, 'persian'),
      from: from < start ? start : from,
      to: to > end ? end : to,
    });
    const next = parseIsoDate(to)!;
    next.setDate(next.getDate() + 1);
    month = next;
  }
  return options;
}
