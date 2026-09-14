'use client';

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  Bookmark,
  Check,
  CalendarClock,
  ChevronDown,
  Clock3,
  Download,
  FileDown,
  FileText,
  Filter,
  History,
  Play,
  RotateCcw,
  Save,
  Users,
  Search,
  ShieldCheck,
  Table2,
  WifiOff,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ReportingOperationsView } from './reporting-operations-view';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import {
  FormField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/form-controls';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
} from '@/components/ui/surfaces';
import {
  ReportingApiError,
  reportDateRangeUtc,
  reportingApi,
  type SalesByOrganizationPreviewInput,
  type SalesByOrganizationReportResult,
  type ReportingWorkspaceCounts,
} from '../model/client';
import {
  filterReportCatalog,
  reportCatalog,
  reportPriorityGroups,
  type ReportAvailability,
  type ReportDefinition,
} from '../model/reporting';

import {
  reportingFilterStateHref,
  reportingViewHref,
  type ReportingFilterUrlState,
  type ReportingView,
  type SavedReportFilter,
} from '../model/navigation';

type ExportFormat = 'XLSX' | 'PDF' | 'CSV';
type ReportResultMode = 'table' | 'chart';
export type ReportChartType = 'horizontal-bar' | 'column' | 'pie';
type ReportSort = NonNullable<SalesByOrganizationPreviewInput['sort']>;
type ReportRunError = {
  kind: 'connection' | 'denied' | 'validation';
  message: string;
};

const darkSurfaceContentClass =
  '!text-white [&_*]:!text-white [&_svg]:!text-white';

const defaultReportSort: ReportSort = {
  column: 'amount',
  direction: 'DESC',
};

const reportChartTypeLabels: Record<ReportChartType, string> = {
  'horizontal-bar': 'میله‌ای افقی',
  column: 'ستونی',
  pie: 'دایره‌ای',
};

const reportPieColors = [
  '#1d5fbd',
  '#14b8a6',
  '#f59e0b',
  '#8b5cf6',
  '#ef4444',
  '#0ea5e9',
  '#84cc16',
  '#ec4899',
] as const;

export function reportChartTypes(
  report: Pick<ReportDefinition, 'dimensions'>,
): readonly ReportChartType[] {
  return report.dimensions.length
    ? ['horizontal-bar', 'column', 'pie']
    : ['column', 'pie'];
}

const legalEntityLabels = {
  ALL: 'همه شرکت‌ها',
  NIYAYESH_SEIR_SAHAR: 'نیایش سیر سحر',
  JAHAN_BASTAN: 'جهان باستان',
  JAHAN_ACADEMIA: 'جهان آکادمیا',
  GHESATI_RO: 'قسطی رو',
} as const;

const legalEntityOptions: readonly ReportFilterOption[] = Object.entries(
  legalEntityLabels,
)
  .filter(([value]) => value !== 'ALL')
  .map(([value, label]) => ({ value, label }));

const currencyOptions: readonly ReportFilterOption[] = [
  { value: 'IRR', label: 'IRR' },
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
];

const salesStatusOptions: readonly ReportFilterOption[] = [
  { value: 'DRAFT', label: 'پیش‌نویس' },
  { value: 'PENDING_CONFIRMATION', label: 'در انتظار تأیید' },
  { value: 'CONFIRMED', label: 'تأییدشده' },
  { value: 'SENT_TO_RESERVATIONS', label: 'ارسال‌شده به رزرو' },
  { value: 'IN_PROGRESS', label: 'در حال انجام' },
  { value: 'COMPLETED', label: 'تکمیل‌شده' },
  { value: 'CANCELLED', label: 'لغوشده' },
];

const reportFilterApiKeys: Readonly<Record<string, string>> = {
  شعبه: 'branch',
  کارشناس: 'expert',
  وضعیت: 'status',
  سایت: 'site',
  'کانال فروش': 'salesChannel',
  'نوع خدمت': 'serviceType',
  مبدأ: 'origin',
  مقصد: 'destination',
  مسیر: 'route',
  ایرلاین: 'airline',
  Provider: 'provider',
  آژانس: 'agency',
  'نوع مشتری': 'customerType',
  'وضعیت صدور': 'issueStatus',
  'وضعیت Refund': 'reservationStatus',
  'منبع لید': 'leadSource',
};

function reportFilterApiValues(
  values: Readonly<Record<string, string>>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values).flatMap(([label, value]) => {
      const key = reportFilterApiKeys[label];
      return key && value ? [[key, value]] : [];
    }),
  );
}

export function reportingLegalEntityLabel(value: string): string {
  return (
    legalEntityLabels[value as keyof typeof legalEntityLabels] ??
    'شرکت انتخاب‌شده'
  );
}

const allFilterLabels: Record<string, string> = {
  وضعیت: 'همه وضعیت‌ها',
  شعبه: 'همه شعبه‌ها',
  سایت: 'همه سایت‌ها',
  کارشناس: 'همه کارشناسان',
  'کانال فروش': 'همه کانال‌های فروش',
  'نوع خدمت': 'همه انواع خدمت',
  مبدأ: 'همه مبدأها',
  مقصد: 'همه مقصدها',
  مسیر: 'همه مسیرها',
  ایرلاین: 'همه ایرلاین‌ها',
  تأمین‌کننده: 'همه تأمین‌کنندگان',
  Provider: 'همه Providerها',
  'شماره قرارداد': 'همه قراردادها',
  'طرف حساب': 'همه طرف‌حساب‌ها',
  'وضعیت تسویه': 'همه وضعیت‌های تسویه',
  حساب: 'همه حساب‌ها',
  'روش پرداخت': 'همه روش‌های پرداخت',
  'جهت چک': 'همه جهت‌های چک',
  بانک: 'همه بانک‌ها',
  'وضعیت چک': 'همه وضعیت‌های چک',
  'نوع تراکنش': 'همه انواع تراکنش',
  'وضعیت صدور': 'همه وضعیت‌های صدور',
  عملیات: 'همه عملیات‌ها',
  'کد خطا': 'همه کدهای خطا',
  'علت لغو': 'همه علت‌های لغو',
  'وضعیت Refund': 'همه وضعیت‌های Refund',
  کمپین: 'همه کمپین‌ها',
  کانال: 'همه کانال‌ها',
  'دسته Ticket': 'همه دسته‌های Ticket',
  اولویت: 'همه اولویت‌ها',
  کارمند: 'همه کارکنان',
  واحد: 'همه واحدها',
  سمت: 'همه سمت‌ها',
  پرواز: 'همه پروازها',
  'وضعیت Manifest': 'همه وضعیت‌های Manifest',
  کاربر: 'همه کاربران',
  گزارش: 'همه گزارش‌ها',
  'نوع خروجی': 'همه انواع خروجی',
};

export function reportingAllFilterLabel(filter: string): string {
  return allFilterLabels[filter] ?? `همه ${filter}`;
}

interface ReportFilterOption {
  value: string;
  label: string;
}

function ReportSearchableSelect({
  allLabel,
  id,
  label,
  onValueChange,
  options,
  value,
}: {
  allLabel: string;
  id: string;
  label: string;
  onValueChange: (value: string) => void;
  options: readonly ReportFilterOption[];
  value: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((option) => option.value === value);
  const normalizedQuery = query.trim().toLocaleLowerCase('fa');
  const visibleOptions = options.filter((option) =>
    `${option.label} ${option.value}`
      .toLocaleLowerCase('fa')
      .includes(normalizedQuery),
  );

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    function closeOnOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', closeOnOutside);
    return () => document.removeEventListener('mousedown', closeOnOutside);
  }, [open]);

  return (
    <FormField id={id} label={label}>
      <div className="relative" ref={rootRef}>
        <button
          aria-controls={`${id}-options`}
          aria-expanded={open}
          aria-haspopup="listbox"
          className="flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-input bg-surface px-3 text-sm outline-none transition hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/30"
          id={id}
          onClick={() => {
            setOpen((current) => !current);
            setQuery('');
          }}
          type="button"
        >
          <span className="truncate">{selected?.label ?? allLabel}</span>
          <ChevronDown
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
        </button>
        {open ? (
          <div className="absolute inset-x-0 top-[calc(100%+0.35rem)] z-[70] rounded-xl border border-border bg-popover p-2 shadow-xl">
            <div className="relative">
              <Search className="absolute end-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                aria-label={`جست‌وجو در ${label}`}
                className="h-9 pe-9"
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`جست‌وجوی ${label}`}
                ref={searchRef}
                value={query}
              />
            </div>
            <div
              aria-label={`گزینه‌های ${label}`}
              className="mt-2 max-h-52 overflow-y-auto"
              id={`${id}-options`}
              role="listbox"
            >
              {[{ value: 'ALL', label: allLabel }, ...visibleOptions].map(
                (option) => (
                  <button
                    aria-selected={value === option.value}
                    className="flex min-h-9 w-full items-center justify-between rounded-lg px-3 py-2 text-start text-sm outline-none hover:bg-muted focus-visible:bg-muted"
                    key={option.value}
                    onClick={() => {
                      onValueChange(option.value);
                      setOpen(false);
                      setQuery('');
                    }}
                    role="option"
                    type="button"
                  >
                    <span className="truncate">{option.label}</span>
                    {value === option.value ? (
                      <Check
                        aria-hidden="true"
                        className="size-4 text-primary"
                      />
                    ) : null}
                  </button>
                ),
              )}
              {visibleOptions.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                  {normalizedQuery
                    ? 'گزینه‌ای پیدا نشد.'
                    : 'گزینه‌ای از منبع داده منتشر نشده است.'}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </FormField>
  );
}

export function reportingDateRangeError(
  fromDate: string,
  toDate: string,
): string {
  return fromDate && toDate && fromDate > toDate
    ? 'تاریخ شروع باید قبل از تاریخ پایان یا برابر با آن باشد.'
    : '';
}

export function ReportDateRangeFields({
  error,
  fromDate,
  onFromDateChange,
  onToDateChange,
  toDate,
}: {
  error: string;
  fromDate: string;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  toDate: string;
}) {
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="report-from-date" label="از تاریخ">
          <DatePicker
            aria-describedby={error ? 'report-date-range-error' : undefined}
            aria-invalid={Boolean(error)}
            id="report-from-date"
            gregorianEnglish
            onChange={onFromDateChange}
            placeholder="انتخاب تاریخ"
            value={fromDate}
          />
        </FormField>
        <FormField id="report-to-date" label="تا تاریخ">
          <DatePicker
            aria-describedby={error ? 'report-date-range-error' : undefined}
            aria-invalid={Boolean(error)}
            id="report-to-date"
            gregorianEnglish
            onChange={onToDateChange}
            placeholder="انتخاب تاریخ"
            value={toDate}
          />
        </FormField>
      </div>
      {error ? (
        <p
          className="text-xs font-medium text-destructive"
          id="report-date-range-error"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

export interface ReportingFilterSnapshotItem {
  active: boolean;
  label: string;
  value: string;
}

export function buildReportingFilterSnapshot({
  currency,
  filterValues,
  fromDate,
  legalEntity,
  report,
  toDate,
}: {
  currency: string;
  filterValues: Readonly<Record<string, string>>;
  fromDate: string;
  legalEntity: string;
  report: ReportDefinition;
  toDate: string;
}): readonly ReportingFilterSnapshotItem[] {
  const dateValue =
    fromDate || toDate
      ? `${fromDate || 'ابتدای داده‌ها'} تا ${toDate || 'امروز'}`
      : 'همه تاریخ‌ها';
  const items: ReportingFilterSnapshotItem[] = [
    {
      active: Boolean(fromDate || toDate),
      label: 'بازه تاریخ',
      value: dateValue,
    },
    {
      active: legalEntity !== 'ALL',
      label: 'شرکت',
      value: reportingLegalEntityLabel(legalEntity),
    },
    {
      active: currency !== 'ALL',
      label: 'ارز',
      value: currency === 'ALL' ? 'همه ارزها (بدون جمع)' : currency,
    },
  ];

  report.filters
    .filter((filter) => !['بازه تاریخ', 'شرکت', 'ارز'].includes(filter))
    .slice(0, 8)
    .forEach((filter) => {
      const value = filterValues[filter]?.trim() || 'ALL';
      items.push({
        active: value !== 'ALL',
        label: filter,
        value: value === 'ALL' ? reportingAllFilterLabel(filter) : value,
      });
    });

  return items;
}

function initialReportingFilterValues(
  report: ReportDefinition,
  urlValues: Readonly<Record<string, string>>,
): Record<string, string> {
  const applicableUrlValues = Object.fromEntries(
    Object.entries(urlValues).filter(([label]) =>
      report.filters.includes(label),
    ),
  );
  if (typeof window === 'undefined') return applicableUrlValues;

  try {
    const stored = window.sessionStorage.getItem(
      `reporting.filters.${report.code}`,
    );
    if (!stored) return applicableUrlValues;
    const parsed = JSON.parse(stored) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return applicableUrlValues;
    const safeValues = Object.fromEntries(
      Object.entries(parsed)
        .filter(
          ([key, value]) =>
            key.length <= 64 &&
            report.filters.includes(key) &&
            typeof value === 'string' &&
            value.length <= 120,
        )
        .slice(0, 12),
    ) as Record<string, string>;
    return { ...safeValues, ...applicableUrlValues };
  } catch {
    return applicableUrlValues;
  }
}

const workspaceViews: readonly {
  id: ReportingView;
  label: string;
  icon: LucideIcon;
}[] = [
  { id: 'catalog', label: 'کاتالوگ گزارش‌ها', icon: BarChart3 },
  { id: 'saved', label: 'گزارش‌های من', icon: Bookmark },
  { id: 'shared', label: 'اشتراک‌گذاری‌شده با من', icon: Users },
  { id: 'recent', label: 'اجراها', icon: History },
  { id: 'downloads', label: 'خروجی‌ها', icon: Download },
];

export function workspaceCountForView(
  view: ReportingView,
  counts: ReportingWorkspaceCounts | null,
): number | undefined {
  if (view === 'catalog') return reportCatalog.length;
  if (!counts) return undefined;
  if (view === 'saved') return counts.myReports;
  if (view === 'shared') return counts.sharedWithMe;
  if (view === 'recent') return counts.runs;
  return counts.exports;
}

type CreateReportExport = (
  reportCode: string,
  input: {
    format: ExportFormat;
    query: Record<string, unknown>;
  },
) => Promise<Record<string, unknown>>;

export async function createAndDownloadReportExport({
  createExport = reportingApi.createExport,
  format,
  query,
  reportCode,
  startDownload = (url: string) => {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  },
}: {
  createExport?: CreateReportExport;
  format: ExportFormat;
  query: Record<string, unknown>;
  reportCode: string;
  startDownload?: (url: string) => void;
}): Promise<string> {
  const created = await createExport(reportCode, { format, query });
  const artifactId =
    typeof created.id === 'string' && created.id.trim() ? created.id : '';
  if (!artifactId)
    throw new Error('شناسه فایل خروجی از سرور دریافت نشد.');
  startDownload(reportingApi.exportDownloadUrl(artifactId));
  return artifactId;
}

function ReportCard({
  onSelect,
  report,
  selected,
}: {
  onSelect: (report: ReportDefinition) => void;
  report: ReportDefinition;
  selected: boolean;
}) {
  const connected = report.availability === 'READY';

  return (
    <Card
      className={
        selected
          ? 'flex h-full flex-col border-primary p-4 ring-1 ring-primary/25'
          : 'flex h-full flex-col p-4'
      }
    >
      <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge className="font-mono font-semibold" dir="ltr">
              {report.displayCode}
            </Badge>
            <Badge className="font-medium">{report.category}</Badge>
            <Badge
              className={
                connected
                  ? 'bg-emerald-500/10 text-emerald-700'
                  : 'bg-amber-500/10 text-amber-700'
              }
              title={
                connected
                  ? 'اتصال فعلی فقط Scope مجاز کاربر و تفکیک ارز را پشتیبانی می‌کند.'
                  : 'Public Projection تأییدشده این گزارش هنوز منتشر نشده است.'
              }
            >
              {connected ? 'اتصال محدود قابل اجرا' : 'در انتظار منبع داده'}
            </Badge>
          </div>
          <h3 className="mt-2 text-sm font-bold">{report.title}</h3>
          <p className="mt-2 line-clamp-3 text-xs leading-5 text-muted-foreground">
            <span className="font-semibold text-foreground">خروجی: </span>
            {report.description}
          </p>
      </div>
      <Button
        aria-haspopup="dialog"
        className="mt-auto w-full"
        onClick={() => onSelect(report)}
        size="sm"
        type="button"
        variant="outline"
      >
        پیکربندی گزارش
      </Button>
    </Card>
  );
}

function SummaryCard({
  description,
  icon: Icon,
  label,
  value,
}: {
  description: string;
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <Card className="flex items-center justify-between p-4">
      <div>
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <p className="mt-2 text-2xl font-black">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <Icon className="size-6 text-primary" />
    </Card>
  );
}

const reportSortLabels: Record<ReportSort['column'], string> = {
  amount: 'مبلغ فروش',
  branchId: 'شعبه',
  contractCount: 'تعداد قرارداد',
  currencyCode: 'ارز',
  ownerUserId: 'کارشناس',
};

const descendingFirstColumns = new Set<ReportSort['column']>([
  'amount',
  'contractCount',
]);

export function nextReportSort(
  column: ReportSort['column'],
  current: ReportSort,
): ReportSort {
  return {
    column,
    direction:
      current.column === column
        ? current.direction === 'ASC'
          ? 'DESC'
          : 'ASC'
        : descendingFirstColumns.has(column)
          ? 'DESC'
          : 'ASC',
  };
}

function ResultSortHeader({
  column,
  label,
  onSortChange,
  sort,
}: {
  column: ReportSort['column'];
  label: string;
  onSortChange: (sort: ReportSort) => void;
  sort: ReportSort;
}) {
  const active = sort.column === column;
  const Icon = active
    ? sort.direction === 'ASC'
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;
  const ariaSort = active
    ? sort.direction === 'ASC'
      ? 'ascending'
      : 'descending'
    : 'none';

  return (
    <th aria-sort={ariaSort} className="p-1 text-center">
      <button
        aria-label={`مرتب‌سازی براساس ${label}${active ? `؛ ترتیب فعلی ${sort.direction === 'ASC' ? 'صعودی' : 'نزولی'}` : ''}`}
        className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 font-semibold transition hover:bg-primary/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        onClick={() => onSortChange(nextReportSort(column, sort))}
        type="button"
      >
        <span>{label}</span>
        <Icon
          aria-hidden="true"
          className={active ? 'size-4 text-primary' : 'size-4 opacity-55'}
        />
      </button>
    </th>
  );
}

export function reportingRunError(error: unknown): ReportRunError {
  if (
    error instanceof ReportingApiError &&
    (error.status === 401 || error.status === 403)
  ) {
    return { kind: 'denied', message: error.message };
  }
  return {
    kind: 'connection',
    message:
      error instanceof Error
        ? error.message
        : 'ارتباط گزارش‌ها با سرور برقرار نشد؛ دوباره تلاش کنید.',
  };
}

function formatReportTimestamp(value: string | null): string {
  if (!value) return 'نامشخص';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'نامشخص';
  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Tehran',
  }).format(date);
}

function reportAmountMagnitude(value: string): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.abs(amount) : 0;
}

export function ReportResultPanel({
  chartType,
  connected,
  error,
  mode,
  onChartTypeChange,
  onModeChange,
  onPageChange,
  onRetry,
  onSortChange,
  report,
  result,
  running,
  sort,
  started,
}: {
  chartType: ReportChartType;
  connected: boolean;
  error: ReportRunError | null;
  mode: ReportResultMode;
  onChartTypeChange: (chartType: ReportChartType) => void;
  onModeChange: (mode: ReportResultMode) => void;
  onPageChange: (page: number) => void;
  onRetry: () => void;
  onSortChange: (sort: ReportSort) => void;
  report: ReportDefinition;
  result: SalesByOrganizationReportResult | null;
  running: boolean;
  sort: ReportSort;
  started: boolean;
}) {
  const hasRows = Boolean(result?.rows.length);
  const showDistinctContractKpi = Boolean(
    result &&
      result.rowGrain !== 'ORDER_ITEM_CURRENCY' &&
      result.contractCount !== result.total,
  );
  const incomplete = Boolean(
    result && (!result.sourceDataAsOfUtc || result.warnings.length),
  );
  const maxAmountByCurrency = useMemo(() => {
    const maximums = new Map<string, number>();
    for (const row of result?.rows ?? []) {
      maximums.set(
        row.currencyCode,
        Math.max(
          maximums.get(row.currencyCode) ?? 0,
          reportAmountMagnitude(row.amount),
        ),
      );
    }
    return maximums;
  }, [result]);
  const pieGroups = useMemo(() => {
    const rowsByCurrency = new Map<
      string,
      NonNullable<typeof result>['rows'][number][]
    >();
    for (const row of result?.rows ?? []) {
      const rows = rowsByCurrency.get(row.currencyCode) ?? [];
      rows.push(row);
      rowsByCurrency.set(row.currencyCode, rows);
    }

    return Array.from(rowsByCurrency, ([currencyCode, rows]) => {
      const total = rows.reduce(
        (sum, row) => sum + reportAmountMagnitude(row.amount),
        0,
      );
      let cursor = 0;
      const segments = rows.map((row, index) => {
        const percentage = total
          ? (reportAmountMagnitude(row.amount) / total) * 100
          : 0;
        const start = cursor;
        cursor += percentage;
        return {
          color: reportPieColors[index % reportPieColors.length],
          end: cursor,
          percentage,
          row,
          start,
        };
      });

      return {
        currencyCode,
        gradient: total
          ? `conic-gradient(${segments
              .map(
                (segment) =>
                  `${segment.color} ${segment.start}% ${segment.end}%`,
              )
              .join(', ')})`
          : 'var(--muted)',
        segments,
      };
    });
  }, [result]);
  const availableChartTypes = reportChartTypes(report);
  const detailColumns = useMemo(() => {
    const rows = result?.rows ?? [];
    return {
      passengerCount: rows.some(
        (row) => typeof row.passengerCount === 'number',
      ),
      ticketCount: rows.some((row) => typeof row.ticketCount === 'number'),
      purchaseAmount: rows.some(
        (row) => typeof row.purchaseAmount === 'string',
      ),
      grossProfit: rows.some(
        (row) => typeof row.grossProfit === 'string',
      ),
      refundAmount: rows.some(
        (row) => typeof row.refundAmount === 'string',
      ),
      settlementBalance: rows.some(
        (row) => typeof row.settlementBalance === 'string',
      ),
    };
  }, [result]);

  return (
    <Card
      aria-busy={running}
      aria-live="polite"
      className="h-full min-h-[32rem] p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-primary">نمای نتیجه</p>
          <h2 className="mt-1 font-black">{report.title}</h2>
          {result ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {result.total.toLocaleString('fa-IR')} نتیجه · آخرین دریافت{' '}
              {formatReportTimestamp(result.generatedAtUtc)}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2" aria-label="نوع نمایش گزارش">
          {(['table', 'chart'] as const).map((nextMode) => {
            const Icon = nextMode === 'table' ? Table2 : BarChart3;
            const active = mode === nextMode;
            return (
              <Button
                aria-pressed={active}
                className={active ? darkSurfaceContentClass : undefined}
                disabled={!hasRows || running}
                key={nextMode}
                onClick={() => onModeChange(nextMode)}
                size="sm"
                type="button"
                variant={active ? 'primary' : 'outline'}
              >
                <Icon className="size-4" />
                {nextMode === 'table' ? 'جدول' : 'نمودار'}
              </Button>
            );
          })}
        </div>
      </div>

      {running ? (
        <div className="mt-5 space-y-4" role="status">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Clock3 className="size-4 animate-pulse text-primary" />
            در حال دریافت نتیجه از نمای تأییدشده…
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton className="h-24" key={index} />
            ))}
          </div>
          <Skeleton className="h-72" />
        </div>
      ) : error ? (
        <div className="mt-5">
          <ErrorState
            action={
              <Button onClick={onRetry} type="button">
                تلاش دوباره
              </Button>
            }
            description={error.message}
            title={
              error.kind === 'denied'
                ? 'دسترسی به این گزارش مجاز نیست'
                : error.kind === 'validation'
                  ? 'بازه تاریخ معتبر نیست'
                  : 'خطا در اتصال به سرور گزارش‌ها'
            }
          />
        </div>
      ) : !started ? (
        <div className="mt-5">
          <EmptyState
            description="فیلترهای موردنظر را تنظیم کنید و دکمه «نمایش نتیجه» را بزنید."
            title="گزارش هنوز اجرا نشده است"
          />
        </div>
      ) : !connected ? (
        <div className="mt-5">
          <EmptyState
            description="برای این گزارش هنوز Public Projection تأییدشده منتشر نشده است؛ تا آن زمان داده نمونه نمایش داده نمی‌شود."
            icon={AlertTriangle}
            title="داده گزارش هنوز قابل دریافت نیست"
          />
        </div>
      ) : result && !hasRows ? (
        <div className="mt-5">
          <EmptyState
            action={
              <Button onClick={onRetry} type="button" variant="outline">
                اجرای دوباره
              </Button>
            }
            description="در محدوده دسترسی و فیلترهای انتخاب‌شده رکوردی وجود ندارد."
            title="نتیجه‌ای پیدا نشد"
          />
        </div>
      ) : result && hasRows ? (
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge
              className={
                incomplete
                  ? 'bg-amber-500/10 text-amber-800'
                  : 'bg-emerald-500/10 text-emerald-700'
              }
            >
              {incomplete ? 'داده ناقص' : 'دریافت موفق'}
            </Badge>
            <span className="text-xs text-muted-foreground">
              تازگی منبع: {formatReportTimestamp(result.sourceDataAsOfUtc)}
            </span>
          </div>
          {incomplete ? (
            <div className="flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-6 text-amber-900">
              <AlertTriangle className="mt-1 size-4 shrink-0" />
              <p>
                {result.warnings.length
                  ? result.warnings.join('؛ ')
                  : 'زمان آخرین تغییر منبع در پاسخ موجود نیست؛ نتیجه با همین محدودیت نمایش داده می‌شود.'}
              </p>
            </div>
          ) : null}
          <div
            className={`grid gap-3 sm:grid-cols-2 ${
              showDistinctContractKpi ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
            }`}
          >
            <SummaryCard
              description="در کل محدوده فیلترشده"
              icon={Table2}
              label="تعداد نتایج"
              value={result.total.toLocaleString('fa-IR')}
            />
            {showDistinctContractKpi ? (
              <SummaryCard
                description="بدون تکثیر Passenger یا Segment"
                icon={FileText}
                label="قراردادهای یکتا"
                value={result.contractCount.toLocaleString('fa-IR')}
              />
            ) : null}
            <SummaryCard
              description="جمع مستقل در هر ارز"
              icon={BarChart3}
              label="ارزهای دارای فروش"
              value={result.totalsByCurrency.length.toLocaleString('fa-IR')}
            />
            <SummaryCard
              description="نیازمند پیگیری عملیاتی"
              icon={CalendarClock}
              label="اقدام رزرو در انتظار"
              value={result.summary.pendingReservationActions.toLocaleString(
                'fa-IR',
              )}
            />
          </div>

          {mode === 'chart' ? (
            <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-muted/20 p-3">
              <FormField id="report-result-chart-type" label="نوع نمودار">
                <Select
                  disabled={running || !hasRows}
                  onValueChange={(value) =>
                    onChartTypeChange(value as ReportChartType)
                  }
                  value={chartType}
                >
                  <SelectTrigger className="min-w-44" id="report-result-chart-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableChartTypes.map((value) => (
                      <SelectItem key={value} value={value}>
                        {reportChartTypeLabels[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField id="report-result-sort" label="مرتب‌سازی براساس">
                <Select
                  disabled={running}
                  onValueChange={(value) =>
                    onSortChange({
                      column: value as ReportSort['column'],
                      direction: sort.direction,
                    })
                  }
                  value={sort.column}
                >
                  <SelectTrigger className="min-w-48" id="report-result-sort">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(reportSortLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <Button
                aria-label="تغییر جهت مرتب‌سازی"
                onClick={() =>
                  onSortChange({
                    ...sort,
                    direction: sort.direction === 'ASC' ? 'DESC' : 'ASC',
                  })
                }
                size="sm"
                type="button"
                variant="outline"
              >
                {sort.direction === 'ASC' ? 'صعودی' : 'نزولی'}
              </Button>
            </div>
          ) : null}

          {mode === 'table' ? (
            <div className="overflow-x-auto rounded-2xl border">
              <table className="w-full min-w-[42rem] text-center text-sm">
                <thead className="bg-muted/60 text-muted-foreground">
                  <tr>
                    <ResultSortHeader
                      column="branchId"
                      label={report.dimensions[0] ?? 'بُعد اصلی'}
                      onSortChange={onSortChange}
                      sort={sort}
                    />
                    <ResultSortHeader
                      column="ownerUserId"
                      label={report.dimensions[1] ?? 'بُعد تکمیلی'}
                      onSortChange={onSortChange}
                      sort={sort}
                    />
                    <ResultSortHeader
                      column="currencyCode"
                      label="ارز"
                      onSortChange={onSortChange}
                      sort={sort}
                    />
                    <ResultSortHeader
                      column="contractCount"
                      label="تعداد"
                      onSortChange={onSortChange}
                      sort={sort}
                    />
                    <ResultSortHeader
                      column="amount"
                      label={report.measures[0] ?? 'مبلغ'}
                      onSortChange={onSortChange}
                      sort={sort}
                    />
                    {detailColumns.passengerCount ? (
                      <th className="p-3 text-center font-semibold">
                        تعداد مسافر
                      </th>
                    ) : null}
                    {detailColumns.ticketCount ? (
                      <th className="p-3 text-center font-semibold">
                        تعداد بلیت
                      </th>
                    ) : null}
                    {detailColumns.purchaseAmount ? (
                      <th className="p-3 text-center font-semibold">
                        مبلغ خرید
                      </th>
                    ) : null}
                    {detailColumns.grossProfit ? (
                      <th className="p-3 text-center font-semibold">
                        سود ناخالص
                      </th>
                    ) : null}
                    {detailColumns.refundAmount ? (
                      <th className="p-3 text-center font-semibold">
                        مبلغ استرداد
                      </th>
                    ) : null}
                    {detailColumns.settlementBalance ? (
                      <th className="p-3 text-center font-semibold">
                        مانده تسویه
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => (
                    <tr className="border-t" key={row.grainId}>
                      <td className="p-3 text-center font-mono text-xs" dir="ltr">
                        {row.branchId}
                      </td>
                      <td className="p-3 text-center font-mono text-xs" dir="ltr">
                        {row.ownerUserId}
                      </td>
                      <td className="p-3 text-center" dir="ltr">
                        {row.currencyCode}
                      </td>
                      <td className="p-3 text-center" dir="ltr">
                        {row.contractCount.toLocaleString('fa-IR')}
                      </td>
                      <td className="p-3 text-center font-semibold" dir="ltr">
                        {row.amount}
                      </td>
                      {detailColumns.passengerCount ? (
                        <td className="p-3 text-center" dir="ltr">
                          {row.passengerCount?.toLocaleString('fa-IR') ?? '—'}
                        </td>
                      ) : null}
                      {detailColumns.ticketCount ? (
                        <td className="p-3 text-center" dir="ltr">
                          {row.ticketCount?.toLocaleString('fa-IR') ?? '—'}
                        </td>
                      ) : null}
                      {detailColumns.purchaseAmount ? (
                        <td className="p-3 text-center font-semibold" dir="ltr">
                          {row.purchaseAmount ?? '—'}
                        </td>
                      ) : null}
                      {detailColumns.grossProfit ? (
                        <td className="p-3 text-center font-semibold" dir="ltr">
                          {row.grossProfit ?? '—'}
                        </td>
                      ) : null}
                      {detailColumns.refundAmount ? (
                        <td className="p-3 text-center font-semibold" dir="ltr">
                          {row.refundAmount ?? '—'}
                        </td>
                      ) : null}
                      {detailColumns.settlementBalance ? (
                        <td className="p-3 text-center font-semibold" dir="ltr">
                          {row.settlementBalance ?? '—'}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : chartType === 'horizontal-bar' ? (
            <div
              aria-label={`نمودار میله‌ای افقی ${report.measures[0] ?? 'مبلغ'} به تفکیک ${report.dimensions.slice(0, 2).join(' و ')}`}
              className="space-y-3 rounded-2xl border p-4"
              role="img"
            >
              <div>
                <h3 className="text-sm font-bold">
                  {report.measures[0] ?? 'مبلغ'} به تفکیک {report.dimensions.slice(0, 2).join(' و ')}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  طول هر میله نسبت به بیشترین مبلغ همان ارز محاسبه شده است.
                </p>
              </div>
              {result.rows.map((row) => {
                const maximum = maxAmountByCurrency.get(row.currencyCode) ?? 0;
                const width = maximum
                  ? Math.max(
                      3,
                      (reportAmountMagnitude(row.amount) / maximum) * 100,
                    )
                  : 3;
                return (
                  <div className="space-y-1" key={row.grainId}>
                    <div className="flex justify-between gap-3 text-xs">
                      <span className="truncate">
                        {row.branchId} · {row.ownerUserId}
                      </span>
                      <span className="shrink-0 font-semibold" dir="ltr">
                        {row.amount} {row.currencyCode}
                      </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : chartType === 'column' ? (
            <div
              aria-label={`نمودار ستونی ${report.measures[0] ?? 'مبلغ'} به تفکیک ${report.dimensions.slice(0, 2).join(' و ')}`}
              className="space-y-3 rounded-2xl border p-4"
              role="img"
            >
              <div>
                <h3 className="text-sm font-bold">
                  {report.measures[0] ?? 'مبلغ'} به تفکیک {report.dimensions.slice(0, 2).join(' و ')}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  ارتفاع هر ستون نسبت به بیشترین مبلغ همان ارز محاسبه شده است.
                </p>
              </div>
              <div className="overflow-x-auto pb-2">
                <div className="flex min-w-max items-end gap-4 border-b border-border px-3 pt-8">
                  {result.rows.map((row) => {
                    const maximum = maxAmountByCurrency.get(row.currencyCode) ?? 0;
                    const height = maximum
                      ? Math.max(
                          6,
                          (reportAmountMagnitude(row.amount) / maximum) * 100,
                        )
                      : 6;
                    return (
                      <div className="w-24 shrink-0 text-center" key={row.grainId}>
                        <span className="block truncate text-[11px] font-semibold" dir="ltr">
                          {row.amount} {row.currencyCode}
                        </span>
                        <div className="mt-2 flex h-44 items-end justify-center">
                          <div
                            className="w-12 rounded-t-lg bg-primary"
                            style={{ height: `${height}%` }}
                          />
                        </div>
                        <span className="mt-2 block truncate text-[11px] text-muted-foreground">
                          {row.branchId} · {row.ownerUserId}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div
              aria-label={`نمودار دایره‌ای ${report.measures[0] ?? 'مبلغ'} به تفکیک ${report.dimensions.slice(0, 2).join(' و ')}`}
              className="space-y-4 rounded-2xl border p-4"
              role="img"
            >
              <div>
                <h3 className="text-sm font-bold">
                  سهم {report.measures[0] ?? 'مبلغ'} به تفکیک {report.dimensions.slice(0, 2).join(' و ')}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  سهم هر بخش در هر ارز به‌صورت مستقل محاسبه شده است.
                </p>
              </div>
              <div className="grid gap-5 lg:grid-cols-2">
                {pieGroups.map((group) => (
                  <div
                    className="grid items-center gap-4 rounded-xl bg-muted/25 p-4 sm:grid-cols-[12rem_1fr]"
                    key={group.currencyCode}
                  >
                    <div className="mx-auto text-center">
                      <div
                        aria-hidden="true"
                        className="size-44 rounded-full border-8 border-background shadow-sm"
                        style={{ background: group.gradient }}
                      />
                      <span className="mt-2 block text-xs font-bold" dir="ltr">
                        {group.currencyCode}
                      </span>
                    </div>
                    <ul className="space-y-2 text-xs">
                      {group.segments.map((segment) => (
                        <li
                          className="flex items-center justify-between gap-3"
                          key={segment.row.grainId}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span
                              aria-hidden="true"
                              className="size-3 shrink-0 rounded-sm"
                              style={{ backgroundColor: segment.color }}
                            />
                            <span className="truncate">
                              {segment.row.branchId} · {segment.row.ownerUserId}
                            </span>
                          </span>
                          <span className="shrink-0 font-semibold" dir="ltr">
                            {segment.percentage.toLocaleString('fa-IR', {
                              maximumFractionDigits: 1,
                            })}
                            ٪
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/35 px-3 py-2 text-xs">
            <span>
              صفحه {result.page.toLocaleString('fa-IR')} ·{' '}
              {result.total.toLocaleString('fa-IR')} نتیجه · سقف پیش‌نمایش{' '}
              {result.previewLimit.toLocaleString('fa-IR')}
            </span>
            <div className="flex gap-2">
              <Button
                disabled={running || result.page <= 1}
                onClick={() => onPageChange(result.page - 1)}
                size="sm"
                type="button"
                variant="outline"
              >
                قبلی
              </Button>
              <Button
                disabled={
                  running || result.page * result.pageSize >= result.total
                }
                onClick={() => onPageChange(result.page + 1)}
                size="sm"
                type="button"
                variant="outline"
              >
                بعدی
              </Button>
            </div>
          </div>
          <p className="text-xs leading-6 text-muted-foreground">
            منبع: <span dir="ltr">{result.sourceProjection}</span> · نسخه گزارش{' '}
            {result.reportVersion.toLocaleString('fa-IR')} · تطبیق مبلغ با نمای
            مرجع: تأییدشده
          </p>
        </div>
      ) : (
        <div className="mt-5">
          <EmptyState
            description="برای دریافت داده‌های محدوده مجاز، دکمه «نمایش نتیجه» را دوباره انتخاب کنید."
            icon={WifiOff}
            title="نتیجه‌ای دریافت نشده است"
          />
        </div>
      )}
    </Card>
  );
}

export function ReportingWorkspace({
  initialFilterState,
  view = 'catalog',
  savedFilter = 'all',
}: {
  initialFilterState?: ReportingFilterUrlState;
  view?: ReportingView;
  savedFilter?: SavedReportFilter;
}) {
  const initialReport =
    reportCatalog.find(
      (report) => report.code === initialFilterState?.reportCode,
    ) ?? reportCatalog[0]!;
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ReportDefinition>(initialReport);
  const [category, setCategory] = useState('all');
  const [availability, setAvailability] = useState<ReportAvailability | 'all'>(
    'all',
  );
  const [configurationOpen, setConfigurationOpen] = useState(
    Boolean(initialFilterState?.reportCode),
  );
  const [persistFilterState, setPersistFilterState] = useState(
    Boolean(initialFilterState?.reportCode),
  );
  const [exportFormat, setExportFormat] = useState<ExportFormat>('XLSX');
  const [exportState, setExportState] = useState<
    'idle' | 'generating' | 'ready' | 'error'
  >('idle');
  const [exportFeedback, setExportFeedback] = useState('');
  const [resultPreviewVisible, setResultPreviewVisible] = useState(false);
  const [resultMode, setResultMode] = useState<ReportResultMode>('table');
  const [resultChartType, setResultChartType] =
    useState<ReportChartType>('horizontal-bar');
  const [resultSort, setResultSort] = useState<ReportSort>(defaultReportSort);
  const [fromDate, setFromDate] = useState(initialFilterState?.fromDate ?? '');
  const [toDate, setToDate] = useState(initialFilterState?.toDate ?? '');
  const [currency, setCurrency] = useState(
    initialFilterState?.currency ?? 'ALL',
  );
  const [legalEntity, setLegalEntity] = useState(
    initialFilterState?.legalEntity ?? 'ALL',
  );
  const [reportFilterValues, setReportFilterValues] = useState<
    Record<string, string>
  >(() =>
    initialReportingFilterValues(
      initialReport,
      initialFilterState?.filterValues ?? {},
    ),
  );
  const [result, setResult] = useState<SalesByOrganizationReportResult | null>(
    null,
  );
  const [availableFilterOptions, setAvailableFilterOptions] = useState<
    SalesByOrganizationReportResult['filterOptions'] | null
  >(null);
  const [runError, setRunError] = useState<ReportRunError | null>(null);
  const [running, setRunning] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState('');
  const [workspaceCounts, setWorkspaceCounts] =
    useState<ReportingWorkspaceCounts | null>(null);
  const refreshWorkspaceCounts = useCallback(async () => {
    try {
      setWorkspaceCounts(await reportingApi.workspaceCounts());
    } catch {
      setWorkspaceCounts(null);
    }
  }, []);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void refreshWorkspaceCounts();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [refreshWorkspaceCounts]);
  const visible = useMemo(() => {
    const filtered = filterReportCatalog({
      availability,
      category,
      query,
    });
    return reportPriorityGroups.flatMap((group) =>
      group.reportCodes
        .map((code) => filtered.find((report) => report.code === code))
        .filter((report): report is ReportDefinition => report !== undefined),
    );
  }, [availability, category, query]);
  const categories = [
    ...new Set(reportCatalog.map((report) => report.category)),
  ];
  const connectedReportSelected =
    selected.availability === 'READY';
  const supportedConnectedFilterLabels = new Set(['شعبه', 'کارشناس', 'وضعیت']);
  const unsupportedConnectedFilters =
    selected.code === 'sales_by_organization' &&
    (legalEntity !== 'ALL' ||
      Object.entries(reportFilterValues).some(
        ([label, value]) => value && !supportedConnectedFilterLabels.has(label),
      ));
  const filterSnapshot = useMemo(
    () =>
      buildReportingFilterSnapshot({
        currency,
        filterValues: reportFilterValues,
        fromDate,
        legalEntity,
        report: selected,
        toDate,
      }),
    [currency, fromDate, legalEntity, reportFilterValues, selected, toDate],
  );
  const reportExportQuery = useMemo(
    () => ({
      filters: {
        ...reportDateRangeUtc(fromDate, toDate),
        ...(currency !== 'ALL' ? { currencyCode: currency } : {}),
        ...reportFilterApiValues(reportFilterValues),
      },
      ...(legalEntity !== 'ALL' ? { legalEntityId: legalEntity } : {}),
      page: 1,
      pageSize: 100,
      sort: { column: 'salesAmount', direction: 'DESC' },
      timezone: 'Asia/Tehran',
    }),
    [currency, fromDate, legalEntity, reportFilterValues, toDate],
  );
  const activeFilterCount = filterSnapshot.filter((item) => item.active).length;
  const dateRangeError = reportingDateRangeError(fromDate, toDate);
  const producerFilterOptions = result?.filterOptions ?? availableFilterOptions;

  function optionsForReportFilter(
    filter: string,
  ): readonly ReportFilterOption[] {
    if (filter === 'شعبه')
      return (producerFilterOptions?.branchIds ?? []).map((value) => ({
        value,
        label: value,
      }));
    if (filter === 'کارشناس')
      return (producerFilterOptions?.ownerUserIds ?? []).map((value) => ({
        value,
        label: value,
      }));
    if (filter === 'وضعیت') {
      const allowed = new Set(producerFilterOptions?.statuses ?? []);
      return producerFilterOptions
        ? salesStatusOptions.filter((option) => allowed.has(option.value))
        : salesStatusOptions;
    }
    return [];
  }

  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        `reporting.filters.${selected.code}`,
        JSON.stringify(reportFilterValues),
      );
    } catch {
      // URL state still preserves non-identifying filter values.
    }
  }, [reportFilterValues, selected.code]);

  useEffect(() => {
    if (!configurationOpen || !connectedReportSelected) return;
    let current = true;
    void reportingApi
      .salesByOrganization({ reportCode: selected.code, pageSize: 1 })
      .then((preview) => {
        if (current) setAvailableFilterOptions(preview.filterOptions);
      })
      .catch(() => {
        // The explicit Run action presents authentication or connection errors.
      });
    return () => {
      current = false;
    };
  }, [configurationOpen, connectedReportSelected, selected.code]);

  useEffect(() => {
    if (!persistFilterState || typeof window === 'undefined') return;
    const nextHref = reportingFilterStateHref(window.location.href, {
      currency,
      filterValues: reportFilterValues,
      fromDate,
      legalEntity,
      reportCode: selected.code,
      toDate,
    });
    const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextHref !== currentHref)
      window.history.replaceState(window.history.state, '', nextHref);
  }, [
    currency,
    fromDate,
    legalEntity,
    persistFilterState,
    reportFilterValues,
    selected.code,
    toDate,
  ]);

  function resetCatalogFilters() {
    setQuery('');
    setCategory('all');
    setAvailability('all');
  }

  function clearAllReportFilters() {
    setFromDate('');
    setToDate('');
    setCurrency('ALL');
    setLegalEntity('ALL');
    setReportFilterValues({});
    setResult(null);
    setResultPreviewVisible(false);
    setRunError(null);
  }

  function clearReportFilter(label: string) {
    if (label === 'بازه تاریخ') {
      setFromDate('');
      setToDate('');
    } else if (label === 'شرکت') {
      setLegalEntity('ALL');
    } else if (label === 'ارز') {
      setCurrency('ALL');
    } else {
      setReportFilterValues((current) => {
        const next = { ...current };
        delete next[label];
        return next;
      });
    }
    setResult(null);
    setResultPreviewVisible(false);
    setRunError(null);
  }

  async function runReport(page = 1, sort = resultSort) {
    if (dateRangeError) {
      setRunError({ kind: 'validation', message: dateRangeError });
      return;
    }
    if (!connectedReportSelected) return;
    if (unsupportedConnectedFilters) {
      setRunError({
        kind: 'validation',
        message:
          'یکی از فیلترهای انتخاب‌شده هنوز در Public Projection این گزارش پشتیبانی نمی‌شود.',
      });
      return;
    }
    setRunning(true);
    setRunError(null);
    setResult(null);
    setResultSort(sort);
    try {
      const preview = await reportingApi.salesByOrganization({
        reportCode: selected.code,
        ...(currency === 'ALL' ? {} : { currencyCode: currency }),
        ...(fromDate ? { fromDate } : {}),
        ...(toDate ? { toDate } : {}),
        legalEntity,
        ...(selected.code === 'sales_by_organization' && reportFilterValues['شعبه']
          ? { branchId: reportFilterValues['شعبه'] }
          : {}),
        ...(selected.code === 'sales_by_organization' && reportFilterValues['کارشناس']
          ? { ownerUserId: reportFilterValues['کارشناس'] }
          : {}),
        ...(selected.code === 'sales_by_organization' && reportFilterValues['وضعیت']
          ? { status: reportFilterValues['وضعیت'] }
          : {}),
        filterValues:
          selected.code === 'sales_by_organization'
            ? {}
            : reportFilterApiValues(reportFilterValues),
        page,
        sort,
      });
      setAvailableFilterOptions(preview.filterOptions);
      setResult(preview);
    } catch (error) {
      setRunError(reportingRunError(error));
    } finally {
      setRunning(false);
    }
  }

  async function downloadReportExport() {
    if (dateRangeError) {
      setExportState('error');
      setExportFeedback(dateRangeError);
      return;
    }
    if (unsupportedConnectedFilters) {
      setExportState('error');
      setExportFeedback(
        'یکی از فیلترهای انتخاب‌شده هنوز برای خروجی این گزارش پشتیبانی نمی‌شود.',
      );
      return;
    }

    setExportState('generating');
    setExportFeedback('فایل در حال تولید است…');
    try {
      await createAndDownloadReportExport({
        format: exportFormat,
        query: reportExportQuery,
        reportCode: selected.code,
      });
      await refreshWorkspaceCounts();
      setExportState('ready');
      setExportFeedback('فایل آماده شد و دانلود آن آغاز شد.');
    } catch (error) {
      setExportState('error');
      setExportFeedback(
        error instanceof Error ? error.message : 'تولید خروجی ناموفق بود.',
      );
    }
  }

  return (
    <main className="space-y-6" dir="rtl">
      <PageHeader title="گزارش‌ها و خروجی‌های مدیریتی" />
      <nav
        aria-label="نماهای گزارش"
        className="flex gap-2 overflow-x-auto pb-1"
      >
        {workspaceViews.map(({ icon: Icon, id, label }) => {
          const count = workspaceCountForView(id, workspaceCounts);
          return (
          <Button
            asChild
            aria-current={view === id ? 'page' : undefined}
            className={
              view === id ? `shrink-0 ${darkSurfaceContentClass}` : 'shrink-0'
            }
            key={id}
            variant={view === id ? 'primary' : 'outline'}
          >
            <Link href={reportingViewHref(id)} scroll={false}>
              <Icon aria-hidden="true" className="size-4" />
              {label}
              <span
                className="rounded-md bg-current/10 px-1.5 text-xs tabular-nums"
                aria-label={count === undefined ? `در حال دریافت تعداد ${label}` : `${count.toLocaleString('fa-IR')} مورد در ${label}`}
                title={count === undefined ? 'در حال دریافت تعداد از سرور' : `تعداد به‌روز ${label}`}
              >
                {count === undefined ? '…' : count.toLocaleString('fa-IR')}
              </span>
            </Link>
          </Button>
          );
        })}
      </nav>
      {view === 'catalog' ? (
        <section>
            <div className="space-y-4">
              <Card className="p-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(20rem,1fr)_repeat(2,minmax(13rem,auto))]">
                  <label className="relative md:col-span-2 xl:col-span-1">
                    <Search className="absolute end-3 top-3 size-4 text-muted-foreground" />
                    <Input
                      aria-label="جست‌وجوی گزارش"
                      className="pe-10"
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="جست‌وجو در عنوان، دسته یا کد گزارش"
                      value={query}
                    />
                  </label>
                  <Select onValueChange={setCategory} value={category}>
                    <SelectTrigger aria-label="دسته گزارش">
                      <Filter className="size-4" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">همه دسته‌ها</SelectItem>
                      {categories.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    onValueChange={(value) =>
                      setAvailability(value as ReportAvailability | 'all')
                    }
                    value={availability}
                  >
                    <SelectTrigger
                      aria-label="وضعیت اتصال گزارش"
                      className="whitespace-nowrap [&>span]:whitespace-nowrap"
                    >
                      <ShieldCheck className="size-4" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">همه وضعیت‌های اتصال</SelectItem>
                      <SelectItem value="READY">قابل اجرای محدود</SelectItem>
                      <SelectItem value="PENDING_CONNECTION">
                        در انتظار منبع داده
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  <span aria-live="polite">
                    نمایش {visible.length.toLocaleString('fa-IR')} از{' '}
                    {reportCatalog.length.toLocaleString('fa-IR')} گزارش
                  </span>
                </div>
              </Card>
              {visible.length ? (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {visible.map((report) => (
                    <ReportCard
                      key={report.code}
                      onSelect={(nextReport) => {
                        setSelected(nextReport);
                        setPersistFilterState(true);
                        setResult(null);
                        setRunError(null);
                        setResultPreviewVisible(false);
                        setResultMode('table');
                        setResultChartType('horizontal-bar');
                        setResultSort(defaultReportSort);
                        setExportFormat('XLSX');
                        setFromDate('');
                        setToDate('');
                        setCurrency('ALL');
                        setLegalEntity('ALL');
                        setReportFilterValues({});
                        setConfigurationOpen(true);
                      }}
                      report={report}
                      selected={selected.code === report.code}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  action={
                    <Button
                      onClick={resetCatalogFilters}
                      type="button"
                      variant="outline"
                    >
                      پاک‌کردن جست‌وجو و فیلترها
                    </Button>
                  }
                  description="عبارت جست‌وجو یا فیلترهای دسته و اتصال را تغییر دهید."
                  title="گزارشی پیدا نشد"
                />
              )}
            </div>
        </section>
      ) : (
        <Card
          className="space-y-4 p-6"
          aria-label={workspaceViews.find((item) => item.id === view)?.label}
        >
          <h2 className="text-lg font-bold">
            {workspaceViews.find((item) => item.id === view)?.label}
          </h2>
          <ReportingOperationsView
            onMutation={refreshWorkspaceCounts}
            view={view}
            savedFilter={savedFilter}
          />
        </Card>
      )}
      <Dialog onOpenChange={setConfigurationOpen} open={configurationOpen}>
            <DialogContent
              className="max-h-[calc(100vh-1rem)] max-w-6xl overflow-y-auto p-4 sm:p-6"
              dir="rtl"
            >
              <div>
                <DialogTitle className="pe-10 text-xl font-black">
                  {selected.title}
                </DialogTitle>
                <DialogDescription className="mt-1 leading-7">
                  {selected.description}
                </DialogDescription>
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4 text-xs">
                  <Badge
                    className={
                      connectedReportSelected
                        ? 'bg-emerald-500/10 text-emerald-700'
                        : 'bg-amber-500/10 text-amber-700'
                    }
                  >
                    {connectedReportSelected
                      ? 'اتصال محدود قابل اجرا'
                      : 'در انتظار منبع داده'}
                  </Badge>
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock3 aria-hidden="true" className="size-3.5" />
                    تازگی منبع:{' '}
                    {connectedReportSelected ? 'نامشخص' : 'منبع منتشر نشده'}
                  </span>
                  {result ? (
                    <span className="text-muted-foreground">
                      زمان دریافت نتیجه:{' '}
                      <span dir="ltr">{result.generatedAtUtc}</span>
                    </span>
                  ) : null}
                </div>
                <section
                  aria-label="Filter Snapshot"
                  className="mt-4 rounded-2xl border border-primary/15 bg-primary/[0.035] p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Clock3
                        aria-hidden="true"
                        className="size-4 text-primary"
                      />
                      <div>
                        <h2 className="font-bold">خلاصه فیلترها</h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Filter Snapshot · تنظیمات جاری برای اجرای بعدی
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        className={
                          activeFilterCount
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-muted-foreground'
                        }
                      >
                        {activeFilterCount.toLocaleString('fa-IR')} فیلتر فعال
                      </Badge>
                      <Button
                        disabled={!activeFilterCount}
                        onClick={clearAllReportFilters}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        <RotateCcw aria-hidden="true" className="size-3.5" />
                        پاک‌کردن همه
                      </Button>
                    </div>
                  </div>
                  <dl className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border bg-surface px-3 py-2">
                      <dt className="text-[11px] text-muted-foreground">
                        گزارش
                      </dt>
                      <dd
                        className="mt-1 truncate text-xs font-semibold"
                        dir="ltr"
                      >
                        {selected.code}@v
                        {result?.reportVersion ??
                          (connectedReportSelected ? 2 : 1)}
                      </dd>
                    </div>
                    {filterSnapshot.map((item) => (
                      <div
                        className={
                          item.active
                            ? 'rounded-xl border border-primary/30 bg-primary/5 px-3 py-2'
                            : 'rounded-xl border bg-surface px-3 py-2'
                        }
                        key={item.label}
                      >
                        <dt className="text-[11px] text-muted-foreground">
                          {item.label}
                        </dt>
                        <dd className="mt-1 flex min-w-0 items-center justify-between gap-2 text-xs font-semibold">
                          <span className="truncate" title={item.value}>
                            {item.value}
                          </span>
                          {item.active ? (
                            <button
                              aria-label={`حذف فیلتر ${item.label}`}
                              className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
                              onClick={() => clearReportFilter(item.label)}
                              title={`حذف فیلتر ${item.label}`}
                              type="button"
                            >
                              <X aria-hidden="true" className="size-3.5" />
                            </button>
                          ) : null}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-3 text-xs leading-6 text-muted-foreground">
                    موارد بالا انتخاب‌های فعلی کاربر هستند. در اجرای واقعی، فقط
                    فیلترهای پشتیبانی‌شده به Producer ارسال می‌شوند و نسخه View،
                    Scope و Snapshot تأییدشده در پاسخ سرور ثبت می‌شود.
                    محدوده‌های غیرهویتی در URL و مقادیر هویتی فقط در نشست همین
                    مرورگر نگه‌داری می‌شوند.
                    {result ? (
                      <span className="mt-1 block font-semibold text-emerald-700">
                        Snapshot سرور در{' '}
                        <span dir="ltr">
                          {result.filterSnapshot.capturedAtUtc}
                        </span>{' '}
                        تأیید شد.
                      </span>
                    ) : null}
                  </p>
                </section>
                <section
                  aria-labelledby="report-workspace-filters"
                  className="mt-5 border-t pt-4"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-bold" id="report-workspace-filters">
                      فیلترهای گزارش
                    </h2>
                    <span className="text-xs text-muted-foreground">
                      «همه» یعنی این بُعد محدود نشده است.
                    </span>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(14rem,1fr)]">
                    <ReportDateRangeFields
                      error={dateRangeError}
                      fromDate={fromDate}
                      onFromDateChange={setFromDate}
                      onToDateChange={setToDate}
                      toDate={toDate}
                    />
                    <ReportSearchableSelect
                      allLabel="همه شرکت‌ها"
                      id="report-company"
                      label="شرکت"
                      onValueChange={setLegalEntity}
                      options={legalEntityOptions}
                      value={legalEntity}
                    />
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <ReportSearchableSelect
                      allLabel="همه ارزها (بدون جمع)"
                      id="report-currency"
                      label="ارز"
                      onValueChange={setCurrency}
                      options={currencyOptions}
                      value={currency}
                    />
                    {selected.filters
                      .filter(
                        (filter) =>
                          !['بازه تاریخ', 'شرکت', 'ارز'].includes(filter),
                      )
                      .slice(0, 8)
                      .map((filter, index) => (
                        <ReportSearchableSelect
                          allLabel={reportingAllFilterLabel(filter)}
                          id={`report-filter-${selected.code}-${index}`}
                          key={`${selected.code}-${filter}`}
                          label={filter}
                          onValueChange={(value) =>
                            setReportFilterValues((current) => {
                              const next = { ...current };
                              if (value && value !== 'ALL')
                                next[filter] = value;
                              else delete next[filter];
                              return next;
                            })
                          }
                          options={optionsForReportFilter(filter)}
                          value={reportFilterValues[filter] ?? 'ALL'}
                        />
                      ))}
                  </div>
                </section>
                <div className="mt-5 grid gap-4 border-t pt-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
                  <aside
                    aria-label="عملیات گزارش"
                    className="h-fit space-y-3 rounded-2xl border bg-muted/20 p-3"
                  >
                    <div>
                      <h2 className="text-sm font-bold">عملیات گزارش</h2>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        اجرا، ذخیره و خروجی در همین Workspace
                      </p>
                    </div>
                    <Button
                      className="w-full"
                      disabled={
                        running ||
                        Boolean(dateRangeError) ||
                        (connectedReportSelected && unsupportedConnectedFilters)
                      }
                      loading={running}
                      onClick={() => {
                        setResultPreviewVisible(true);
                        void runReport();
                      }}
                      type="button"
                    >
                      <Play aria-hidden="true" className="size-4" />
                      نمایش نتیجه
                    </Button>
                    <Button
                      className="w-full"
                      onClick={async () => {
                        try {
                          await reportingApi.saveReport({
                            reportCode: selected.code,
                            name: selected.title,
                            sharingScope: 'PERSONAL',
                            isFavorite: false,
                            filterState: {
                              fromDate,
                              toDate,
                              legalEntity,
                              currency,
                              filterValues: reportFilterValues,
                            },
                          });
                          setSaveFeedback('گزارش با تنظیمات فعلی ذخیره شد.');
                          await refreshWorkspaceCounts();
                        } catch (error) { setSaveFeedback(error instanceof Error ? error.message : 'ذخیره گزارش ناموفق بود.'); }
                      }}
                      type="button"
                      variant="outline"
                    >
                      <Save aria-hidden="true" className="size-4" />
                      ذخیره گزارش
                    </Button>
                    {saveFeedback ? <p className="rounded-lg bg-primary/5 p-2 text-xs leading-5" role="status">{saveFeedback}</p> : null}
                    <div className="border-t pt-3">
                      <label
                        className="mb-1.5 block text-xs font-semibold"
                        htmlFor="report-export-format"
                      >
                        نوع فایل خروجی
                      </label>
                      <Select
                        onValueChange={(value) => {
                          setExportFormat(value as ExportFormat);
                          setExportState('idle');
                          setExportFeedback('');
                        }}
                        value={exportFormat}
                      >
                        <SelectTrigger
                          aria-label="نوع فایل خروجی"
                          className="h-10 w-full"
                          id="report-export-format"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="XLSX">Excel</SelectItem>
                          <SelectItem value="PDF">PDF</SelectItem>
                          <SelectItem value="CSV">CSV</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      className="w-full"
                      disabled={exportState === 'generating'}
                      loading={exportState === 'generating'}
                      onClick={() => void downloadReportExport()}
                      type="button"
                      variant="outline"
                    >
                      <FileDown className="size-4" />
                      {exportState === 'generating'
                        ? 'در حال تولید فایل…'
                        : exportState === 'error'
                          ? 'تلاش مجدد برای خروجی'
                          : 'خروجی گرفتن نتیجه'}
                    </Button>
                    {exportFeedback ? (
                      <p
                        className={
                          exportState === 'error'
                            ? 'rounded-lg bg-red-500/10 p-2 text-xs leading-5 text-red-800'
                            : exportState === 'ready'
                              ? 'rounded-lg bg-emerald-500/10 p-2 text-xs leading-5 text-emerald-800'
                              : 'rounded-lg bg-primary/5 p-2 text-xs leading-5 text-muted-foreground'
                        }
                        role="status"
                      >
                        {exportFeedback}
                      </p>
                    ) : null}
                    {connectedReportSelected && unsupportedConnectedFilters ? (
                      <p className="mt-3 rounded-xl bg-amber-500/10 p-3 text-xs leading-6 text-amber-800">
                        مالکیت شرکت یا یکی از ابعاد انتخاب‌شده هنوز در Public
                        Projection فروش منتشر نشده است. برای جلوگیری از خروجی
                        نادرست، آن فیلتر را روی «همه» بگذارید.
                      </p>
                    ) : null}
                    <p className="mt-3 text-xs leading-6 text-muted-foreground">
                      Pagination، مرتب‌سازی، سقف ۱۰۰ رکورد پیش‌نمایش، UTC و
                      Scope مجاز فقط سمت سرور enforce می‌شوند.
                    </p>
                  </aside>
                  <section aria-label="محل نمایش نمایه نتیجه">
                    <ReportResultPanel
                      chartType={resultChartType}
                      connected={connectedReportSelected}
                      error={runError}
                      mode={resultMode}
                      onChartTypeChange={setResultChartType}
                      onModeChange={setResultMode}
                      onPageChange={(page) => void runReport(page)}
                      onRetry={() => void runReport()}
                      onSortChange={(sort) => void runReport(1, sort)}
                      report={selected}
                      result={result}
                      running={running}
                      sort={resultSort}
                      started={resultPreviewVisible}
                    />
                  </section>
                </div>
              </div>
            </DialogContent>
      </Dialog>
    </main>
  );
}
