import type { DashboardDateBasis } from './registry';

export type DashboardRange =
  'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

export interface DashboardFilters {
  range: DashboardRange;
  from: string | null;
  to: string | null;
  dateBasis: DashboardDateBasis;
  salesChannel: string | null;
  branch: string | null;
  agent: string | null;
  service: string | null;
  agency: string | null;
  provider: string | null;
  currency: string | null;
  status: string | null;
  page: string | null;
  widget: string | null;
}

/**
 * URL-shaped state accepted by a related report configuration. Dashboard owns
 * this conversion; the Reports form still decides which labels it supports.
 */
export interface DashboardReportFilterState {
  reportCode: string;
  fromDate: string;
  toDate: string;
  legalEntity: string;
  currency: string;
  filterValues: Readonly<Record<string, string>>;
}

export const defaultDashboardFilters: DashboardFilters = {
  range: 'month',
  from: null,
  to: null,
  dateBasis: 'effective',
  salesChannel: null,
  branch: null,
  agent: null,
  service: null,
  agency: null,
  provider: null,
  currency: null,
  status: null,
  page: 'executive-overview',
  widget: null,
};

const ranges = new Set<DashboardRange>([
  'today',
  'week',
  'month',
  'quarter',
  'year',
  'custom',
]);
const dateBases = new Set<DashboardDateBasis>([
  'created',
  'issued',
  'paid',
  'effective',
]);
const read = (params: URLSearchParams, key: string) =>
  params.get(key)?.trim() || null;

export function dashboardFiltersFromSearchParams(
  params: URLSearchParams,
): DashboardFilters {
  const range = read(params, 'range');
  const dateBasis = read(params, 'dateBasis');
  return {
    range:
      range && ranges.has(range as DashboardRange)
        ? (range as DashboardRange)
        : defaultDashboardFilters.range,
    from: read(params, 'from'),
    to: read(params, 'to'),
    dateBasis:
      dateBasis && dateBases.has(dateBasis as DashboardDateBasis)
        ? (dateBasis as DashboardDateBasis)
        : defaultDashboardFilters.dateBasis,
    salesChannel: read(params, 'salesChannel'),
    branch: read(params, 'branch'),
    agent: read(params, 'agent'),
    service: read(params, 'service'),
    agency: read(params, 'agency'),
    provider: read(params, 'provider'),
    currency: read(params, 'currency'),
    status: read(params, 'status'),
    // `section` is kept as a short-lived bookmark fallback from the accordion UI.
    page:
      read(params, 'page') ??
      read(params, 'section') ??
      defaultDashboardFilters.page,
    widget: read(params, 'widget'),
  };
}

export function dashboardFiltersToSearchParams(filters: DashboardFilters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    const defaultValue = defaultDashboardFilters[key as keyof DashboardFilters];
    if (value && value !== defaultValue) params.set(key, value);
  }
  return params;
}

export function dashboardFilterSnapshot(filters: DashboardFilters) {
  return Object.freeze({ ...filters });
}

type CalendarDate = { day: number; month: number; year: number };

function calendarDateParts(value: Date, calendar: 'gregory' | 'persian') {
  const parts = new Intl.DateTimeFormat(`en-US-u-ca-${calendar}-nu-latn`, {
    day: 'numeric',
    month: 'numeric',
    timeZone: 'Asia/Tehran',
    year: 'numeric',
  }).formatToParts(value);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { day: read('day'), month: read('month'), year: read('year') };
}

function calendarIsoDate({ day, month, year }: CalendarDate) {
  return `${year.toString().padStart(4, '0')}-${month
    .toString()
    .padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

function shiftCalendarIsoDate(value: string, days: number) {
  const [year = 0, month = 0, day = 0] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

function tehranNoon(value: string) {
  const [year = 0, month = 0, day = 0] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function dashboardCalendarRangeDates(
  range: DashboardRange,
  now: Date,
): Pick<DashboardReportFilterState, 'fromDate' | 'toDate'> {
  if (range === 'custom') return { fromDate: '', toDate: '' };

  const toDate = calendarIsoDate(calendarDateParts(now, 'gregory'));
  if (range === 'today') return { fromDate: toDate, toDate };
  if (range === 'week') {
    const dayOfWeek = tehranNoon(toDate).getUTCDay();
    return {
      fromDate: shiftCalendarIsoDate(toDate, -((dayOfWeek + 1) % 7)),
      toDate,
    };
  }

  const maximumDays = range === 'month' ? 31 : range === 'quarter' ? 94 : 366;
  let cursor = toDate;
  for (let index = 0; index <= maximumDays; index += 1) {
    const persian = calendarDateParts(tehranNoon(cursor), 'persian');
    const isBoundary =
      persian.day === 1 &&
      (range === 'month' ||
        (range === 'quarter' && (persian.month - 1) % 3 === 0) ||
        (range === 'year' && persian.month === 1));
    if (isBoundary) return { fromDate: cursor, toDate };
    cursor = shiftCalendarIsoDate(cursor, -1);
  }

  return { fromDate: toDate, toDate };
}

/** Maps active Dashboard filters to matching fields in a related report form. */
export function dashboardFiltersToReportFilterState(
  filters: DashboardFilters,
  reportCode: string,
  legalEntity: string | null | undefined,
  now = new Date(),
): DashboardReportFilterState {
  const calendarRange = dashboardCalendarRangeDates(filters.range, now);
  const filterValues = Object.fromEntries(
    [
      ['شعبه', filters.branch],
      ['کارشناس', filters.agent],
      ['کانال فروش', filters.salesChannel],
      ['نوع خدمت', filters.service],
      ['آژانس', filters.agency],
      ['Provider', filters.provider],
      ['وضعیت', filters.status],
    ].flatMap(([label, value]) => {
      const normalized = value?.trim();
      return normalized ? [[label, normalized]] : [];
    }),
  ) as Record<string, string>;

  return {
    reportCode,
    fromDate:
      filters.range === 'custom'
        ? (filters.from ?? '')
        : calendarRange.fromDate,
    toDate:
      filters.range === 'custom' ? (filters.to ?? '') : calendarRange.toDate,
    legalEntity: legalEntity ?? 'ALL',
    currency: filters.currency ?? 'ALL',
    filterValues,
  };
}

export function dashboardDateRangeError(
  from: string | null,
  to: string | null,
): string {
  return from && to && from > to
    ? 'تاریخ شروع باید قبل از تاریخ پایان یا برابر با آن باشد.'
    : '';
}
