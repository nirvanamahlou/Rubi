export const reportingViewIds = [
  'catalog',
  'saved',
  'shared',
  'recent',
  'downloads',
] as const;

export type ReportingView = (typeof reportingViewIds)[number];
export type SavedReportFilter = 'all' | 'favorites';

export const reportingFilterParamKeys: Readonly<Record<string, string>> = {
  وضعیت: 'status',
  شعبه: 'branch',
  سایت: 'site',
  کارشناس: 'expert',
  'کانال فروش': 'salesChannel',
  'نوع خدمت': 'serviceType',
  مبدأ: 'origin',
  مقصد: 'destination',
  مسیر: 'route',
  ایرلاین: 'airline',
  تأمین‌کننده: 'supplier',
  Provider: 'provider',
  'شماره قرارداد': 'contractNumber',
  'طرف حساب': 'counterparty',
  'وضعیت تسویه': 'settlementStatus',
  حساب: 'account',
  'روش پرداخت': 'paymentMethod',
  'جهت چک': 'checkDirection',
  بانک: 'bank',
  'وضعیت چک': 'checkStatus',
  'نوع تراکنش': 'transactionType',
  'وضعیت صدور': 'issuanceStatus',
  عملیات: 'operation',
  'کد خطا': 'errorCode',
  'علت لغو': 'cancellationReason',
  'وضعیت Refund': 'refundStatus',
  آژانس: 'agency',
  'نوع مشتری': 'customerType',
  'منبع لید': 'leadSource',
  کمپین: 'campaign',
  کانال: 'channel',
  'دسته Ticket': 'ticketCategory',
  اولویت: 'ticketPriority',
  کارمند: 'employee',
  واحد: 'department',
  سمت: 'role',
  پرواز: 'flight',
  'وضعیت Manifest': 'manifestStatus',
  کاربر: 'user',
  گزارش: 'reportName',
  'نوع خروجی': 'outputType',
};

const identityBearingFilterLabels = new Set([
  'کارشناس',
  'کارمند',
  'کاربر',
  'طرف حساب',
]);

export interface ReportingFilterUrlState {
  reportCode: string | undefined;
  fromDate: string;
  toDate: string;
  legalEntity: string;
  currency: string;
  filterValues: Readonly<Record<string, string>>;
}

/**
 * Forces a fresh client workspace when navigation changes from an operations
 * table to a report configuration deep-link. React otherwise keeps the same
 * component instance and its useState initializers do not apply the new URL
 * snapshot.
 */
export function reportingWorkspaceKey(
  view: ReportingView,
  savedFilter: SavedReportFilter,
  state: ReportingFilterUrlState,
): string {
  return JSON.stringify([
    view,
    savedFilter,
    state.reportCode ?? '',
    state.fromDate,
    state.toDate,
    state.legalEntity,
    state.currency,
    Object.entries(state.filterValues).sort(([left], [right]) =>
      left.localeCompare(right, 'fa-IR'),
    ),
  ]);
}

type UnknownRecord = Record<string, unknown>;

const legalEntityCodesByLabel: Readonly<Record<string, string>> = {
  'نیایش سیر سحر': 'NIYAYESH_SEIR_SAHAR',
  'جهان باستان': 'JAHAN_BASTAN',
  'جهان آکادمیا': 'JAHAN_ACADEMIA',
  'قسطی رو': 'GHESATI_RO',
};

const reportingFilterLabelsByApiKey: Readonly<Record<string, string>> =
  {
    ...Object.fromEntries(
      Object.entries(reportingFilterParamKeys).map(([label, key]) => [key, label]),
    ),
    agency: 'آژانس',
    branchId: 'شعبه',
    issueStatus: 'وضعیت صدور',
    leadSource: 'منبع لید',
    ownerUserId: 'کارشناس',
    reservationStatus: 'وضعیت Refund',
  };

function record(value: unknown): UnknownRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;
}

function storedString(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 120) : '';
}

function tehranIsoDate(value: unknown): string {
  const input = storedString(value);
  if (!input) return '';
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Tehran',
    year: 'numeric',
  }).formatToParts(parsed);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function previousIsoDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return '';
  return new Date(Date.UTC(year, month - 1, day - 1))
    .toISOString()
    .slice(0, 10);
}

function isAllSelection(value: string): boolean {
  return !value || value === 'ALL' || value.startsWith('همه ');
}

/** Restores both current canonical saved state and legacy/server snapshots. */
export function reportingConfigurationState(
  reportCode: string,
  storedState: unknown,
): ReportingFilterUrlState {
  const stored = record(storedState) ?? {};
  const canonicalValues = record(stored.filterValues);
  if (canonicalValues) {
    return {
      reportCode,
      fromDate: safeDate(storedString(stored.fromDate)),
      toDate: safeDate(storedString(stored.toDate)),
      legalEntity: storedString(stored.legalEntity) || 'ALL',
      currency: storedString(stored.currency) || 'ALL',
      filterValues: Object.fromEntries(
        Object.entries(canonicalValues).flatMap(([label, value]) => {
          const normalized = storedString(value);
          return isAllSelection(normalized) ? [] : [[label, normalized]];
        }),
      ),
    };
  }

  const snapshotFilters = record(stored.filters);
  if (snapshotFilters) {
    const filterValues: Record<string, string> = {};
    for (const [key, value] of Object.entries(snapshotFilters)) {
      if (key === 'fromUtc' || key === 'toUtc' || key === 'currencyCode')
        continue;
      const label = reportingFilterLabelsByApiKey[key];
      const normalized = Array.isArray(value)
        ? storedString(value[0])
        : storedString(value);
      if (label && !isAllSelection(normalized)) filterValues[label] = normalized;
    }
    const exclusiveToDate = tehranIsoDate(snapshotFilters.toUtc);
    return {
      reportCode,
      fromDate: tehranIsoDate(snapshotFilters.fromUtc),
      toDate: exclusiveToDate ? previousIsoDate(exclusiveToDate) : '',
      legalEntity: storedString(stored.legalEntityId) || 'ALL',
      currency: storedString(snapshotFilters.currencyCode) || 'ALL',
      filterValues,
    };
  }

  const range = storedString(stored['بازه تاریخ']).match(
    /^(\d{4}-\d{2}-\d{2})\s+تا\s+(\d{4}-\d{2}-\d{2})$/,
  );
  const filterValues: Record<string, string> = {};
  for (const label of Object.keys(reportingFilterParamKeys)) {
    const normalized = storedString(stored[label]);
    if (!isAllSelection(normalized)) filterValues[label] = normalized;
  }
  const company = storedString(stored['شرکت']);
  const currency = storedString(stored['ارز']);
  return {
    reportCode,
    fromDate: range?.[1] ?? '',
    toDate: range?.[2] ?? '',
    legalEntity: legalEntityCodesByLabel[company] ?? 'ALL',
    currency: isAllSelection(currency) ? 'ALL' : currency,
    filterValues,
  };
}

function singleValue(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value.trim().slice(0, 120) : '';
}

function safeDate(value: string | string[] | undefined): string {
  const candidate = singleValue(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(candidate);
  if (!match) return '';
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() + 1 === Number(month) &&
    date.getUTCDate() === Number(day)
    ? candidate
    : '';
}

export function parseReportingFilterState(
  params: Record<string, string | string[] | undefined>,
): ReportingFilterUrlState {
  const filterValues: Record<string, string> = {};
  for (const [label, key] of Object.entries(reportingFilterParamKeys)) {
    const value = singleValue(params[key]);
    if (value && value !== 'ALL') filterValues[label] = value;
  }

  const reportCode = singleValue(params.report);
  const legalEntity = singleValue(params.company);
  const currency = singleValue(params.currency);
  return {
    reportCode: /^[a-z0-9_]+$/.test(reportCode) ? reportCode : undefined,
    fromDate: safeDate(params.from),
    toDate: safeDate(params.to),
    legalEntity: [
      'NIYAYESH_SEIR_SAHAR',
      'JAHAN_BASTAN',
      'JAHAN_ACADEMIA',
      'GHESATI_RO',
    ].includes(legalEntity)
      ? legalEntity
      : 'ALL',
    currency: ['IRR', 'USD', 'EUR'].includes(currency) ? currency : 'ALL',
    filterValues,
  };
}

export function reportingFilterStateHref(
  currentHref: string,
  state: ReportingFilterUrlState,
): string {
  const url = new URL(currentHref, 'http://localhost');
  const managedKeys = [
    'report',
    'from',
    'to',
    'company',
    'currency',
    ...Object.values(reportingFilterParamKeys),
  ];
  managedKeys.forEach((key) => url.searchParams.delete(key));

  if (state.reportCode) url.searchParams.set('report', state.reportCode);
  if (state.fromDate) url.searchParams.set('from', state.fromDate);
  if (state.toDate) url.searchParams.set('to', state.toDate);
  if (state.legalEntity !== 'ALL')
    url.searchParams.set('company', state.legalEntity);
  if (state.currency !== 'ALL')
    url.searchParams.set('currency', state.currency);
  for (const [label, value] of Object.entries(state.filterValues)) {
    const key = reportingFilterParamKeys[label];
    if (
      key &&
      value &&
      value !== 'ALL' &&
      !identityBearingFilterLabels.has(label)
    )
      url.searchParams.set(key, value);
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

export function parseReportingNavigation(params: {
  view?: string | string[];
  filter?: string | string[];
}): { view: ReportingView; savedFilter: SavedReportFilter } {
  // Preserve old favorites links without reintroducing an eighth view.
  if (params.view === 'favorites')
    return { view: 'saved', savedFilter: 'favorites' };
  const view = reportingViewIds.find((id) => id === params.view) ?? 'catalog';
  return {
    view,
    savedFilter:
      view === 'saved' && params.filter === 'favorites' ? 'favorites' : 'all',
  };
}

export function reportingViewHref(
  view: ReportingView,
  filter: SavedReportFilter = 'all',
): string {
  return `/reports?view=${view}${view === 'saved' && filter === 'favorites' ? '&filter=favorites' : ''}`;
}

export function reportingOperationConfigurationHref(
  view: ReportingView,
  savedFilter: SavedReportFilter,
  state: ReportingFilterUrlState,
): string {
  return reportingFilterStateHref(reportingViewHref(view, savedFilter), state);
}
