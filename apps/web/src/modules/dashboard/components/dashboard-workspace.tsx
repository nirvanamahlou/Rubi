'use client';

import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BadgeDollarSign,
  BarChart3,
  Banknote,
  BriefcaseBusiness,
  Building2,
  CalendarCheck,
  CalendarRange,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  CircleCheckBig,
  CircleDollarSign,
  Clock3,
  Filter,
  Gauge,
  Hotel,
  Info,
  LayoutDashboard,
  LineChart,
  ListFilter,
  LockKeyhole,
  Megaphone,
  Minus,
  PhoneCall,
  PieChart,
  Plane,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  ShieldAlert,
  Ticket,
  UserRoundCog,
  UserCheck,
  UserPlus,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import type { CalendarSystem } from '@/components/ui/date-picker.utils';
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
  DialogDescription,
  DialogTitle,
  Drawer,
  DrawerClose,
  DrawerContent,
} from '@/components/ui/overlays';
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
} from '@/components/ui/surfaces';
import { cn } from '@/lib/utils';
import { faMessages } from '@/messages/fa';
import { useLegalEntityContext } from '@/modules/legal-entities/components/legal-entity-context';
import { reportCatalog } from '@/modules/reports/model/reporting';
import {
  dashboardProjectionClient,
  type DashboardComparisonSnapshot,
  type DashboardFilterOptions,
  type DashboardMetricSnapshot,
  type DashboardTrendSnapshot,
} from '../model/projection-client';
import {
  dashboardDateRangeError,
  dashboardFiltersFromSearchParams,
  dashboardFiltersToSearchParams,
  defaultDashboardFilters,
  type DashboardFilters,
  type DashboardRange,
} from '../model/query';
import {
  dashboardKpis,
  dashboardNavigation,
  dashboardOpenDecisions,
  dashboardPages,
  type DashboardKpiDefinition,
  type DashboardKpiRole,
  type DashboardVisualKind,
} from '../model/registry';

const rangeOptions: readonly [DashboardRange, string][] = [
  ['today', 'امروز'],
  ['week', 'این هفته'],
  ['month', 'این ماه'],
  ['quarter', 'این فصل'],
  ['year', 'امسال'],
  ['custom', 'بازه سفارشی'],
];

const executiveSalesTitles: Record<DashboardRange, string> = {
  today: 'فروش امروز',
  week: 'فروش این هفته',
  month: 'فروش این ماه',
  quarter: 'فروش این فصل',
  year: 'فروش امسال',
  custom: 'فروش بازه انتخابی',
};

const dimensionFilters: readonly {
  key: DashboardFilterKey;
  label: string;
  allLabel: string;
}[] = [
  { key: 'salesChannel', label: 'سایت / کانال فروش', allLabel: 'همه کانال‌های فروش' },
  { key: 'branch', label: 'شعبه', allLabel: 'همه شعبه‌ها' },
  { key: 'agent', label: 'کارشناس', allLabel: 'همه کارشناسان' },
  { key: 'service', label: 'نوع خدمت', allLabel: 'همه انواع خدمت' },
  { key: 'agency', label: 'آژانس', allLabel: 'همه آژانس‌ها' },
  { key: 'provider', label: 'تأمین‌کننده', allLabel: 'همه تأمین‌کنندگان' },
  { key: 'currency', label: 'ارز', allLabel: 'همه ارزها (بدون جمع)' },
  { key: 'status', label: 'وضعیت', allLabel: 'همه وضعیت‌ها' },
];

type DashboardFilterKey = keyof DashboardFilterOptions;

const dashboardPageFilterKeys: Readonly<Record<string, readonly DashboardFilterKey[]>> = {
  'executive-overview': ['salesChannel', 'branch', 'service', 'currency', 'status'],
  'executive-growth-risk': ['branch', 'service', 'currency', 'status'],
  'commercial-performance': [
    'salesChannel',
    'branch',
    'agent',
    'service',
    'agency',
    'provider',
    'currency',
    'status',
  ],
  'sales-profitability-analysis': ['salesChannel', 'branch', 'agent', 'service', 'currency'],
  'sales-segment-analysis': ['salesChannel', 'branch', 'service', 'agency', 'currency'],
  'revenue-collections': ['branch', 'service', 'currency', 'status'],
  'travel-operations': ['branch', 'agent', 'service', 'provider', 'status'],
  'flight-route-analysis': ['branch', 'service', 'provider', 'currency', 'status'],
  'inventory-products': ['branch', 'service', 'provider', 'currency'],
  'tour-hotel-performance': ['branch', 'service', 'provider', 'currency'],
  'procurement-suppliers': ['branch', 'service', 'provider', 'currency', 'status'],
  'finance-treasury': ['branch', 'currency', 'status', 'service'],
  'finance-profitability-costs': ['branch', 'service', 'currency', 'status'],
  'finance-obligations-risk': ['branch', 'currency', 'status', 'agency', 'provider'],
  'customer-growth': ['salesChannel', 'branch', 'service', 'agency', 'status'],
  'customer-behavior-analysis': ['salesChannel', 'branch', 'service', 'agency'],
  'customer-crm': ['salesChannel', 'branch', 'agent', 'service', 'status'],
  'support-service-quality': ['branch', 'agent', 'service', 'status'],
  'partners-b2b': ['agency', 'branch', 'salesChannel', 'service', 'provider', 'currency'],
  'marketing-growth': ['salesChannel', 'branch', 'service', 'agency', 'status'],
  'workforce-hr': ['branch', 'agent', 'service', 'status'],
  'hr-record-quality': ['branch', 'agent', 'service', 'status'],
  'employee-commercial-performance': ['branch', 'agent', 'service', 'salesChannel'],
  'employee-crm-activity': ['branch', 'agent', 'salesChannel', 'status'],
  'employee-sales-quality': ['branch', 'agent', 'service', 'salesChannel', 'status'],
  'tasks-automation': ['branch', 'agent', 'status'],
  'documents-reports-data-quality': ['branch', 'status'],
};

const filterLabelByKey = new Map(
  dimensionFilters.map((filter) => [filter.key, filter.label] as const),
);
const filterAllLabelByKey = new Map(
  dimensionFilters.map((filter) => [filter.key, filter.allLabel] as const),
);
const dashboardFilterKeySet = new Set<DashboardFilterKey>(
  dimensionFilters.map((filter) => filter.key),
);

const visualIcons: Record<DashboardVisualKind, typeof BarChart3> = {
  line: LineChart,
  bar: BarChart3,
  donut: PieChart,
  'stacked-bar': BarChart3,
  funnel: ListFilter,
  table: ListFilter,
  queue: AlertTriangle,
};

const visualLabels: Record<DashboardVisualKind, string> = {
  line: 'نمودار روند',
  bar: 'نمودار مقایسه‌ای',
  donut: 'نمودار سهم',
  'stacked-bar': 'نمودار ترکیبی',
  funnel: 'قیف تصمیم',
  table: 'جدول تحلیلی',
  queue: 'صف اقدام',
};

const kpiRoleLabels: Record<DashboardKpiRole, string> = {
  outcome: 'نتیجه',
  driver: 'محرک',
  guardrail: 'کنترل ریسک',
  diagnostic: 'تشخیصی',
};

const dashboardPageById = new Map(
  dashboardPages.map((page) => [page.id, page] as const),
);

type KpiVisual = {
  icon: LucideIcon;
  label: string;
  className: string;
};

const kpiVisualMatchers: readonly [RegExp, KpiVisual][] = [
  [
    /cancel|refund|failure|breach|overdue|risk|debt|payables|receivables|due|blocker|guarantee/i,
    {
      icon: ShieldAlert,
      label: 'ریسک و استثنا',
      className:
        'bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-950/50 dark:text-rose-200 dark:ring-rose-900',
    },
  ],
  [
    /lead|customer|crm|followup|satisfaction|consent|ticket|employee|response-time/i,
    {
      icon: UsersRound,
      label: 'مشتری و ارتباط',
      className:
        'bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-950/50 dark:text-blue-200 dark:ring-blue-900',
    },
  ],
  [
    /tour|hotel|airline|ticket|route|reservation|order|issue|capacity|offer|stay|awaiting-payment|delivery/i,
    {
      icon: Plane,
      label: 'عملیات سفر و محصول',
      className:
        'bg-sky-50 text-sky-700 ring-sky-100 dark:bg-sky-950/50 dark:text-sky-200 dark:ring-sky-900',
    },
  ],
  [
    /campaign|marketing|advertising|attributed/i,
    {
      icon: Megaphone,
      label: 'بازاریابی و رشد',
      className:
        'bg-violet-50 text-violet-700 ring-violet-100 dark:bg-violet-950/50 dark:text-violet-200 dark:ring-violet-900',
    },
  ],
  [
    /workday|leave|overtime|hr|performance/i,
    {
      icon: BriefcaseBusiness,
      label: 'سرمایه انسانی',
      className:
        'bg-indigo-50 text-indigo-700 ring-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-200 dark:ring-indigo-900',
    },
  ],
  [
    /supplier|provider|spend|purchase|inventory|remaining|sell-through/i,
    {
      icon: Building2,
      label: 'تأمین و ظرفیت',
      className:
        'bg-orange-50 text-orange-700 ring-orange-100 dark:bg-orange-950/50 dark:text-orange-200 dark:ring-orange-900',
    },
  ],
  [
    /sales|revenue|profit|income|amount|price|discount|commission|balance|collection|collected|payment|expense|roas/i,
    {
      icon: BadgeDollarSign,
      label: 'فروش و مالی',
      className:
        'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-900',
    },
  ],
  [
    /rate|ratio|growth|conversion|average|count|number|volume|age/i,
    {
      icon: ChartNoAxesCombined,
      label: 'روند و عملکرد',
      className:
        'bg-cyan-50 text-cyan-700 ring-cyan-100 dark:bg-cyan-950/50 dark:text-cyan-200 dark:ring-cyan-900',
    },
  ],
];

const kpiVisualOverrides: Readonly<Record<string, KpiVisual>> = {
  'gross-sales': {
    icon: Banknote,
    label: 'مبلغ فروش',
    className:
      'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-900',
  },
  'net-sales': {
    icon: BadgeDollarSign,
    label: 'فروش خالص',
    className:
      'bg-teal-50 text-teal-700 ring-teal-100 dark:bg-teal-950/50 dark:text-teal-200 dark:ring-teal-900',
  },
  'new-customers': {
    icon: UserPlus,
    label: 'مشتری جدید',
    className:
      'bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-950/50 dark:text-blue-200 dark:ring-blue-900',
  },
  'returning-customers': {
    icon: UserCheck,
    label: 'مشتری بازگشتی',
    className:
      'bg-violet-50 text-violet-700 ring-violet-100 dark:bg-violet-950/50 dark:text-violet-200 dark:ring-violet-900',
  },
  'new-leads': {
    icon: UserPlus,
    label: 'لید جدید',
    className:
      'bg-sky-50 text-sky-700 ring-sky-100 dark:bg-sky-950/50 dark:text-sky-200 dark:ring-sky-900',
  },
  'lead-volume': {
    icon: UsersRound,
    label: 'حجم لید',
    className:
      'bg-sky-50 text-sky-700 ring-sky-100 dark:bg-sky-950/50 dark:text-sky-200 dark:ring-sky-900',
  },
  'employee-call-count': {
    icon: PhoneCall,
    label: 'تماس ثبت‌شده',
    className:
      'bg-cyan-50 text-cyan-700 ring-cyan-100 dark:bg-cyan-950/50 dark:text-cyan-200 dark:ring-cyan-900',
  },
  'employee-lead-count': {
    icon: UserPlus,
    label: 'لیدهای ثبت‌شده',
    className:
      'bg-sky-50 text-sky-700 ring-sky-100 dark:bg-sky-950/50 dark:text-sky-200 dark:ring-sky-900',
  },
  'employee-finalized-sales-count': {
    icon: BadgeDollarSign,
    label: 'فروش نهایی کارشناس',
    className:
      'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-900',
  },
  'employee-sales-amount': {
    icon: Banknote,
    label: 'مبلغ فروش کارشناس',
    className:
      'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-900',
  },
  'employee-lead-conversion': {
    icon: ChartNoAxesCombined,
    label: 'نرخ تبدیل کارشناس',
    className:
      'bg-violet-50 text-violet-700 ring-violet-100 dark:bg-violet-950/50 dark:text-violet-200 dark:ring-violet-900',
  },
  'employee-average-sale': {
    icon: BadgeDollarSign,
    label: 'میانگین فروش کارشناس',
    className:
      'bg-teal-50 text-teal-700 ring-teal-100 dark:bg-teal-950/50 dark:text-teal-200 dark:ring-teal-900',
  },
  'employee-contract-count': {
    icon: BriefcaseBusiness,
    label: 'قراردادهای کارشناس',
    className:
      'bg-indigo-50 text-indigo-700 ring-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-200 dark:ring-indigo-900',
  },
  'employee-followup-count': {
    icon: CalendarCheck,
    label: 'پیگیری فروش',
    className:
      'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-900',
  },
  'employee-sales-rank': {
    icon: Gauge,
    label: 'رتبه عملکرد',
    className:
      'bg-indigo-50 text-indigo-700 ring-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-200 dark:ring-indigo-900',
  },
  'tour-reservations': {
    icon: Ticket,
    label: 'رزرو تور',
    className:
      'bg-orange-50 text-orange-700 ring-orange-100 dark:bg-orange-950/50 dark:text-orange-200 dark:ring-orange-900',
  },
  'hotel-reservations': {
    icon: Hotel,
    label: 'رزرو هتل',
    className:
      'bg-sky-50 text-sky-700 ring-sky-100 dark:bg-sky-950/50 dark:text-sky-200 dark:ring-sky-900',
  },
  'average-ticket-price': {
    icon: Ticket,
    label: 'متوسط قیمت بلیت',
    className:
      'bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-950/50 dark:text-blue-200 dark:ring-blue-900',
  },
  'remaining-capacity': {
    icon: Gauge,
    label: 'ظرفیت باقی‌مانده',
    className:
      'bg-orange-50 text-orange-700 ring-orange-100 dark:bg-orange-950/50 dark:text-orange-200 dark:ring-orange-900',
  },
  'collection-rate': {
    icon: CircleCheckBig,
    label: 'نرخ وصول',
    className:
      'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-900',
  },
  'lead-conversion-rate': {
    icon: ChartNoAxesCombined,
    label: 'نرخ تبدیل لید',
    className:
      'bg-violet-50 text-violet-700 ring-violet-100 dark:bg-violet-950/50 dark:text-violet-200 dark:ring-violet-900',
  },
};

function kpiVisualFor(definition: DashboardKpiDefinition): KpiVisual {
  return (
    kpiVisualOverrides[definition.id] ??
    kpiVisualMatchers.find(([pattern]) => pattern.test(definition.id))?.[1] ??
    {
      icon: CircleDollarSign,
      label: 'شاخص عملکرد',
      className:
        'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700',
    }
  );
}

const chartPalette = [
  '#1e3a8a',
  '#2563eb',
  '#0f766e',
  '#7c3aed',
  '#d97706',
  '#e11d48',
] as const;

function compactChartValue(value: number) {
  return Intl.NumberFormat('fa-IR', {
    notation: Math.abs(value) >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value);
}

export function dashboardVisualKindForData(
  kind: DashboardVisualKind,
  values: readonly number[],
): DashboardVisualKind {
  if (
    kind === 'donut' &&
    (values.length < 2 ||
      values.length > 6 ||
      values.some((value) => value < 0) ||
      values.reduce((sum, value) => sum + value, 0) <= 0)
  )
    return 'bar';
  return kind;
}

function kpiGridColumns(count: number) {
  if (count <= 1) return 'lg:grid-cols-1';
  if (count === 2) return 'sm:grid-cols-2';
  if (count === 3) return 'sm:grid-cols-2 lg:grid-cols-3';
  if (count === 4) return 'sm:grid-cols-2 xl:grid-cols-4';
  if (count === 5) return 'sm:grid-cols-2 xl:grid-cols-5';
  if (count === 6)
    return 'sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6';
  if (count % 2 === 0) return 'sm:grid-cols-2 xl:grid-cols-4';
  return 'sm:grid-cols-2 xl:grid-flow-col xl:auto-cols-[minmax(13rem,1fr)] xl:overflow-x-auto';
}

function visualKindNeedsFullWidth(kind: DashboardVisualKind) {
  return kind === 'line' || kind === 'table' || kind === 'queue';
}

function dashboardVisualIsWide(
  visualizations: readonly { kind: DashboardVisualKind }[],
  index: number,
) {
  const visualization = visualizations[index];
  if (!visualization || visualKindNeedsFullWidth(visualization.kind))
    return true;

  let runStart = index;
  while (
    runStart > 0 &&
    !visualKindNeedsFullWidth(visualizations[runStart - 1]!.kind)
  )
    runStart -= 1;

  let runEnd = index;
  while (
    runEnd + 1 < visualizations.length &&
    !visualKindNeedsFullWidth(visualizations[runEnd + 1]!.kind)
  )
    runEnd += 1;

  return (runEnd - runStart + 1) % 2 === 1 && index === runEnd;
}

const navigationIcons: Record<string, LucideIcon> = {
  'executive-overview': LayoutDashboard,
  'commercial-performance': BriefcaseBusiness,
  'finance-treasury': WalletCards,
  'customer-growth': UsersRound,
  'workforce-hr': UserRoundCog,
};

function Metric({
  compact = false,
  currency = false,
  metric,
}: {
  compact?: boolean;
  currency?: boolean;
  metric?: DashboardMetricSnapshot | undefined;
}) {
  const currencyValues = currency && metric?.value.includes(' · ')
    ? metric.value.split(' · ')
    : null;
  return (
    <div
      className={cn(
        'flex w-full min-w-0 justify-center gap-2 text-center',
        currencyValues ? 'flex-col items-center' : 'flex-wrap items-end',
        compact ? 'mt-2' : 'mt-4',
      )}
    >
      {currencyValues ? (
        <span className="flex min-w-0 flex-col items-center gap-1 font-black tabular-nums tracking-tight text-foreground">
          {currencyValues.map((value) => (
            <bdi dir="ltr" className="max-w-full break-words text-lg leading-6" key={value}>
              {value}
            </bdi>
          ))}
        </span>
      ) : (
        <span
          className={cn(
            'font-black tracking-tight text-foreground',
            compact ? 'text-xl' : 'text-2xl',
          )}
          aria-label={metric ? metric.value : 'داده‌ای دریافت نشده'}
        >
          {metric?.value ?? '—'}
        </span>
      )}
    </div>
  );
}

const currencySymbols: Readonly<Record<string, string>> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  AED: 'د.إ',
  TRY: '₺',
  IRR: '﷼',
  IRI: '﷼',
};

const currencyNames: Readonly<Record<string, string>> = {
  USD: 'دلار آمریکا',
  EUR: 'یورو',
  GBP: 'پوند بریتانیا',
  AED: 'درهم امارات',
  TRY: 'لیر ترکیه',
  IRR: 'ریال ایران',
  IRI: 'ریال ایران',
};

const trendPalette = [
  'text-blue-600 dark:text-blue-400',
  'text-violet-600 dark:text-violet-400',
  'text-emerald-600 dark:text-emerald-400',
  'text-amber-600 dark:text-amber-400',
] as const;

const trendDotPalette = [
  'bg-blue-600 dark:bg-blue-400',
  'bg-violet-600 dark:bg-violet-400',
  'bg-emerald-600 dark:bg-emerald-400',
  'bg-amber-600 dark:bg-amber-400',
] as const;

function MiniTrend({
  title,
  trend,
}: {
  title: string;
  trend: DashboardTrendSnapshot;
}) {
  const series =
    trend.series?.length
      ? trend.series
      : [{ currencyCode: '', values: trend.values }];
  const pointsFor = (values: readonly number[]) => {
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const span = Math.max(maximum - minimum, 1);
    return values.map((value, index) => ({
      x: values.length > 1 ? 3 + (index * 90) / (values.length - 1) : 48,
      y: 29 - ((value - minimum) / span) * 24,
    }));
  };
  const renderedSeries = series.map((item) => ({
    ...item,
    points: pointsFor(item.values),
  }));
  const summary = renderedSeries
    .map(({ currencyCode, values }) =>
      values
        .map(
          (value, index) =>
            `${currencyCode ? `${currencySymbols[currencyCode] ?? currencyCode} ` : ''}${trend.labels[index] ?? index + 1}: ${value.toLocaleString('fa-IR')}`,
        )
        .join('، '),
    )
    .join('؛ ');

  return (
    <span className="flex min-w-0 flex-1 flex-col gap-1.5">
      <svg
        aria-label={`روند ${title}. هر خط در مقیاس مستقل همان ارز نمایش داده می‌شود. ${summary}`}
        className="h-9 w-full overflow-visible"
        role="img"
        viewBox="0 0 96 34"
      >
        {renderedSeries.map(({ currencyCode, points }, seriesIndex) => (
          <g
            className={trendPalette[seriesIndex % trendPalette.length]}
            key={currencyCode || 'default'}
          >
            <polyline
              fill="none"
              points={points.map(({ x, y }) => `${x},${y}`).join(' ')}
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.25"
            />
            {points.map(({ x, y }, index) => (
              <circle
                aria-hidden="true"
                cx={x}
                cy={y}
                fill="currentColor"
                key={`${currencyCode}-${x}-${y}-${index}`}
                r="1.5"
              />
            ))}
          </g>
        ))}
      </svg>
      {renderedSeries.length > 1 ? (
        <span aria-label="راهنمای روند ارزها" className="flex flex-wrap justify-center gap-x-2 gap-y-1 text-[10px] font-bold text-muted-foreground">
          {renderedSeries.map(({ currencyCode }, index) => (
            <span className="inline-flex items-center gap-1" key={currencyCode} title={currencyNames[currencyCode] ?? currencyCode}>
              <i aria-hidden="true" className={cn('size-1.5 rounded-full', trendDotPalette[index % trendDotPalette.length])} />
              <bdi dir="ltr">{currencySymbols[currencyCode] ?? currencyCode}</bdi>
            </span>
          ))}
        </span>
      ) : null}
    </span>
  );
}

function GrowthIndicator({
  comparison,
  role = 'diagnostic',
}: {
  comparison: DashboardComparisonSnapshot;
  role?: DashboardKpiRole;
}) {
  const favorable =
    role === 'diagnostic' || comparison.direction === 'flat'
      ? null
      : role === 'guardrail'
        ? comparison.direction === 'down'
        : comparison.direction === 'up';
  const Icon =
    comparison.direction === 'up'
      ? ArrowUpRight
      : comparison.direction === 'down'
        ? ArrowDownRight
        : Minus;
  const value =
    comparison.deltaPercent === null
      ? 'مبنای قبلی صفر'
      : `${Math.abs(comparison.deltaPercent).toLocaleString('fa-IR', {
          maximumFractionDigits: 1,
        })}٪`;

  return (
    <span
      className={cn(
        'inline-flex min-h-7 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black',
        favorable === true &&
          'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/45 dark:text-emerald-200',
        favorable === false &&
          'bg-rose-50 text-rose-700 dark:bg-rose-950/45 dark:text-rose-200',
        favorable === null &&
          'bg-blue-50 text-blue-700 dark:bg-blue-950/45 dark:text-blue-200',
      )}
      title={`${comparison.label} · مقدار قبلی ${comparison.previousValue.toLocaleString('fa-IR')}`}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      <span>{value}</span>
      <span className="font-semibold opacity-80">نسبت به دوره قبل</span>
    </span>
  );
}

function KpiCard({
  definition,
  selected,
  onSelect,
  featured = false,
  metric,
}: {
  definition: DashboardKpiDefinition;
  selected: boolean;
  onSelect(): void;
  featured?: boolean;
  metric?: DashboardMetricSnapshot | undefined;
}) {
  const visual = kpiVisualFor(definition);
  const Icon = visual.icon;
  return (
    <button
      data-dashboard-kpi
      aria-controls="kpi-definition-panel"
      aria-expanded={selected}
      aria-haspopup="dialog"
      className={cn(
        'group relative min-h-32 min-w-0 overflow-hidden rounded-2xl border bg-surface p-3 text-start shadow-sm outline-none transition duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        selected ? 'border-primary ring-2 ring-primary/15' : 'border-border',
        featured &&
          'bg-gradient-to-bl from-blue-50/60 via-surface to-surface dark:from-blue-950/20',
      )}
      onClick={onSelect}
      type="button"
    >
      <span aria-hidden="true" className="absolute inset-x-5 top-0 h-0.5 rounded-b-full bg-primary/70" />
      <span aria-hidden="true" className="absolute -start-8 -top-10 size-28 rounded-full bg-primary/[0.045] blur-2xl transition group-hover:bg-primary/[0.08]" />
      <span className="relative flex min-w-0 items-center gap-2.5">
        <span
          aria-label={visual.label}
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-xl shadow-sm ring-1',
            visual.className,
          )}
          title={visual.label}
          role="img"
        >
          <Icon aria-hidden="true" className="size-[18px]" />
        </span>
        <span className="min-w-0 truncate text-sm font-black text-foreground" title={definition.title}>
          {definition.title}
        </span>
      </span>
      <span className="relative block text-center">
        <Metric compact currency={definition.currency === 'required'} metric={metric} />
      </span>
      {metric ? (
        <span className="relative mt-2 flex min-h-11 flex-col gap-2 border-t border-border/60 pt-2">
          {metric.comparison ? (
            <GrowthIndicator
              comparison={metric.comparison}
              role={definition.role}
            />
          ) : (
            <span className="text-[10px] font-semibold text-muted-foreground">
              {metric.trend
                ? 'هر ارز مستقل و بدون تبدیل نمایش داده می‌شود'
                : 'دادهٔ دورهٔ قبل موجود نیست'}
            </span>
          )}
          {metric.trend ? (
            <MiniTrend title={definition.title} trend={metric.trend} />
          ) : null}
        </span>
      ) : null}
    </button>
  );
}

function KpiDefinitionPanel({
  definition,
  onClose,
}: {
  definition: DashboardKpiDefinition;
  onClose(): void;
}) {
  const report = reportCatalog.find(
    (candidate) => candidate.displayCode === definition.reportCode,
  );
  const reportHref = report
    ? `/reports?report=${encodeURIComponent(report.code)}`
    : '/reports';

  return (
    <Drawer
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DrawerContent
        aria-describedby={`kpi-definition-description-${definition.id}`}
        className="w-[min(94vw,38rem)] p-0"
        dir="rtl"
        id="kpi-definition-panel"
        style={{ left: 'auto', right: 0 }}
      >
        <div className="flex min-h-full flex-col">
          <header className="border-b border-border bg-surface px-5 py-4">
            <div className="flex items-start justify-between gap-4 pe-1">
              <div className="min-w-0">
                <p className="text-xs font-bold text-primary">
                  تعریف قابل ممیزی KPI
                </p>
                <DialogTitle className="mt-1 text-xl font-black">
                  {definition.title}
                </DialogTitle>
                <DialogDescription
                  className="mt-1 break-words text-xs leading-6"
                  dir="ltr"
                  id={`kpi-definition-description-${definition.id}`}
                >
                  {definition.technicalName}
                </DialogDescription>
              </div>
              <DrawerClose asChild>
                <Button
                  aria-label="بستن پنل تعریف شاخص"
                  size="sm"
                  variant="ghost"
                >
                  بستن
                </Button>
              </DrawerClose>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge dir="ltr">KPI ID: {definition.id}</Badge>
              <Badge>{kpiRoleLabels[definition.role]}</Badge>
              <Badge dir="ltr">{definition.reportCode}</Badge>
            </div>
          </header>

          <div className="flex-1 space-y-4 overflow-y-auto p-5 text-sm">
            <section aria-labelledby="kpi-business-definition-title">
              <h3
                className="text-sm font-black text-foreground"
                id="kpi-business-definition-title"
              >
                تعریف و هدف کسب‌وکار
              </h3>
              <p className="mt-2 leading-7 text-muted-foreground">
                این شاخص نشان می‌دهد «{definition.title}» در بازه و فیلترهای
                انتخاب‌شده چه وضعیتی دارد. از آن برای بررسی سریع عملکرد و تشخیص
                موارد نیازمند پیگیری استفاده می‌شود.
              </p>
              <p className="mt-3 leading-7 text-muted-foreground">
                این شاخص برای پاسخ به این تصمیم استفاده می‌شود:{' '}
                <span className="font-semibold text-foreground">
                  {definition.decision}
                </span>
              </p>
            </section>

            <section
              aria-labelledby="kpi-calculation-title"
              className="rounded-2xl border border-primary/20 bg-primary/[0.035] p-4"
            >
              <h3
                className="text-sm font-black text-foreground"
                id="kpi-calculation-title"
              >
                فرمول و قاعده محاسبه
              </h3>
              <p className="mt-2 leading-7">{definition.rule}</p>
            </section>

            <section aria-labelledby="kpi-data-lineage-title">
              <h3
                className="text-sm font-black text-foreground"
                id="kpi-data-lineage-title"
              >
                فیچرها و منابع داده
              </h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {definition.source.map((source) => (
                  <Badge
                    className="max-w-full break-all font-mono text-[11px]"
                    dir="ltr"
                    key={source}
                  >
                    {source}
                  </Badge>
                ))}
              </div>
            </section>

            <section
              aria-labelledby="kpi-exclusions-title"
              className="rounded-2xl bg-amber-50 p-4 dark:bg-amber-950/30"
            >
              <h3
                className="text-sm font-black text-amber-900 dark:text-amber-100"
                id="kpi-exclusions-title"
              >
                حذف‌ها و محدودیت‌های محاسبه
              </h3>
              <p className="mt-2 leading-7 text-amber-900/80 dark:text-amber-100/80">
                {definition.exclusions}
              </p>
            </section>

            <section aria-labelledby="kpi-governance-title">
              <h3
                className="text-sm font-black text-foreground"
                id="kpi-governance-title"
              >
                حاکمیت و ردگیری
              </h3>
              <dl className="mt-2 grid gap-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl bg-muted/50 p-3">
                  <dt className="text-xs font-bold text-muted-foreground">
                    مجوز مشاهده
                  </dt>
                  <dd className="break-all font-mono text-xs" dir="ltr">
                    {definition.permission}
                  </dd>
                </div>
                {definition.openDecision ? (
                  <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl bg-muted/50 p-3">
                    <dt className="text-xs font-bold text-muted-foreground">
                      تصمیم باز وابسته
                    </dt>
                    <dd className="font-mono text-xs" dir="ltr">
                      {definition.openDecision}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </section>
          </div>

          <footer className="border-t border-border bg-surface p-4">
            {report ? (
              <Button asChild className="w-full" size="sm">
                <Link href={reportHref}>
                  رفتن به فرم پیکربندی گزارش مرتبط
                  <ArrowUpRight aria-hidden="true" className="size-3.5" />
                </Link>
              </Button>
            ) : (
              <Button className="w-full" disabled size="sm" variant="outline">
                گزارش مرتبط در کاتالوگ موجود نیست
              </Button>
            )}
          </footer>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function DimensionFilter({
  allLabel,
  id,
  label,
  value,
  options,
  loading,
  onChange,
}: {
  allLabel: string;
  id: string;
  label: string;
  value: string | null;
  options: readonly string[];
  loading: boolean;
  onChange(value: string | null): void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const availableOptions = [
    ...new Set([...(value ? [value] : []), ...options]),
  ];
  const normalizedQuery = query.trim().toLocaleLowerCase('fa');
  const visibleOptions = availableOptions.filter((option) =>
    option.toLocaleLowerCase('fa').includes(normalizedQuery),
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
          className="flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-input bg-surface px-3 text-sm text-foreground outline-none transition hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          id={id}
          onClick={() => {
            setOpen((current) => !current);
            setQuery('');
          }}
          type="button"
        >
          <span className="truncate">{value ?? allLabel}</span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'size-4 shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-180',
            )}
          />
        </button>
        {open ? (
          <div className="absolute inset-x-0 top-[calc(100%+0.35rem)] z-[80] rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-xl">
            <div className="relative">
              <Search
                aria-hidden="true"
                className="absolute end-3 top-2.5 size-4 text-muted-foreground"
              />
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
              {[allLabel, ...visibleOptions].map((option, index) => {
                const optionValue = index === 0 ? null : option;
                const selected = value === optionValue;
                return (
                  <button
                    aria-selected={selected}
                    className="flex min-h-9 w-full items-center justify-between rounded-lg px-3 py-2 text-start text-sm outline-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-primary/40"
                    key={optionValue ?? 'all'}
                    onClick={() => {
                      onChange(optionValue);
                      setOpen(false);
                      setQuery('');
                    }}
                    role="option"
                    type="button"
                  >
                    <span className="truncate" dir="auto">
                      {option}
                    </span>
                    {selected ? (
                      <Check aria-hidden="true" className="size-4 text-primary" />
                    ) : null}
                  </button>
                );
              })}
              {visibleOptions.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs leading-5 text-muted-foreground">
                  {loading
                    ? 'در حال دریافت گزینه‌های فیلتر…'
                    : normalizedQuery
                      ? 'گزینه‌ای پیدا نشد.'
                      : 'گزینه‌ای برای این فیلتر منتشر نشده است.'}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </FormField>
  );
}

function EmptyVisualCanvas({ kind }: { kind: DashboardVisualKind }) {
  if (kind === 'table' || kind === 'queue') {
    return (
      <div
        aria-label={`نمای خالی ${visualLabels[kind]}`}
        className="overflow-hidden rounded-xl border border-border/80 bg-muted/[0.18]"
      >
        <div className="grid grid-cols-4 gap-3 border-b border-border/80 bg-muted/45 px-4 py-2.5">
          {[0, 1, 2, 3].map((item) => (
            <span
              className="h-2 rounded-full bg-muted-foreground/15"
              key={item}
            />
          ))}
        </div>
        <div className="space-y-3 px-4 py-4" aria-hidden="true">
          {[0, 1, 2].map((item) => (
            <div className="grid grid-cols-4 gap-3" key={item}>
              <span className="col-span-2 h-2.5 rounded-full bg-muted-foreground/10" />
              <span className="h-2.5 rounded-full bg-muted-foreground/10" />
              <span className="h-2.5 rounded-full bg-muted-foreground/10" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (kind === 'funnel') {
    return (
      <div
        aria-label="نمای خالی قیف تصمیم"
        className="grid min-h-36 place-items-center rounded-xl border border-border/80 bg-muted/[0.18] p-4"
      >
        <div aria-hidden="true" className="w-full max-w-sm space-y-2">
          <span className="mx-auto block h-8 w-full rounded-lg bg-blue-100/80 dark:bg-blue-950/40" />
          <span className="mx-auto block h-8 w-4/5 rounded-lg bg-blue-100/60 dark:bg-blue-950/30" />
          <span className="mx-auto block h-8 w-3/5 rounded-lg bg-blue-100/40 dark:bg-blue-950/20" />
          <span className="mx-auto block h-8 w-2/5 rounded-lg bg-blue-100/25 dark:bg-blue-950/10" />
        </div>
      </div>
    );
  }

  if (kind === 'donut') {
    return (
      <div
        aria-label="نمای خالی نمودار سهم"
        className="grid min-h-36 place-items-center rounded-xl border border-border/80 bg-muted/[0.18]"
      >
        <span
          aria-hidden="true"
          className="size-28 rounded-full border-[22px] border-blue-100 dark:border-blue-950"
        />
      </div>
    );
  }

  return (
    <div
      aria-label={`نمای خالی ${visualLabels[kind]}`}
      className="relative min-h-36 overflow-hidden rounded-xl border border-border/80 bg-[linear-gradient(to_bottom,transparent_24%,hsl(var(--border)/0.55)_25%,transparent_26%,transparent_49%,hsl(var(--border)/0.55)_50%,transparent_51%,transparent_74%,hsl(var(--border)/0.55)_75%,transparent_76%)]"
    >
      <span className="absolute inset-y-4 right-9 border-r border-border/80" />
      <span className="absolute inset-x-4 bottom-9 border-t border-border/80" />
      {kind === 'bar' || kind === 'stacked-bar' ? (
        <div
          aria-hidden="true"
          className="absolute inset-x-14 bottom-10 flex h-20 items-end justify-between gap-3 opacity-35"
        >
          {[45, 70, 55, 82, 62, 38].map((height, item) => (
            <span
              className="w-full rounded-t-md bg-blue-200 dark:bg-blue-900"
              key={item}
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function VisualDataSummary({
  labels,
  title,
  values,
}: {
  labels: readonly string[];
  title: string;
  values: readonly number[];
}) {
  return (
    <details className="mt-3 rounded-xl border border-border bg-surface">
      <summary className="cursor-pointer rounded-xl px-3 py-2 text-xs font-bold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background">
        خلاصه متنی و جدول داده
      </summary>
      <div className="overflow-x-auto border-t border-border">
        <table className="w-full min-w-72 text-xs">
          <caption className="sr-only">داده‌های نمودار {title}</caption>
          <thead className="bg-muted/60 text-foreground">
            <tr>
              <th className="px-3 py-2 text-start" scope="col">دسته</th>
              <th className="px-3 py-2 text-end" scope="col">مقدار</th>
            </tr>
          </thead>
          <tbody>
            {values.map((value, index) => (
              <tr className="border-t border-border/70" key={`${labels[index]}-${index}`}>
                <th className="px-3 py-2 text-start font-medium" scope="row">
                  {labels[index] ?? `دسته ${index + 1}`}
                </th>
                <td className="px-3 py-2 text-end font-bold tabular-nums">
                  {value.toLocaleString('fa-IR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function OperationalDataTable({
  kind,
  labels,
  title,
  values,
}: {
  kind: 'table' | 'queue';
  labels: readonly string[];
  title: string;
  values: readonly number[];
}) {
  const maximum = Math.max(...values, 1);
  const total = values.reduce((sum, value) => sum + value, 0);
  return (
    <div className="max-h-80 overflow-auto rounded-xl border border-border/80 bg-surface shadow-inner shadow-slate-100/50 dark:shadow-none">
      <table className="w-full min-w-[34rem] text-xs">
        <caption className="sr-only">{visualLabels[kind]} {title}</caption>
        <thead className="bg-slate-100/95 text-foreground dark:bg-slate-900/95">
          <tr>
            <th className="w-10 px-3 py-2.5 text-center" scope="col">#</th>
            <th className="px-3 py-2.5 text-start" scope="col">عنوان</th>
            <th className="px-3 py-2.5 text-end" scope="col">مقدار</th>
            <th className="w-40 px-3 py-2.5 text-start" scope="col">سهم مقایسه‌ای</th>
          </tr>
        </thead>
        <tbody>
          {labels.slice(0, 10).map((label, index) => (
            <tr
              className="border-t border-border/70 transition-colors odd:bg-surface even:bg-muted/20 hover:bg-blue-50/60 dark:hover:bg-blue-950/20"
              key={`${label}-${index}`}
            >
              <td className="px-3 py-2.5 text-center font-semibold text-muted-foreground">
                {(index + 1).toLocaleString('fa-IR')}
                <span
                  aria-hidden="true"
                  className={cn(
                    'mx-auto mt-1 block size-1.5 rounded-full',
                    kind === 'queue' ? 'bg-amber-500' : 'bg-primary',
                  )}
                />
              </td>
              <th className="px-3 py-2.5 text-start font-semibold" scope="row">
                {label}
              </th>
              <td className="px-3 py-2.5 text-end font-black tabular-nums">
                {values[index]?.toLocaleString('fa-IR')}
              </td>
              <td className="px-3 py-2.5">
                <span className="block h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'block h-full rounded-full',
                      kind === 'queue'
                        ? 'bg-gradient-to-l from-amber-400 to-orange-500'
                        : 'bg-gradient-to-l from-blue-500 to-indigo-700',
                    )}
                    style={{
                      width: `${Math.max(3, ((values[index] ?? 0) / maximum) * 100)}%`,
                    }}
                  />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-border bg-slate-50/95 font-black dark:bg-slate-950/95">
          <tr>
            <td className="px-3 py-2.5" />
            <th className="px-3 py-2.5 text-start" scope="row">جمع نمایش‌داده‌شده</th>
            <td className="px-3 py-2.5 text-end tabular-nums">{total.toLocaleString('fa-IR')}</td>
            <td className="px-3 py-2.5" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function EmployeePerformanceBars({
  labels,
  title,
  values,
}: {
  labels: readonly string[];
  title: string;
  values: readonly number[];
}) {
  const maximum = Math.max(...values, 1);
  const accessibleSummary = values
    .map(
      (value, index) =>
        `${labels[index] ?? `کارشناس ${index + 1}`}: ${value.toLocaleString('fa-IR')}`,
    )
    .join('، ');

  return (
    <figure
      aria-label={`مقایسه عملکرد تیم برای ${title}. ${accessibleSummary}`}
      className="rounded-xl border border-border/80 bg-muted/[0.14] p-3"
      role="img"
    >
      <div className="mb-3 flex items-center justify-between gap-3 text-[10px] font-semibold text-muted-foreground">
        <span>کارشناس</span>
        <span>مقیاس نوار: بیشترین مقدار</span>
      </div>
      <div className="space-y-3">
        {values.slice(0, 6).map((value, index) => {
          const label = labels[index] ?? `کارشناس ${index + 1}`;
          return (
            <div className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2.5" key={`${label}-${index}`}>
              <span
                aria-hidden="true"
                className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-cyan-100 to-blue-100 text-[10px] font-black text-blue-800 ring-1 ring-blue-200 dark:from-cyan-950 dark:to-blue-950 dark:text-blue-100 dark:ring-blue-800"
              >
                {label.trim().slice(0, 2)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-bold text-foreground" title={label}>
                  {label}
                </span>
                <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <span
                    aria-hidden="true"
                    className="block h-full rounded-full bg-gradient-to-l from-cyan-500 to-blue-600"
                    style={{ width: `${Math.max(4, (value / maximum) * 100)}%` }}
                  />
                </span>
              </span>
              <strong className="min-w-12 text-end text-xs tabular-nums text-foreground">
                {value.toLocaleString('fa-IR')}
              </strong>
            </div>
          );
        })}
      </div>
      <figcaption className="sr-only">{accessibleSummary}</figcaption>
    </figure>
  );
}

function DashboardChart({
  kind,
  labels,
  title,
  values,
}: {
  kind: DashboardVisualKind;
  labels: readonly string[];
  title: string;
  values: readonly number[];
}) {
  const lineAreaId = useId().replace(/:/g, '');
  const resolvedKind = dashboardVisualKindForData(kind, values);
  const maximum = Math.max(...values, 1);
  const total = values.reduce((sum, value) => sum + value, 0);
  const accessibleSummary = values
    .map(
      (value, index) =>
        `${labels[index] ?? `دسته ${index + 1}`}: ${value.toLocaleString('fa-IR')}`,
    )
    .join('، ');

  if (resolvedKind === 'line') {
    const points = values.map((value, index) => ({
      x: values.length > 1 ? 24 + (index * 552) / (values.length - 1) : 300,
      y: 156 - (value / maximum) * 124,
    }));
    return (
      <figure
        aria-label={`${visualLabels[resolvedKind]} ${title}. ${accessibleSummary}`}
        className="rounded-xl border border-border/80 bg-muted/[0.18] p-3"
        role="img"
      >
        <svg aria-hidden="true" className="h-36 w-full" viewBox="0 0 600 180">
          <defs>
            <linearGradient id={lineAreaId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.24" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[32, 73, 114, 156].map((y) => (
            <line key={y} stroke="currentColor" className="text-border" x1="24" x2="576" y1={y} y2={y} />
          ))}
          <polygon
            className="text-primary"
            fill={`url(#${lineAreaId})`}
            points={`24,156 ${points.map(({ x, y }) => `${x},${y}`).join(' ')} 576,156`}
          />
          <polyline
            fill="none"
            points={points.map(({ x, y }) => `${x},${y}`).join(' ')}
            stroke="currentColor"
            className="text-primary"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="4"
          />
          {points.map(({ x, y }, index) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} fill="currentColor" className="text-primary" r="5">
              <title>{`${labels[index]}: ${values[index]?.toLocaleString('fa-IR')}`}</title>
            </circle>
          ))}
        </svg>
        <div aria-hidden="true" className="flex justify-between gap-2 text-[10px] font-semibold text-muted-foreground">
          {labels.map((label, index) => (
            <span className="min-w-0 flex-1 truncate text-center" key={`${label}-${index}`} title={label}>{label}</span>
          ))}
        </div>
        <figcaption className="sr-only">{accessibleSummary}</figcaption>
      </figure>
    );
  }

  if (resolvedKind === 'stacked-bar') {
    const visibleValues = values.slice(0, 8);
    const visibleLabels = labels.slice(0, 8);
    const comboMaximum = Math.max(...visibleValues, 1);
    const slotWidth = 528 / Math.max(visibleValues.length, 1);
    const rollingAverage = visibleValues.map((value, index) => {
      const start = Math.max(0, index - 1);
      const window = visibleValues.slice(start, index + 1);
      return window.reduce((sum, item) => sum + item, 0) / window.length;
    });
    const linePoints = rollingAverage.map((value, index) => ({
      x: 48 + slotWidth * index + slotWidth / 2,
      y: 154 - (value / comboMaximum) * 118,
    }));

    return (
      <figure
        aria-label={`نمودار ترکیبی ${title}. ستون‌ها مقدار هر دسته و خط، میانگین متحرک را نشان می‌دهد. ${accessibleSummary}`}
        className="rounded-xl border border-border/80 bg-muted/[0.12] p-3"
        role="img"
      >
        <div aria-hidden="true" className="mb-2 flex flex-wrap items-center gap-4 text-[10px] font-bold text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-blue-700" />مقدار</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-0.5 w-4 bg-amber-500" />میانگین روند</span>
        </div>
        <svg aria-hidden="true" className="h-48 w-full" viewBox="0 0 600 205">
          {[36, 75, 114, 154].map((y, index) => (
            <g key={y}>
              <line className="text-border" stroke="currentColor" strokeDasharray="4 5" x1="42" x2="582" y1={y} y2={y} />
              <text className="fill-muted-foreground text-[9px]" x="36" y={y + 3} textAnchor="end">
                {compactChartValue(comboMaximum * (1 - index / 3))}
              </text>
            </g>
          ))}
          {visibleValues.map((value, index) => {
            const height = Math.max(4, (value / comboMaximum) * 118);
            const width = Math.min(42, slotWidth * 0.58);
            const x = 48 + slotWidth * index + (slotWidth - width) / 2;
            return (
              <g key={`${visibleLabels[index]}-${index}`}>
                <rect fill={index === 0 ? '#1e3a8a' : '#93a4c7'} height={height} rx="4" width={width} x={x} y={154 - height}>
                  <title>{`${visibleLabels[index]}: ${value.toLocaleString('fa-IR')}`}</title>
                </rect>
                <text className="fill-muted-foreground text-[9px]" textAnchor="middle" x={x + width / 2} y="176">
                  {(visibleLabels[index] ?? '').slice(0, 10)}
                </text>
              </g>
            );
          })}
          <polyline
            fill="none"
            points={linePoints.map(({ x, y }) => `${x},${y}`).join(' ')}
            stroke="#d97706"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />
          {linePoints.map(({ x, y }, index) => (
            <circle cx={x} cy={y} fill="#fff" key={`${x}-${y}`} r="4" stroke="#d97706" strokeWidth="2">
              <title>{`میانگین روند: ${rollingAverage[index]?.toLocaleString('fa-IR', { maximumFractionDigits: 1 })}`}</title>
            </circle>
          ))}
        </svg>
        <figcaption className="sr-only">{accessibleSummary}</figcaption>
      </figure>
    );
  }

  if (resolvedKind === 'donut') {
    const segments = values.map((value, index) => {
      const start =
        (values.slice(0, index).reduce((sum, item) => sum + item, 0) /
          total) *
        100;
      const end = start + (value / total) * 100;
      return `${chartPalette[index % chartPalette.length]} ${start}% ${end}%`;
    });
    return (
      <figure
        aria-label={`${visualLabels[resolvedKind]} ${title}. ${accessibleSummary}`}
        className="grid min-h-52 gap-4 rounded-xl border border-border/80 bg-muted/[0.12] p-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-center"
        role="img"
      >
        <div
          aria-hidden="true"
          className="mx-auto grid size-40 place-items-center rounded-full shadow-sm"
          style={{ background: `conic-gradient(${segments.join(', ')})` }}
        >
          <span className="grid size-24 place-items-center rounded-full bg-surface text-center text-foreground shadow-sm ring-1 ring-border/70">
            <span><b className="block text-lg font-black tabular-nums">{compactChartValue(total)}</b><small className="mt-0.5 block text-[10px] font-bold text-muted-foreground">مجموع</small></span>
          </span>
        </div>
        <ul aria-hidden="true" className="grid gap-2 sm:grid-cols-2">
          {values.map((value, index) => (
            <li className="rounded-lg border border-border/70 bg-surface px-2.5 py-2 text-xs" key={`${labels[index]}-${index}`}>
              <span className="flex items-center gap-2">
                <span className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: chartPalette[index % chartPalette.length] }} />
                <span className="min-w-0 flex-1 truncate font-semibold">{labels[index]}</span>
                <span className="font-black tabular-nums">{Math.round((value / total) * 100).toLocaleString('fa-IR')}٪</span>
              </span>
              <span className="mt-1 block ps-5 text-[10px] font-semibold tabular-nums text-muted-foreground">{value.toLocaleString('fa-IR')}</span>
            </li>
          ))}
        </ul>
        <figcaption className="sr-only">{accessibleSummary}</figcaption>
      </figure>
    );
  }

  if (resolvedKind === 'funnel') {
    return (
      <figure aria-label={`قیف ${title}. ${accessibleSummary}`} className="space-y-2 rounded-xl border border-border/80 bg-muted/[0.18] p-4" role="img">
        {values.map((value, index) => (
          <div
            aria-hidden="true"
            className="mx-auto flex min-h-9 items-center justify-between rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground"
            key={`${labels[index]}-${index}`}
            style={{ width: `${Math.max(36, (value / maximum) * 100)}%` }}
          >
            <span className="truncate">{labels[index]}</span>
            <span>{value.toLocaleString('fa-IR')}</span>
          </div>
        ))}
        <figcaption className="sr-only">{accessibleSummary}</figcaption>
      </figure>
    );
  }

  const rankedRows = values
    .map((value, index) => ({ label: labels[index] ?? `دسته ${index + 1}`, value, index }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 12);
  return (
    <figure
      aria-label={`${visualLabels[resolvedKind]} ${title}. ${accessibleSummary}`}
      className="max-h-80 overflow-y-auto rounded-xl border border-border/80 bg-muted/[0.12] p-3"
      role="img"
    >
      <div className="space-y-2.5">
        {rankedRows.map(({ label, value, index }, rank) => (
          <div aria-hidden="true" className="grid grid-cols-[minmax(6rem,0.8fr)_minmax(8rem,2fr)_auto] items-center gap-2.5" key={`${label}-${index}`}>
            <span className="truncate text-[11px] font-bold" title={label}>{label}</span>
            <span className="relative block h-5 overflow-hidden rounded-md bg-slate-200/80 dark:bg-slate-700/80">
              <span
                className="absolute inset-y-0 start-0 rounded-md bg-gradient-to-l from-indigo-500 to-blue-800"
                style={{
                  opacity: Math.max(0.45, 1 - rank * 0.06),
                  width: `${Math.max(2, (value / maximum) * 100)}%`,
                }}
              />
            </span>
            <strong className="min-w-14 text-end text-[11px] tabular-nums text-foreground">{compactChartValue(value)}</strong>
          </div>
        ))}
      </div>
      <figcaption className="sr-only">{accessibleSummary}</figcaption>
    </figure>
  );
}

function ProjectionSlot({
  visualId,
  kind,
  title,
  description,
  source,
  decision,
  drilldown,
  wide = false,
  data,
}: {
  visualId: string;
  kind: DashboardVisualKind;
  title: string;
  description: string;
  source: readonly string[];
  decision?: string | undefined;
  drilldown: string;
  wide?: boolean;
  data?:
    | {
        labels: readonly string[];
        values: readonly number[];
        currencyCode?: string;
        comparison?: DashboardComparisonSnapshot;
        trend?: DashboardTrendSnapshot;
      }
    | undefined;
}) {
  const resolvedKind = data?.values.length
    ? dashboardVisualKindForData(kind, data.values)
    : kind;
  const isEmployeeComparison =
    visualId.startsWith('employee-') &&
    (resolvedKind === 'bar' || resolvedKind === 'stacked-bar');
  const Icon = isEmployeeComparison ? UsersRound : visualIcons[resolvedKind];
  const visualLabel = isEmployeeComparison
    ? 'مقایسه عملکرد تیم'
    : visualLabels[resolvedKind];
  return (
    <Card
      data-dashboard-visual
      data-dashboard-employee-visual={isEmployeeComparison || undefined}
      className={cn(
        'flex h-full min-w-0 flex-col overflow-hidden p-0 shadow-sm',
        wide && 'xl:col-span-2',
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b border-border/70 bg-gradient-to-l from-blue-50/70 via-surface to-surface p-3.5 dark:from-blue-950/20">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-900">
            <Icon aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <h3 className="font-black text-foreground">{title}</h3>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">
              {description}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Badge className="bg-blue-50 text-[10px] text-blue-700 dark:bg-blue-950/50 dark:text-blue-200">
            {visualLabel}
          </Badge>
          {data?.comparison ? (
            <GrowthIndicator comparison={data.comparison} />
          ) : null}
        </div>
      </div>
      <div className="relative flex-1 p-3.5">
        {data?.currencyCode ? (
          <span className="mb-2 block text-[11px] font-semibold text-muted-foreground">
            مبلغ فروش · <bdi dir="ltr">{data.currencyCode}</bdi>
          </span>
        ) : null}
        {data?.values.length ? (
          isEmployeeComparison ? (
            <EmployeePerformanceBars
              labels={data.labels}
              title={title}
              values={data.values}
            />
          ) : resolvedKind === 'table' || resolvedKind === 'queue' ? (
            <OperationalDataTable
              kind={resolvedKind}
              labels={data.labels}
              title={title}
              values={data.values}
            />
          ) : (
            <DashboardChart kind={kind} labels={data.labels} title={title} values={data.values} />
          )
        ) : (
          <>
            <EmptyVisualCanvas kind={kind} />
            <p className="sr-only">دادهٔ تأییدشده برای نمایش موجود نیست</p>
          </>
        )}
        {data?.values.length ? (
          <>
            {kind === 'donut' && resolvedKind !== 'donut' ? (
              <p className="mt-2 text-[11px] text-muted-foreground">
                به‌دلیل تعداد یا ماهیت دسته‌ها، سهم‌ها به‌صورت میله‌ای نمایش داده شده‌اند.
              </p>
            ) : null}
            {resolvedKind === 'table' || resolvedKind === 'queue' ? null : (
              <VisualDataSummary labels={data.labels} title={title} values={data.values} />
            )}
          </>
        ) : null}
        {data?.trend && resolvedKind !== 'line' ? (
          <div className="mb-3 flex items-center justify-between rounded-xl border border-border/70 bg-muted/20 px-3 py-2">
            <span className="text-[11px] font-bold text-muted-foreground">
              روند بازهٔ انتخاب‌شده
            </span>
            <MiniTrend title={title} trend={data.trend} />
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border/80 bg-muted/20 px-4 py-3">
        <span className="text-[11px] text-muted-foreground">منبع:</span>
        <span
          className="min-w-0 truncate font-mono text-[10px] text-muted-foreground"
          dir="ltr"
          title={source.join(' + ')}
        >
          {source.join(' + ')}
        </span>
        {decision ? (
          <Badge className="bg-amber-100 text-[10px] text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            {decision}
          </Badge>
        ) : null}
        <Button asChild className="ms-auto" size="sm" variant="outline">
          <Link href={drilldown}>بررسی گزارش مرتبط</Link>
        </Button>
      </div>
    </Card>
  );
}

function DashboardSidebar({
  activePageId,
  collapsed,
  expandedGroups,
  filterOptions,
  filters,
  filtersOpen,
  isFetching,
  dateRangeError,
  onCollapseToggle,
  onFiltersRequest,
  onFiltersToggle,
  onFiltersChange,
  onFiltersReset,
  onGroupToggle,
  onPageSelect,
  onRefresh,
}: {
  activePageId: string;
  collapsed: boolean;
  expandedGroups: ReadonlySet<string>;
  filterOptions: DashboardFilterOptions | undefined;
  filters: DashboardFilters;
  filtersOpen: boolean;
  isFetching: boolean;
  dateRangeError: string;
  onCollapseToggle(): void;
  onFiltersRequest(): void;
  onFiltersToggle(): void;
  onFiltersChange(patch: Partial<DashboardFilters>): void;
  onFiltersReset(): void;
  onGroupToggle(pageId: string): void;
  onPageSelect(pageId: string): void;
  onRefresh(): void;
}) {
  const [dateCalendarSystem, setDateCalendarSystem] =
    useState<CalendarSystem>('persian');

  return (
    <Card
      data-dashboard-sidebar
      className={cn(
        'self-start overflow-hidden transition-[width] duration-200',
        collapsed ? 'lg:w-[4.5rem]' : 'lg:w-full',
      )}
    >
      <div
        className={cn(
          'flex min-h-16 items-center border-b border-border p-3',
          collapsed ? 'justify-center' : 'justify-between gap-3',
        )}
      >
        <div className={cn('min-w-0', collapsed && 'sr-only')}>
          <p className="text-xs font-bold text-primary">فضای کار</p>
          <h2 id="dashboard-pages-title" className="font-black">
            داشبوردها
          </h2>
        </div>
        <Button
          aria-label={
            collapsed
              ? faMessages.shell.expandSidebar
              : faMessages.shell.collapseSidebar
          }
          className="size-8 min-h-8 p-0"
          onClick={onCollapseToggle}
          size="icon"
          title={
            collapsed
              ? faMessages.shell.expandSidebar
              : faMessages.shell.collapseSidebar
          }
          variant="ghost"
        >
          {collapsed ? (
            <ChevronsLeft aria-hidden="true" className="size-4" />
          ) : (
            <ChevronsRight aria-hidden="true" className="size-4" />
          )}
        </Button>
      </div>

      <nav aria-labelledby="dashboard-pages-title" className="space-y-1 p-2">
        {dashboardNavigation.map((item) => {
          const page = dashboardPageById.get(item.pageId);
          if (!page) return null;
          const Icon = navigationIcons[item.pageId] ?? LayoutDashboard;
          const hasChildren = Boolean(item.children?.length);
          const expanded = expandedGroups.has(item.pageId);
          const branchActive =
            activePageId === item.pageId ||
            Boolean(
              item.children?.some((child) => child.pageId === activePageId),
            );

          return (
            <div key={item.pageId}>
              <div className="flex items-center gap-1">
                <button
                  aria-current={
                    activePageId === item.pageId ? 'page' : undefined
                  }
                  aria-label={collapsed ? page.title : undefined}
                  className={cn(
                    'flex min-h-11 min-w-0 flex-1 items-center rounded-xl text-start text-sm font-bold outline-none transition focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    collapsed ? 'justify-center px-2' : 'gap-3 px-3',
                    branchActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-foreground hover:bg-muted',
                  )}
                  onClick={() => onPageSelect(item.pageId)}
                  title={collapsed ? page.title : undefined}
                  type="button"
                >
                  <Icon aria-hidden="true" className="size-[18px] shrink-0" />
                  {collapsed ? null : (
                    <span className="min-w-0 flex-1">{page.title}</span>
                  )}
                </button>
                {hasChildren && !collapsed ? (
                  <button
                    aria-expanded={expanded}
                    aria-label={`${expanded ? 'بستن' : 'بازکردن'} زیرصفحه‌های ${page.title}`}
                    className="grid size-10 shrink-0 place-items-center rounded-xl text-muted-foreground outline-none transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    onClick={() => onGroupToggle(item.pageId)}
                    type="button"
                  >
                    <ChevronDown
                      aria-hidden="true"
                      className={cn(
                        'size-4 transition-transform',
                        expanded && 'rotate-180',
                      )}
                    />
                  </button>
                ) : null}
              </div>

              {hasChildren && expanded && !collapsed ? (
                <div className="me-5 mt-1 space-y-1 border-e border-border pe-3">
                  {item.children?.map((child) => {
                    const childPage = dashboardPageById.get(child.pageId);
                    if (!childPage) return null;
                    const selected = child.pageId === activePageId;
                    return (
                      <button
                        aria-current={selected ? 'page' : undefined}
                        className={cn(
                          'flex min-h-10 w-full items-center rounded-lg px-3 text-start text-xs font-bold outline-none transition focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                          selected
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                        key={child.pageId}
                        onClick={() => onPageSelect(child.pageId)}
                        type="button"
                      >
                        {childPage.title}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <section
        aria-label={collapsed ? 'فیلترهای داشبورد' : undefined}
        aria-labelledby={
          collapsed ? undefined : 'dashboard-sidebar-filters-title'
        }
        className={cn(
          'border-t border-border',
          collapsed ? 'space-y-2 p-2' : 'p-3',
        )}
      >
        {collapsed ? (
          <>
            <Button
              aria-label="نمایش فیلترهای داشبورد"
              className="size-10 w-full p-0"
              onClick={onFiltersRequest}
              size="icon"
              title="فیلترهای داشبورد"
              variant="ghost"
            >
              <Filter aria-hidden="true" className="size-4" />
            </Button>
            <Button
              aria-label="پاک‌کردن فیلترهای داشبورد"
              className="size-10 w-full p-0"
              onClick={onFiltersReset}
              size="icon"
              title="پاک‌کردن فیلترها"
              variant="ghost"
            >
              <RotateCcw aria-hidden="true" className="size-4" />
            </Button>
            <Button
              aria-label="به‌روزرسانی دستی داشبورد"
              className="size-10 w-full p-0"
              disabled={Boolean(dateRangeError)}
              loading={isFetching}
              onClick={onRefresh}
              size="icon"
              title="به‌روزرسانی دستی"
              variant="ghost"
            >
              <RefreshCw aria-hidden="true" className="size-4" />
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Filter aria-hidden="true" className="size-4" />
              </span>
              <h3
                id="dashboard-sidebar-filters-title"
                className="min-w-0 flex-1 text-sm font-black"
              >
                فیلترهای داشبورد
              </h3>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <div className="grid gap-3">
                  <FormField id="dashboard-from" label="از تاریخ">
                    <DatePicker
                      aria-describedby={
                        dateRangeError
                          ? 'dashboard-date-range-error'
                          : undefined
                      }
                      aria-invalid={Boolean(dateRangeError)}
                      calendarSystem={dateCalendarSystem}
                      className="rounded-xl focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 focus-within:ring-offset-background"
                      gregorianEnglish
                      id="dashboard-from"
                      onCalendarSystemChange={setDateCalendarSystem}
                      onChange={(from) =>
                        onFiltersChange({ from, range: 'custom' })
                      }
                      placeholder="انتخاب تاریخ"
                      value={filters.from ?? ''}
                    />
                  </FormField>
                  <FormField id="dashboard-to" label="تا تاریخ">
                    <DatePicker
                      aria-describedby={
                        dateRangeError
                          ? 'dashboard-date-range-error'
                          : undefined
                      }
                      aria-invalid={Boolean(dateRangeError)}
                      calendarSystem={dateCalendarSystem}
                      className="rounded-xl focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 focus-within:ring-offset-background"
                      gregorianEnglish
                      id="dashboard-to"
                      onCalendarSystemChange={setDateCalendarSystem}
                      onChange={(to) =>
                        onFiltersChange({ range: 'custom', to })
                      }
                      placeholder="انتخاب تاریخ"
                      value={filters.to ?? ''}
                    />
                  </FormField>
                </div>
                {dateRangeError ? (
                  <p
                    className="mt-2 text-xs font-medium text-destructive"
                    id="dashboard-date-range-error"
                    role="alert"
                  >
                    {dateRangeError}
                  </p>
                ) : null}
              </div>

              <FormField id="dashboard-range" label="بازه زمانی">
                <Select
                  value={filters.range}
                  onValueChange={(value) => {
                    const range = value as DashboardRange;
                    onFiltersChange({
                      range,
                      ...(range === 'custom' ? {} : { from: null, to: null }),
                    });
                  }}
                >
                  <SelectTrigger
                    className="focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    id="dashboard-range"
                  >
                    <CalendarRange aria-hidden="true" className="size-4" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {rangeOptions.map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <Button
                aria-expanded={filtersOpen}
                className="w-full justify-between"
                onClick={onFiltersToggle}
                variant="outline"
              >
                <span className="flex items-center gap-2">
                  <Filter aria-hidden="true" className="size-4" />
                  فیلترهای بیشتر
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    'size-4 transition-transform',
                    filtersOpen && 'rotate-180',
                  )}
                />
              </Button>

              {filtersOpen ? (
                <div className="space-y-3 rounded-xl bg-muted/30 p-3">
                  {(dashboardPageFilterKeys[activePageId] ?? []).map((key) => (
                    <DimensionFilter
                      allLabel={filterAllLabelByKey.get(key) ?? `همه ${key}`}
                      id={`dashboard-filter-${key}`}
                      key={key}
                      label={filterLabelByKey.get(key) ?? key}
                      loading={isFetching}
                      onChange={(value) => onFiltersChange({ [key]: value })}
                      options={filterOptions?.[key] ?? []}
                      value={filters[key]}
                    />
                  ))}
                  {!(dashboardPageFilterKeys[activePageId] ?? []).length ? (
                    <p className="text-[11px] leading-5 text-muted-foreground">
                      <Info aria-hidden="true" className="me-1 inline size-3.5" />
                      برای این صفحه فیلتر تکمیلی منتشر نشده است.
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
                <Button onClick={onFiltersReset} size="sm" variant="outline">
                  <RotateCcw aria-hidden="true" className="size-4" />
                  پاک‌کردن
                </Button>
                <Button
                  disabled={Boolean(dateRangeError)}
                  loading={isFetching}
                  onClick={onRefresh}
                  size="sm"
                  variant="outline"
                >
                  <RefreshCw aria-hidden="true" className="size-4" />
                  به‌روزرسانی
                </Button>
              </div>
            </div>
          </>
        )}
      </section>
    </Card>
  );
}

export function DashboardWorkspace() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = useMemo(
    () =>
      dashboardFiltersFromSearchParams(
        new URLSearchParams(searchParams.toString()),
      ),
    [searchParams],
  );
  const dateRangeError = dashboardDateRangeError(filters.from, filters.to);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<ReadonlySet<string>>(
    () =>
      new Set(['commercial-performance', 'customer-growth', 'workforce-hr']),
  );
  const legalEntity = useLegalEntityContext();
  const selection = legalEntity.context?.selection ?? null;
  const activePage =
    dashboardPages.find((page) => page.id === filters.page) ??
    dashboardPages[0]!;
  const activePageKpis = dashboardKpis
    .filter((kpi) => activePage.kpiIds.includes(kpi.id))
    .map((kpi) =>
      activePage.id === 'executive-overview' && kpi.id === 'collected'
        ? { ...kpi, title: executiveSalesTitles[filters.range] }
        : kpi,
    );
  const query = useQuery({
    queryKey: ['dashboard-public-projection-v1', filters, selection],
    queryFn: ({ signal }) =>
      dashboardProjectionClient.load({
        filters,
        legalEntity: selection,
        kpiIds: activePageKpis.map((item) => item.id),
        visualIds: activePage.visualizations.map((item) => item.id),
        signal,
      }),
    enabled: !dateRangeError,
    staleTime: 30_000,
  });

  const updateFilters = (patch: Partial<DashboardFilters>) => {
    const params = dashboardFiltersToSearchParams({ ...filters, ...patch });
    router.replace(params.size ? `${pathname}?${params}` : pathname, {
      scroll: false,
    });
  };
  const resetFilters = () => {
    const params = dashboardFiltersToSearchParams({
      ...defaultDashboardFilters,
      page: activePage.id,
    });
    router.replace(params.size ? `${pathname}?${params}` : pathname, {
      scroll: false,
    });
  };
  const toggleNavigationGroup = (pageId: string) => {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  };
  const selectPage = (pageId: string) => {
    const supportedFilters = new Set(dashboardPageFilterKeys[pageId] ?? []);
    const clearHiddenFilters = Object.fromEntries(
      (Object.keys(defaultDashboardFilters) as Array<keyof DashboardFilters>)
        .filter(
          (key): key is DashboardFilterKey =>
            dashboardFilterKeySet.has(key as DashboardFilterKey) &&
            !supportedFilters.has(key as DashboardFilterKey),
        )
        .map((key) => [key, null]),
    ) as Partial<DashboardFilters>;
    updateFilters({
      ...clearHiddenFilters,
      page: pageId,
      widget: null,
    });
  };
  const selectedKpi =
    activePageKpis.find((item) => item.id === filters.widget) ?? null;
  return (
    <div className="min-w-0 space-y-5 pb-8" data-dashboard-workspace>
      <section aria-live="polite">
        {query.isPending ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        ) : null}
        {query.isError ? (
          <ErrorState
            title="خطا در دریافت Dashboard"
            description="هیچ دادهٔ قدیمی یا حدسی نمایش داده نمی‌شود."
            action={
              <Button onClick={() => void query.refetch()} variant="outline">
                تلاش دوباره
              </Button>
            }
          />
        ) : null}
        {query.data?.state === 'forbidden' ? (
          <EmptyState
            icon={LockKeyhole}
            title="دسترسی مجاز نیست"
            description="Permission snapshot این کاربر اجازه مشاهدهٔ داده را نمی‌دهد."
          />
        ) : null}
        {query.data?.state === 'empty' ? (
          <EmptyState
            title="داده‌ای در این دامنه نیست"
            description="Projection معتبر پاسخ خالی داده است؛ فیلترها را بررسی کنید."
          />
        ) : null}
        {query.data?.state === 'stale' ? (
          <Alert
            title="داده ممکن است قدیمی باشد"
            description={query.data.message}
            tone="warning"
          />
        ) : null}
      </section>

      <section
        aria-label="فضای صفحه‌های داشبورد"
        className={cn(
          'grid items-start gap-4',
          sidebarCollapsed
            ? 'lg:grid-cols-[4.5rem_minmax(0,1fr)]'
            : 'lg:grid-cols-[17rem_minmax(0,1fr)]',
        )}
      >
        <DashboardSidebar
          activePageId={activePage.id}
          collapsed={sidebarCollapsed}
          dateRangeError={dateRangeError}
          expandedGroups={expandedGroups}
          filterOptions={query.data?.filterOptions}
          filters={filters}
          filtersOpen={filtersOpen}
          isFetching={query.isFetching}
          onCollapseToggle={() => setSidebarCollapsed((value) => !value)}
          onFiltersRequest={() => {
            setSidebarCollapsed(false);
            setFiltersOpen(true);
          }}
          onFiltersToggle={() => setFiltersOpen((value) => !value)}
          onFiltersChange={updateFilters}
          onFiltersReset={resetFilters}
          onGroupToggle={toggleNavigationGroup}
           onPageSelect={selectPage}
          onRefresh={() => void query.refetch()}
        />

        <div className="min-w-0 space-y-5">
          <section aria-labelledby="active-dashboard-page-title">
            <div className="space-y-4">
              <header className="overflow-hidden rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5">
                <div className="sm:flex sm:items-end sm:justify-between sm:gap-4">
                  <div>
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <h2
                        id="active-dashboard-page-title"
                        className="text-2xl font-black tracking-tight"
                      >
                        {activePage.title}
                      </h2>
                      <span className="text-xs font-bold text-primary" dir="ltr">
                        {activePage.technicalName}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      {activePage.description}
                    </p>
                  </div>
                </div>
              </header>

              {activePageKpis.length > 0 ? (
                <div
                    className={cn(
                      'grid grid-cols-1 gap-3',
                      kpiGridColumns(activePageKpis.length),
                    )}
                    data-dashboard-kpi-count={activePageKpis.length}
                  >
                    {activePageKpis.map((item) => (
                      <KpiCard
                        key={item.id}
                        definition={item}
                        featured
                        metric={query.data?.metrics[item.id]}
                        selected={filters.widget === item.id}
                        onSelect={() =>
                          updateFilters({
                            widget: filters.widget === item.id ? null : item.id,
                          })
                        }
                      />
                    ))}
                </div>
              ) : (
                <p className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
                  برای این صفحه هنوز KPI تأییدشده‌ای در Projection عمومی منتشر
                  نشده است.
                </p>
              )}

              {activePage.visualizations.length ? (
                <div className="grid items-stretch gap-3 xl:grid-cols-2">
                    {activePage.visualizations.map((visualization, index) => (
                      <ProjectionSlot
                        visualId={visualization.id}
                        wide={dashboardVisualIsWide(
                          activePage.visualizations,
                          index,
                        )}
                        key={visualization.id}
                        kind={visualization.kind}
                        title={visualization.title}
                        description={visualization.description}
                        source={visualization.source}
                        decision={visualization.openDecision}
                        drilldown={visualization.drilldown}
                        data={query.data?.visuals[visualization.id]}
                      />
                    ))}
                </div>
              ) : null}
            </div>
          </section>

          {selectedKpi ? (
            <KpiDefinitionPanel
              definition={selectedKpi}
              onClose={() => updateFilters({ widget: null })}
            />
          ) : null}

          <section className="grid items-start gap-4 xl:grid-cols-[1.25fr_1fr]">
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck
                  aria-hidden="true"
                  className="size-5 text-primary"
                />
                <h2 className="font-black">قرارداد state و دسترسی</h2>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ['Loading', 'Skeleton؛ بدون flash داده قبلی'],
                  ['Empty', 'پاسخ معتبر با صفر رکورد'],
                  ['Error + Retry', 'خطای دریافت؛ بدون fallback حدسی'],
                  ['Forbidden', 'deny-by-default براساس permission snapshot'],
                  ['Stale Data', 'هشدار dataAsOf و امکان refresh'],
                  ['Blocked', 'نبود Public Projection نسخه‌دار'],
                ].map(([title, text]) => (
                  <div
                    key={title}
                    className="rounded-xl border border-border p-3"
                  >
                    <p className="text-xs font-black" dir="ltr">
                      {title}
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                      {text}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs leading-6 text-muted-foreground">
                نقش‌های مدیر، مدیر شعبه و مدیر گزارش‌گیر فقط پس از پاسخ Backend
                و scope شرکت/شعبه داده می‌بینند؛ نام نقش در UI مجوز ایجاد
                نمی‌کند.
              </p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <Clock3 aria-hidden="true" className="size-5 text-amber-600" />
                <h2 className="font-black">تصمیم‌های باز و metadata</h2>
              </div>
              <ul className="mt-3 space-y-2 text-xs leading-6 text-muted-foreground">
                {dashboardOpenDecisions.map(([id, title]) => (
                  <li key={id} className="flex gap-2">
                    <span
                      className="shrink-0 font-mono font-bold text-amber-700 dark:text-amber-300"
                      dir="ltr"
                    >
                      {id}
                    </span>
                    <span>{title}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        </div>
      </section>
    </div>
  );
}
