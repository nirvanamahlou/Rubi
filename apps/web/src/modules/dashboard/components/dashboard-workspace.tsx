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
  ShieldAlert,
  Ticket,
  UserRoundCog,
  UserCheck,
  UserPlus,
  UsersRound,
  WalletCards,
  X,
  type LucideIcon,
} from 'lucide-react';
import Image from 'next/image';
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
import { ReportingWorkspace } from '@/modules/reports/components/reporting-workspace';
import { reportCatalog } from '@/modules/reports/model/reporting';
import {
  dashboardProjectionClient,
  type DashboardComparisonSnapshot,
  type DashboardFilterOptions,
  type DashboardMetricSnapshot,
  type DashboardTrendSnapshot,
  type DashboardVisualSnapshot,
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
  dashboardPages,
  type DashboardKpiDefinition,
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

type TrendCalendarSystem = 'persian' | 'gregorian';
type TrendTemporalGrain = 'hour' | 'day' | 'week' | 'month';

const trendCalendarOptions: readonly [TrendCalendarSystem, string][] = [
  ['persian', 'تاریخ شمسی'],
  ['gregorian', 'تاریخ میلادی'],
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
  { key: 'salesChannel', label: 'کانال فروش', allLabel: 'همه کانال‌های فروش' },
  { key: 'branch', label: 'شعبه', allLabel: 'همه شعبه‌ها' },
  { key: 'agent', label: 'کارشناس مسئول', allLabel: 'همه کارشناسان' },
  { key: 'service', label: 'خدمت سفر', allLabel: 'همه خدمات سفر' },
  { key: 'agency', label: 'آژانس همکار', allLabel: 'همه آژانس‌های همکار' },
  { key: 'provider', label: 'تأمین‌کننده خدمت', allLabel: 'همه تأمین‌کنندگان' },
  { key: 'currency', label: 'واحد پول', allLabel: 'همه ارزها (بدون جمع)' },
  { key: 'status', label: 'وضعیت رکورد', allLabel: 'همه وضعیت‌ها' },
];

type DashboardFilterKey = keyof DashboardFilterOptions;

const dashboardPageFilterKeys: Readonly<
  Record<string, readonly DashboardFilterKey[]>
> = {
  'executive-overview': [
    'salesChannel',
    'branch',
    'service',
    'currency',
    'status',
  ],
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
  'sales-profitability-analysis': [
    'salesChannel',
    'branch',
    'agent',
    'service',
    'currency',
  ],
  'sales-segment-analysis': [
    'salesChannel',
    'branch',
    'service',
    'agency',
    'currency',
  ],
  'revenue-collections': ['branch', 'service', 'currency', 'status'],
  'travel-operations': ['branch', 'agent', 'service', 'provider', 'status'],
  'flight-route-analysis': [
    'branch',
    'service',
    'provider',
    'currency',
    'status',
  ],
  'inventory-products': ['branch', 'service', 'provider', 'currency'],
  'tour-hotel-performance': ['branch', 'service', 'provider', 'currency'],
  'procurement-suppliers': [
    'branch',
    'service',
    'provider',
    'currency',
    'status',
  ],
  'finance-treasury': ['branch', 'currency', 'status', 'service'],
  'finance-profitability-costs': ['branch', 'service', 'currency', 'status'],
  'finance-obligations-risk': [
    'branch',
    'currency',
    'status',
    'agency',
    'provider',
  ],
  'customer-growth': ['salesChannel', 'branch', 'service', 'agency', 'status'],
  'customer-behavior-analysis': ['salesChannel', 'branch', 'service', 'agency'],
  'customer-crm': ['salesChannel', 'branch', 'agent', 'service', 'status'],
  'support-service-quality': ['branch', 'agent', 'service', 'status'],
  'partners-b2b': [
    'agency',
    'branch',
    'salesChannel',
    'service',
    'provider',
    'currency',
  ],
  'marketing-growth': ['salesChannel', 'branch', 'service', 'agency', 'status'],
  'workforce-hr': ['branch', 'agent', 'status'],
  'hr-record-quality': ['branch', 'agent', 'status'],
  'employee-commercial-performance': [
    'branch',
    'agent',
    'service',
    'salesChannel',
  ],
  'employee-crm-activity': ['branch', 'agent', 'salesChannel', 'status'],
  'employee-sales-quality': [
    'branch',
    'agent',
    'service',
    'salesChannel',
    'status',
  ],
  'tasks-automation': ['branch', 'agent', 'status'],
  'documents-reports-data-quality': ['branch', 'status'],
};

const statusFilterCopyByPage: Readonly<
  Partial<Record<string, { label: string; allLabel: string }>>
> = {
  'executive-overview': {
    label: 'وضعیت عملیات',
    allLabel: 'همه وضعیت‌های عملیاتی',
  },
  'executive-growth-risk': {
    label: 'وضعیت مورد بررسی',
    allLabel: 'همه وضعیت‌های مورد بررسی',
  },
  'commercial-performance': {
    label: 'وضعیت فروش',
    allLabel: 'همه وضعیت‌های فروش',
  },
  'revenue-collections': {
    label: 'وضعیت پرداخت',
    allLabel: 'همه وضعیت‌های پرداخت',
  },
  'travel-operations': {
    label: 'وضعیت رزرو و صدور',
    allLabel: 'همه وضعیت‌های رزرو و صدور',
  },
  'flight-route-analysis': {
    label: 'وضعیت بلیت و رزرو',
    allLabel: 'همه وضعیت‌های بلیت و رزرو',
  },
  'procurement-suppliers': {
    label: 'وضعیت خرید',
    allLabel: 'همه وضعیت‌های خرید',
  },
  'finance-treasury': {
    label: 'وضعیت مالی',
    allLabel: 'همه وضعیت‌های مالی',
  },
  'finance-profitability-costs': {
    label: 'وضعیت مالی',
    allLabel: 'همه وضعیت‌های مالی',
  },
  'finance-obligations-risk': {
    label: 'وضعیت تعهد مالی',
    allLabel: 'همه وضعیت‌های تعهد مالی',
  },
  'customer-growth': {
    label: 'وضعیت ارتباط با مشتری',
    allLabel: 'همه وضعیت‌های ارتباط با مشتری',
  },
  'customer-crm': {
    label: 'وضعیت لید و مشتری',
    allLabel: 'همه وضعیت‌های لید و مشتری',
  },
  'support-service-quality': {
    label: 'وضعیت درخواست پشتیبانی',
    allLabel: 'همه وضعیت‌های درخواست پشتیبانی',
  },
  'marketing-growth': {
    label: 'وضعیت کمپین',
    allLabel: 'همه وضعیت‌های کمپین',
  },
  'workforce-hr': {
    label: 'وضعیت پرسنلی',
    allLabel: 'همه وضعیت‌های پرسنلی',
  },
  'hr-record-quality': {
    label: 'وضعیت سوابق پرسنلی',
    allLabel: 'همه وضعیت‌های سوابق پرسنلی',
  },
  'employee-crm-activity': {
    label: 'وضعیت فعالیت CRM',
    allLabel: 'همه وضعیت‌های فعالیت CRM',
  },
  'employee-sales-quality': {
    label: 'وضعیت فروش',
    allLabel: 'همه وضعیت‌های فروش',
  },
  'tasks-automation': {
    label: 'وضعیت اجرا',
    allLabel: 'همه وضعیت‌های اجرا',
  },
  'documents-reports-data-quality': {
    label: 'وضعیت کیفیت داده',
    allLabel: 'همه وضعیت‌های کیفیت داده',
  },
};

const semanticFilterCopyByPage: Readonly<
  Partial<
    Record<
      string,
      Partial<Record<DashboardFilterKey, { label: string; allLabel: string }>>
    >
  >
> = {
  'customer-growth': {
    salesChannel: { label: 'کانال جذب', allLabel: 'همه کانال‌های جذب' },
  },
  'customer-behavior-analysis': {
    salesChannel: { label: 'کانال جذب', allLabel: 'همه کانال‌های جذب' },
  },
  'customer-crm': {
    salesChannel: { label: 'کانال جذب', allLabel: 'همه کانال‌های جذب' },
    agent: { label: 'کارشناس CRM', allLabel: 'همه کارشناسان CRM' },
  },
  'support-service-quality': {
    agent: {
      label: 'کارشناس پشتیبانی',
      allLabel: 'همه کارشناسان پشتیبانی',
    },
  },
  'marketing-growth': {
    salesChannel: { label: 'کانال جذب', allLabel: 'همه کانال‌های جذب' },
  },
  'workforce-hr': {
    agent: { label: 'کارمند', allLabel: 'همه کارکنان' },
  },
  'hr-record-quality': {
    agent: { label: 'کارمند', allLabel: 'همه کارکنان' },
  },
  'employee-commercial-performance': {
    agent: { label: 'کارشناس فروش', allLabel: 'همه کارشناسان فروش' },
  },
  'employee-crm-activity': {
    agent: { label: 'کارشناس CRM', allLabel: 'همه کارشناسان CRM' },
    salesChannel: { label: 'کانال جذب', allLabel: 'همه کانال‌های جذب' },
  },
  'employee-sales-quality': {
    agent: { label: 'کارشناس فروش', allLabel: 'همه کارشناسان فروش' },
  },
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

function filterCopyForPage(pageId: string, key: DashboardFilterKey) {
  const semanticCopy = semanticFilterCopyByPage[pageId]?.[key];
  if (semanticCopy) return semanticCopy;
  if (key === 'status') {
    const copy = statusFilterCopyByPage[pageId];
    if (copy) return copy;
  }
  return {
    label: filterLabelByKey.get(key) ?? key,
    allLabel: filterAllLabelByKey.get(key) ?? `همه ${key}`,
  };
}

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

const adverseKpiIdPattern =
  /refund|cancel|discount|expense|commission|overdue|awaiting|pending|failure|breach|debt|payable|risk|complaint|escalation|expired|blocked|shortage/i;

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
    kpiVisualMatchers.find(([pattern]) => pattern.test(definition.id))?.[1] ?? {
      icon: CircleDollarSign,
      label: 'شاخص عملکرد',
      className:
        'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700',
    }
  );
}

const comparisonRankPalette = [
  '#172554',
  '#1e3a8a',
  '#1d4ed8',
  '#2563eb',
  '#60a5fa',
  '#93c5fd',
] as const;

function comparisonRankColor(rank: number, count: number) {
  const paletteIndex =
    count <= 1
      ? 0
      : Math.round(
          (Math.min(rank, count - 1) / (count - 1)) *
            (comparisonRankPalette.length - 1),
        );
  return comparisonRankPalette[paletteIndex] ?? comparisonRankPalette[0]!;
}

function compactChartValue(value: number) {
  return Intl.NumberFormat('en-US', {
    notation: Math.abs(value) >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value);
}

function trendTemporalGrain(
  range: DashboardRange,
  labels: readonly string[],
): TrendTemporalGrain {
  if (range === 'today') return 'hour';
  if (range === 'week' || range === 'month') return 'day';
  if (range === 'quarter') return 'week';
  if (range === 'year') return 'month';

  const firstInterval =
    labels.length > 1
      ? new Date(labels[1] ?? '').getTime() - new Date(labels[0] ?? '').getTime()
      : Number.NaN;
  if (!Number.isFinite(firstInterval)) return 'day';
  if (firstInterval <= 60 * 60 * 1000) return 'hour';
  if (firstInterval >= 25 * 24 * 60 * 60 * 1000) return 'month';
  if (firstInterval >= 6 * 24 * 60 * 60 * 1000) return 'week';
  return 'day';
}

const trendTemporalLabels: Record<TrendTemporalGrain, string> = {
  hour: 'ساعتی',
  day: 'روزانه',
  week: 'هفتگی',
  month: 'ماهانه',
};

function trendDateLabel(
  value: string,
  calendarSystem: TrendCalendarSystem,
  grain: TrendTemporalGrain,
  includeYear = false,
) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(
    calendarSystem === 'persian'
      ? 'fa-IR-u-ca-persian-nu-latn'
      : 'en-US-u-ca-gregory',
    {
      timeZone: 'Asia/Tehran',
      month: 'short',
      ...(grain === 'hour'
        ? { hour: '2-digit', hourCycle: 'h23' }
        : grain === 'month'
          ? { year: 'numeric' }
          : { day: 'numeric', ...(includeYear ? { year: 'numeric' } : {}) }),
    },
  ).format(date);
}

function trendTooltipTime(
  value: string,
  calendarSystem: TrendCalendarSystem,
  grain: TrendTemporalGrain,
) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const locale =
    calendarSystem === 'persian'
      ? 'fa-IR-u-ca-persian-nu-latn'
      : 'en-US-u-ca-gregory';
  const time = new Intl.DateTimeFormat(locale, {
    timeZone: 'Asia/Tehran',
    month: 'short',
    ...(grain === 'hour'
      ? { day: 'numeric', hour: '2-digit', hourCycle: 'h23' }
      : grain === 'month'
        ? { year: 'numeric' }
        : { day: 'numeric', year: 'numeric' }),
  }).format(date);

  return grain === 'week' ? `هفتهٔ ${time}` : time;
}

function formatDashboardNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
) {
  return value.toLocaleString('en-US', options);
}

function latinizeDashboardNumericText(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replaceAll('٬', ',')
    .replaceAll('٫', '.')
    .replaceAll('٪', '%')
    .replaceAll('میلیارد', 'B')
    .replaceAll('میلیون', 'M')
    .replaceAll('هزار', 'K');
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
  if (count === 6) return 'sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6';
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
  'executive-growth-risk': Gauge,
  'commercial-performance': BriefcaseBusiness,
  'sales-profitability-analysis': CircleDollarSign,
  'sales-segment-analysis': BarChart3,
  'revenue-collections': Banknote,
  'travel-operations': Plane,
  'flight-route-analysis': Ticket,
  'inventory-products': Building2,
  'tour-hotel-performance': Hotel,
  'procurement-suppliers': BriefcaseBusiness,
  'finance-treasury': WalletCards,
  'finance-profitability-costs': CircleDollarSign,
  'finance-obligations-risk': ShieldAlert,
  'customer-growth': UsersRound,
  'customer-behavior-analysis': UsersRound,
  'customer-crm': UserCheck,
  'support-service-quality': PhoneCall,
  'partners-b2b': Building2,
  'marketing-growth': Megaphone,
  'workforce-hr': UserRoundCog,
  'hr-record-quality': CalendarCheck,
  'employee-commercial-performance': ChartNoAxesCombined,
  'employee-crm-activity': PhoneCall,
  'employee-sales-quality': BadgeDollarSign,
  'tasks-automation': CircleCheckBig,
  'documents-reports-data-quality': ShieldAlert,
};

const dashboardHeaderThemeByPageId: Record<string, string> = {
  'executive-overview':
    'from-cyan-50 via-surface to-blue-50 dark:from-cyan-950/20 dark:via-surface dark:to-blue-950/25',
  'executive-growth-risk':
    'from-sky-50 via-surface to-indigo-50 dark:from-sky-950/20 dark:via-surface dark:to-indigo-950/25',
  'commercial-performance':
    'from-blue-50 via-surface to-indigo-50 dark:from-blue-950/20 dark:via-surface dark:to-indigo-950/25',
  'sales-profitability-analysis':
    'from-violet-50 via-surface to-blue-50 dark:from-violet-950/20 dark:via-surface dark:to-blue-950/25',
  'sales-segment-analysis':
    'from-indigo-50 via-surface to-sky-50 dark:from-indigo-950/20 dark:via-surface dark:to-sky-950/25',
  'revenue-collections':
    'from-emerald-50 via-surface to-cyan-50 dark:from-emerald-950/20 dark:via-surface dark:to-cyan-950/25',
  'travel-operations':
    'from-cyan-50 via-surface to-sky-50 dark:from-cyan-950/20 dark:via-surface dark:to-sky-950/25',
  'flight-route-analysis':
    'from-sky-50 via-surface to-blue-50 dark:from-sky-950/20 dark:via-surface dark:to-blue-950/25',
  'inventory-products':
    'from-teal-50 via-surface to-cyan-50 dark:from-teal-950/20 dark:via-surface dark:to-cyan-950/25',
  'tour-hotel-performance':
    'from-amber-50 via-surface to-orange-50 dark:from-amber-950/20 dark:via-surface dark:to-orange-950/25',
  'procurement-suppliers':
    'from-orange-50 via-surface to-amber-50 dark:from-orange-950/20 dark:via-surface dark:to-amber-950/25',
  'finance-treasury':
    'from-emerald-50 via-surface to-teal-50 dark:from-emerald-950/20 dark:via-surface dark:to-teal-950/25',
  'finance-profitability-costs':
    'from-lime-50 via-surface to-emerald-50 dark:from-lime-950/20 dark:via-surface dark:to-emerald-950/25',
  'finance-obligations-risk':
    'from-rose-50 via-surface to-amber-50 dark:from-rose-950/20 dark:via-surface dark:to-amber-950/25',
  'customer-growth':
    'from-violet-50 via-surface to-fuchsia-50 dark:from-violet-950/20 dark:via-surface dark:to-fuchsia-950/25',
  'customer-behavior-analysis':
    'from-fuchsia-50 via-surface to-violet-50 dark:from-fuchsia-950/20 dark:via-surface dark:to-violet-950/25',
  'customer-crm':
    'from-indigo-50 via-surface to-violet-50 dark:from-indigo-950/20 dark:via-surface dark:to-violet-950/25',
  'support-service-quality':
    'from-cyan-50 via-surface to-violet-50 dark:from-cyan-950/20 dark:via-surface dark:to-violet-950/25',
  'partners-b2b':
    'from-blue-50 via-surface to-slate-50 dark:from-blue-950/20 dark:via-surface dark:to-slate-950/25',
  'marketing-growth':
    'from-pink-50 via-surface to-orange-50 dark:from-pink-950/20 dark:via-surface dark:to-orange-950/25',
  'workforce-hr':
    'from-amber-50 via-surface to-yellow-50 dark:from-amber-950/20 dark:via-surface dark:to-yellow-950/25',
  'hr-record-quality':
    'from-yellow-50 via-surface to-emerald-50 dark:from-yellow-950/20 dark:via-surface dark:to-emerald-950/25',
  'employee-commercial-performance':
    'from-orange-50 via-surface to-rose-50 dark:from-orange-950/20 dark:via-surface dark:to-rose-950/25',
  'employee-crm-activity':
    'from-sky-50 via-surface to-violet-50 dark:from-sky-950/20 dark:via-surface dark:to-violet-950/25',
  'employee-sales-quality':
    'from-emerald-50 via-surface to-blue-50 dark:from-emerald-950/20 dark:via-surface dark:to-blue-950/25',
  'tasks-automation':
    'from-slate-50 via-surface to-cyan-50 dark:from-slate-900/50 dark:via-surface dark:to-cyan-950/25',
  'documents-reports-data-quality':
    'from-slate-50 via-surface to-indigo-50 dark:from-slate-900/50 dark:via-surface dark:to-indigo-950/25',
};

const dashboardHeaderArtworkByPageId: Record<string, string> = {
  'executive-overview': '/images/dashboard-headers/executive-overview.png',
  'executive-growth-risk': '/images/dashboard-headers/executive-overview.png',
  'commercial-performance':
    '/images/dashboard-headers/commercial-performance.png',
  'sales-profitability-analysis':
    '/images/dashboard-headers/commercial-performance.png',
  'sales-segment-analysis':
    '/images/dashboard-headers/commercial-performance.png',
  'revenue-collections': '/images/dashboard-headers/commercial-performance.png',
  'travel-operations': '/images/dashboard-headers/commercial-performance.png',
  'flight-route-analysis':
    '/images/dashboard-headers/commercial-performance.png',
  'inventory-products': '/images/dashboard-headers/commercial-performance.png',
  'tour-hotel-performance':
    '/images/dashboard-headers/commercial-performance.png',
  'procurement-suppliers':
    '/images/dashboard-headers/commercial-performance.png',
  'finance-treasury': '/images/dashboard-headers/finance-treasury.png',
  'finance-profitability-costs':
    '/images/dashboard-headers/finance-treasury.png',
  'finance-obligations-risk': '/images/dashboard-headers/finance-treasury.png',
  'customer-growth': '/images/dashboard-headers/customer-growth.png',
  'customer-behavior-analysis': '/images/dashboard-headers/customer-growth.png',
  'customer-crm': '/images/dashboard-headers/customer-growth.png',
  'support-service-quality': '/images/dashboard-headers/customer-growth.png',
  'partners-b2b': '/images/dashboard-headers/customer-growth.png',
  'marketing-growth': '/images/dashboard-headers/customer-growth.png',
  'workforce-hr': '/images/dashboard-headers/workforce-hr.png',
  'hr-record-quality': '/images/dashboard-headers/workforce-hr.png',
  'employee-commercial-performance':
    '/images/dashboard-headers/workforce-hr.png',
  'employee-crm-activity': '/images/dashboard-headers/workforce-hr.png',
  'employee-sales-quality': '/images/dashboard-headers/workforce-hr.png',
  'tasks-automation': '/images/dashboard-headers/executive-overview.png',
  'documents-reports-data-quality':
    '/images/dashboard-headers/executive-overview.png',
};

const calculationFeatureDescriptionBySource: Record<
  string,
  { label: string; description: string }
> = {
  reporting_sales_contract_facts: {
    label: 'finalized sales contracts',
    description:
      'قراردادهای فروش با وضعیت نهایی، مبلغ، ارز و زمان تأیید فروش را در اختیار فرمول می‌گذارند.',
  },
  reporting_contract_service_facts: {
    label: 'recognized sale revenue',
    description:
      'اقلام خدمتِ قراردادهای نهایی و مبلغ فروش پذیرفته‌شدهٔ هر خدمت و ارز را نگه می‌دارد.',
  },
  reporting_reservation_facts: {
    label: 'reservation facts',
    description:
      'وضعیت، زمان و نتیجهٔ رزرو را برای شمارش، لغو یا آمادگی صدور فراهم می‌کند.',
  },
  reporting_payment_facts: {
    label: 'verified and settled payments',
    description:
      'پرداخت‌های تأییدشده یا تسویه‌شده، مبلغ، ارز و وضعیت برگشت آن‌ها را در محاسبه وارد می‌کند.',
  },
  reporting_journal_balance_facts: {
    label: 'posted journal balances',
    description:
      'مانده‌ها و ثبت‌های حسابداری ثبت‌شده را بر پایهٔ حساب، دوره و ارز ارائه می‌دهد.',
  },
  reporting_ticket_facts: {
    label: 'issued ticket facts',
    description:
      'اطلاعات سند یا بلیت نهایی، زمان صدور و وضعیت لغو را فراهم می‌کند.',
  },
  'reporting.travel.facts.v1': {
    label: 'travel operation facts',
    description:
      'اقلام سفر، خدمت، مقصد، فروش و وضعیت عملیاتی تأییدشده را برای تحلیل سفر نگه می‌دارد.',
  },
  reporting_sales_contract_pipeline_facts_v1: {
    label: 'sales pipeline facts',
    description:
      'مرحله‌های جاری قرارداد و زمان هر تغییر مرحله را برای پایش قیف فروش فراهم می‌کند.',
  },
  reporting_ticket_capacity_facts_v1: {
    label: 'ticket capacity facts',
    description:
      'ظرفیت کل، ظرفیت تخصیص‌شده و ظرفیت باقی‌ماندهٔ پیشنهادهای فعال را ارائه می‌دهد.',
  },
  reporting_supplier_payment_queue_facts_v1: {
    label: 'supplier payment queue',
    description:
      'خریدهای تأمین‌کننده، وضعیت پرداخت و زمان رسیدن آن‌ها به وضعیت نهایی را نگه می‌دارد.',
  },
  reporting_reservation_delivery_readiness_facts_v1: {
    label: 'delivery readiness facts',
    description:
      'مانع‌های خرید، عملیات و تأیید مالیِ رزروهای در جریان را برای پیگیری عملیاتی نشان می‌دهد.',
  },
  reporting_customer_affairs_lead_facts_v1: {
    label: 'lead pipeline facts',
    description:
      'سرنخ‌ها، مالکیت، وضعیت، زمان ایجاد و اتصال آن‌ها به سفارش یا مشتری را ارائه می‌دهد.',
  },
  reporting_support_ticket_facts_v1: {
    label: 'support ticket facts',
    description:
      'تیکت‌های پشتیبانی، وضعیت SLA و زمان پاسخ‌گویی واجد محاسبه را نگه می‌دارد.',
  },
  reporting_customer_satisfaction_facts_v1: {
    label: 'customer satisfaction facts',
    description:
      'پاسخ‌های رضایت مشتری و اقدام اصلاحی مرتبط با آن‌ها را برای شاخص کیفیت فراهم می‌کند.',
  },
  reporting_customer_consent_facts_v1: {
    label: 'customer consent facts',
    description:
      'آخرین وضعیت معتبر رضایت مشتری برای برقراری ارتباط را نگه می‌دارد.',
  },
  reporting_customer_portfolio_growth_facts_v1: {
    label: 'customer portfolio facts',
    description:
      'کانال جذب و مشخصات مشتریان فعال یا جدید را برای تحلیل رشد مشتری ارائه می‌دهد.',
  },
  reporting_b2b_agency_risk_facts_v1: {
    label: 'agency risk facts',
    description:
      'سقف اعتبار، تضمین و وضعیت اقدام‌های ریسک آژانس‌ها را نگه می‌دارد.',
  },
  reporting_campaign_facts_v1: {
    label: 'campaign performance facts',
    description:
      'هزینه، فروش منتسب، مخاطب و تبدیل‌های معتبر کمپین‌ها را برای محاسبه استفاده می‌کند.',
  },
  reporting_employee_performance_facts_v1: {
    label: 'employee performance facts',
    description:
      'کارکرد، مرخصی، اضافه‌کاری و نتیجهٔ ارزیابی تأییدشدهٔ کارکنان را ارائه می‌دهد.',
  },
  reporting_hr_record_expiry_facts_v1: {
    label: 'HR record expiry facts',
    description:
      'تاریخ انقضا و کامل‌بودن سوابق فعال منابع انسانی را نگه می‌دارد.',
  },
  reporting_hotel_rate_comparison_facts_v1: {
    label: 'hotel rate comparison facts',
    description:
      'نرخ‌های قابل مقایسهٔ هتل و شرایط معتبر آن‌ها را برای تحلیل قیمت فراهم می‌کند.',
  },
  reporting_purchase_request_facts: {
    label: 'matched purchase cost',
    description:
      'خریدهای تأییدشده و منطبق با فروش را با مبلغ، ارز و وضعیت تطبیق معتبر فراهم می‌کند.',
  },
  approved_customer_affairs_ticket_projection: {
    label: 'approved customer-affairs tickets',
    description:
      'نمای تأییدشدهٔ تیکت‌های امور مشتریان و وضعیت نهایی آن‌ها را ارائه می‌دهد.',
  },
  approved_task_projection: {
    label: 'approved task projection',
    description:
      'وظایف باز، مالک، موعد و وضعیت آن‌ها را از نمای تأییدشده فراهم می‌کند.',
  },
  approved_finance_check_projection: {
    label: 'approved finance checks',
    description:
      'چک‌های فعال، سررسید و وضعیت مالی تأییدشده را برای شاخص سررسید ارائه می‌دهد.',
  },
  reporting_counterparty_balance_facts_v1: {
    label: 'counterparty balance facts',
    description:
      'ماندهٔ ثبت‌شدهٔ طرف حساب و سررسید آن را به تفکیک ارز ارائه می‌دهد.',
  },
  reporting_employee_commercial_activity_facts_v1: {
    label: 'employee commercial activity',
    description:
      'لید، تماس، پیگیری، لغو و مالکیت فعالیت‌های تجاری کارکنان را نگه می‌دارد.',
  },
  'sales.reporting.organization.v2': {
    label: 'employee sales attribution',
    description:
      'فروش نهایی و انتساب مصوب آن به کارشناس را برای محاسبهٔ عملکرد فردی فراهم می‌کند.',
  },
};

function calculationFeatureFor(source: string) {
  return (
    calculationFeatureDescriptionBySource[source] ?? {
      label: source,
      description:
        'رکوردهای تأییدشدهٔ این فیچر که در فرمول شاخص استفاده می‌شوند.',
    }
  );
}

function Metric({
  compact = false,
  currency = false,
  definition,
  metric,
}: {
  compact?: boolean;
  currency?: boolean;
  definition?: DashboardKpiDefinition | undefined;
  metric?: DashboardMetricSnapshot | undefined;
}) {
  const currencyValues = currency && metric ? metric.value.split(' · ') : null;
  const comparisonFor = (index: number) => {
    const currencyCode =
      metric?.trend?.series?.[index]?.currencyCode ??
      metric?.comparisonSeries?.[index]?.currencyCode;
    const actualComparison = currencyCode
      ? (metric?.comparisonSeries?.find(
          (entry) => entry.currencyCode === currencyCode,
        ) ?? metric?.comparison)
      : metric?.comparison;
    return {
      comparison: actualComparison,
      currencyCode,
      comparisonUnavailable: !actualComparison,
    };
  };

  return (
    <div
      className={cn(
        'flex w-full min-w-0 justify-center text-center',
        currencyValues ? 'flex-col items-center' : 'flex-wrap items-end',
        compact ? 'mt-2' : 'mt-4',
      )}
    >
      {currencyValues ? (
        <span className="flex w-full min-w-0 flex-col gap-1 font-black tabular-nums tracking-tight text-foreground">
          {currencyValues.map((value, index) => {
            const { amount, symbol } = currencyMetricParts(value);
            const compactAmount = compactCurrencyAmount(amount);
            const compactAmountTypography =
              compactCurrencyTypography(compactAmount);
            const { comparison, comparisonUnavailable, currencyCode } =
              comparisonFor(index);
            return (
              <span
                className="flex w-full items-center justify-center gap-2"
                dir="rtl"
                key={value}
              >
                {metric ? (
                  <GrowthIndicator
                    comparison={comparison}
                    definition={definition}
                    unavailable={comparisonUnavailable}
                    currencyCode={currencyCode}
                  />
                ) : null}
                <bdi
                  aria-label={`مقدار دقیق: ${latinizeDashboardNumericText(value)}`}
                  className={cn(
                    'inline-flex shrink-0 items-baseline gap-1.5 whitespace-nowrap text-center',
                    compactAmountTypography,
                  )}
                  dir="ltr"
                  title={latinizeDashboardNumericText(value)}
                >
                  <span aria-hidden="true">{symbol}</span>
                  <span>{compactAmount}</span>
                </bdi>
              </span>
            );
          })}
        </span>
      ) : (
        <span
          className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1"
          dir="rtl"
        >
          <span className="justify-self-start">
            {metric ? (
              <GrowthIndicator
                comparison={metric.comparison}
                definition={definition}
                unavailable={!metric.comparison}
              />
            ) : null}
          </span>
          <span
            aria-label={
              metric
                ? latinizeDashboardNumericText(metric.value)
                : 'داده‌ای دریافت نشده'
            }
            className={cn(
              'min-w-0 text-center font-black tracking-tight text-foreground',
              compact ? 'text-xl' : 'text-2xl',
            )}
          >
            {metric ? latinizeDashboardNumericText(metric.value) : '—'}
          </span>
          <span aria-hidden="true" />
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

function currencyMetricParts(value: string) {
  const symbol = [...new Set(Object.values(currencySymbols))]
    .sort((left, right) => right.length - left.length)
    .find((candidate) => value.startsWith(candidate));
  return {
    amount: symbol ? value.slice(symbol.length) : value,
    symbol: symbol ?? '',
  };
}

function compactCurrencyAmount(amount: string) {
  const latinDigits = amount
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[^0-9.-]/g, '');
  const numericAmount = Number(latinDigits);
  if (!Number.isFinite(numericAmount)) return amount;

  const absolute = Math.abs(numericAmount);
  const units: ReadonlyArray<readonly [number, string]> = [
    [1_000_000_000, 'B'],
    [1_000_000, 'M'],
    [1_000, 'K'],
  ];
  const match = units.find(([threshold]) => absolute >= threshold);
  if (!match)
    return formatDashboardNumber(numericAmount, { maximumFractionDigits: 0 });

  const [threshold, suffix] = match;
  return `${formatDashboardNumber(numericAmount / threshold, {
    maximumFractionDigits: 1,
  })}${suffix}`;
}

function compactCurrencyTypography(value: string) {
  const visibleLength = [...value.replace(/\s/g, '')].length;
  if (visibleLength >= 13)
    return 'text-[clamp(0.75rem,5cqw,0.875rem)] leading-5';
  if (visibleLength >= 10) return 'text-[clamp(0.875rem,6cqw,1rem)] leading-5';
  return 'text-[clamp(1rem,7cqw,1.125rem)] leading-6';
}

const trendSeriesPalette = [
  { color: '#2563eb', dotClassName: 'bg-blue-600 dark:bg-blue-400' },
  { color: '#7c3aed', dotClassName: 'bg-violet-600 dark:bg-violet-400' },
  { color: '#059669', dotClassName: 'bg-emerald-600 dark:bg-emerald-400' },
  { color: '#d97706', dotClassName: 'bg-amber-600 dark:bg-amber-400' },
] as const;

function MiniTrend({
  title,
  trend,
}: {
  title: string;
  trend: DashboardTrendSnapshot;
}) {
  const gradientPrefix = useId().replace(/:/g, '');
  const paletteFor = (index: number) =>
    trendSeriesPalette[index % trendSeriesPalette.length] ??
    trendSeriesPalette[0]!;
  const series = trend.series?.length
    ? trend.series
    : [{ currencyCode: '', values: trend.values }];
  const pointsFor = (values: readonly number[]) => {
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const span = Math.max(maximum - minimum, 1);
    return values.map((value, index) => ({
      x: values.length > 1 ? 4 + (index * 152) / (values.length - 1) : 80,
      y: 50 - ((value - minimum) / span) * 40,
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
            `${currencyCode ? `${currencySymbols[currencyCode] ?? currencyCode} ` : ''}${trend.labels[index] ?? index + 1}: ${formatDashboardNumber(value)}`,
        )
        .join('، '),
    )
    .join('؛ ');

  return (
    <span className="flex min-w-0 flex-1 flex-col gap-2">
      <svg
        aria-label={`روند ${title}. هر خط در مقیاس مستقل همان ارز نمایش داده می‌شود. ${summary}`}
        className="h-14 w-full overflow-visible"
        role="img"
        viewBox="0 0 160 58"
      >
        <defs>
          {renderedSeries.map(({ currencyCode }, seriesIndex) => {
            const { color } = paletteFor(seriesIndex);
            return (
              <linearGradient
                id={`${gradientPrefix}-trend-${seriesIndex}`}
                key={currencyCode || `default-${seriesIndex}`}
                x1="0"
                x2="0"
                y1="0"
                y2="1"
              >
                <stop offset="0%" stopColor={color} stopOpacity="0.32" />
                <stop offset="100%" stopColor={color} stopOpacity="0.015" />
              </linearGradient>
            );
          })}
        </defs>
        {renderedSeries.map(({ currencyCode, points }, seriesIndex) => {
          const { color } = paletteFor(seriesIndex);
          const linePoints = points.map(({ x, y }) => `${x},${y}`).join(' ');
          const areaPoints = [
            linePoints,
            `${points.at(-1)?.x ?? 80},54`,
            `${points[0]?.x ?? 80},54`,
          ].join(' ');
          return (
            <g key={currencyCode || `default-${seriesIndex}`}>
              <polygon
                aria-hidden="true"
                fill={`url(#${gradientPrefix}-trend-${seriesIndex})`}
                points={areaPoints}
              />
              <polyline
                fill="none"
                points={linePoints}
                stroke={color}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
              />
            </g>
          );
        })}
      </svg>
      {renderedSeries.some(({ currencyCode }) => currencyCode) ? (
        <span
          aria-label="راهنمای روند ارزها"
          className="flex flex-wrap justify-center gap-x-2 gap-y-1 text-[10px] font-bold text-muted-foreground"
        >
          {renderedSeries.map(({ currencyCode }, index) => (
            <span
              className="inline-flex items-center gap-1"
              key={currencyCode}
              title={currencyNames[currencyCode] ?? currencyCode}
            >
              <i
                aria-hidden="true"
                className={cn(
                  'size-1.5 rounded-full',
                  paletteFor(index).dotClassName,
                )}
              />
              <bdi dir="ltr">
                {currencySymbols[currencyCode] ?? currencyCode}
              </bdi>
            </span>
          ))}
        </span>
      ) : null}
    </span>
  );
}

function GrowthIndicator({
  comparison,
  currencyCode,
  definition,
  unavailable = false,
}: {
  comparison?: DashboardComparisonSnapshot | undefined;
  currencyCode?: string | undefined;
  definition?: DashboardKpiDefinition | undefined;
  unavailable?: boolean;
}) {
  const hasComparison = Boolean(comparison);
  const direction = comparison?.direction ?? 'flat';
  const isAdverseKpi = Boolean(
    definition &&
      (definition.role === 'guardrail' ||
        adverseKpiIdPattern.test(definition.id)),
  );
  const semanticTone =
    direction === 'flat'
      ? 'neutral'
      : isAdverseKpi
        ? direction === 'up'
          ? 'negative'
          : 'positive'
        : direction === 'up'
          ? 'positive'
          : 'negative';
  const Icon =
    direction === 'up'
      ? ArrowUpRight
      : direction === 'down'
        ? ArrowDownRight
        : Minus;
  const value =
    comparison?.deltaPercent === null || !hasComparison
      ? '—'
      : `${Math.abs(comparison!.deltaPercent).toLocaleString('en-US', {
          maximumFractionDigits: 1,
        })}%`;

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black tabular-nums shadow-sm',
        semanticTone === 'positive' &&
          'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/45 dark:text-emerald-200',
        semanticTone === 'negative' &&
          'bg-rose-100 text-rose-800 dark:bg-rose-950/75 dark:text-rose-100',
        semanticTone === 'neutral' &&
          'bg-blue-50 text-blue-700 dark:bg-blue-950/45 dark:text-blue-200',
      )}
      title={`${currencyCode ? `${currencyNames[currencyCode] ?? currencyCode} · ` : ''}${comparison?.label ?? 'دوره قبل هم‌طول'} · ${
        !hasComparison || unavailable
          ? 'دادهٔ دورهٔ قبل برای محاسبه درصد در دسترس نیست'
          : comparison!.deltaPercent === null
            ? 'مبنای دورهٔ قبل صفر است؛ درصد تغییر قابل محاسبه نیست'
            : `مقدار قبلی ${formatDashboardNumber(comparison!.previousValue)}`
      }`}
    >
      <Icon aria-hidden="true" className="size-4" strokeWidth={2.5} />
      <span dir="ltr">{value}</span>
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
        'group relative min-h-44 min-w-0 overflow-hidden rounded-2xl border bg-surface p-3 text-start shadow-sm outline-none [container-type:inline-size] transition duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        selected ? 'border-primary ring-2 ring-primary/15' : 'border-border',
        featured &&
          'bg-gradient-to-bl from-blue-50/60 via-surface to-surface dark:from-blue-950/20',
      )}
      onClick={onSelect}
      type="button"
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-5 top-0 h-0.5 rounded-b-full bg-primary/70"
      />
      <span
        aria-hidden="true"
        className="absolute -start-8 -top-10 size-28 rounded-full bg-primary/[0.045] blur-2xl transition group-hover:bg-primary/[0.08]"
      />
      <span className="relative flex min-w-0 items-center gap-2.5">
        <span className="flex min-w-0 items-center gap-2.5">
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
          <span
            className="min-w-0 truncate text-sm font-black text-foreground"
            title={definition.title}
          >
            {definition.title}
          </span>
        </span>
      </span>
      <span className="relative block text-center">
        <Metric
          compact
          currency={definition.currency === 'required'}
          definition={definition}
          metric={metric}
        />
      </span>
      {metric ? (
        <span className="relative mt-3 flex min-h-14 flex-col border-t border-border/60 pt-2">
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
  metric,
  onClose,
  onOpenReportConfiguration,
}: {
  definition: DashboardKpiDefinition;
  metric?: DashboardMetricSnapshot | undefined;
  onClose(): void;
  onOpenReportConfiguration(reportCode: string): void;
}) {
  const report = reportCatalog.find(
    (candidate) => candidate.displayCode === definition.reportCode,
  );

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
          <header className="relative border-b border-border bg-surface px-12 py-5 text-center">
            <DialogTitle className="text-2xl font-black tracking-tight sm:text-3xl">
              {definition.title}
            </DialogTitle>
            <DialogDescription
              className="mt-2 break-words text-xs leading-6"
              dir="ltr"
              id={`kpi-definition-description-${definition.id}`}
            >
              {definition.technicalName}
            </DialogDescription>
            <DrawerClose asChild>
              <Button
                aria-label="بستن پنل تعریف شاخص"
                className="absolute end-4 top-4 size-9 p-0"
                size="icon"
                variant="ghost"
              >
                <X aria-hidden="true" className="size-5" />
              </Button>
            </DrawerClose>
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

            {definition.currency === 'required' && metric ? (
              <section aria-labelledby="kpi-exact-value-title">
                <h3
                  className="text-sm font-black text-foreground"
                  id="kpi-exact-value-title"
                >
                  مقدار دقیق در بازهٔ انتخابی
                </h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {metric.value.split(' · ').map((value) => (
                    <Badge
                      dir="ltr"
                      key={value}
                      title="مقدار دقیق بدون فشرده‌سازی"
                    >
                      {latinizeDashboardNumericText(value)}
                    </Badge>
                  ))}
                </div>
              </section>
            ) : null}

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

            <section aria-labelledby="kpi-calculation-features-title">
              <h3
                className="text-sm font-black text-foreground"
                id="kpi-calculation-features-title"
              >
                فیچرهای استفاده‌شده در فرمول
              </h3>
              <ul className="mt-3 space-y-3 text-sm leading-7 text-muted-foreground">
                {definition.source.map((source) => {
                  const feature = calculationFeatureFor(source);
                  return (
                    <li className="flex gap-2" key={source}>
                      <span
                        aria-hidden="true"
                        className="mt-3 size-1.5 shrink-0 rounded-full bg-primary"
                      />
                      <span>
                        <bdi
                          className="font-mono text-xs font-bold text-foreground"
                          dir="ltr"
                        >
                          {feature.label}
                        </bdi>
                        <span className="mx-1">:</span>
                        {feature.description}
                      </span>
                    </li>
                  );
                })}
              </ul>
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
          </div>

          <footer className="border-t border-border bg-surface p-4">
            {report ? (
              <Button
                className="w-full !text-white hover:!text-white focus-visible:!text-white [&_*]:!text-white [&_svg]:!text-white"
                onClick={() => onOpenReportConfiguration(report.code)}
                size="sm"
                type="button"
              >
                رفتن به فرم پیکربندی گزارش مرتبط
                <ArrowUpRight aria-hidden="true" className="size-3.5" />
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
                    className="group flex min-h-9 w-full items-center justify-between rounded-lg px-3 py-2 text-start text-sm outline-none hover:bg-primary hover:text-primary-foreground focus-visible:bg-primary focus-visible:text-primary-foreground focus-visible:ring-2 focus-visible:ring-primary/40"
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
                      <Check
                        aria-hidden="true"
                        className="size-4 text-primary group-hover:text-primary-foreground group-focus-visible:text-primary-foreground"
                      />
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
  trend,
  values,
}: {
  labels: readonly string[];
  title: string;
  trend?: {
    calendarSystem: TrendCalendarSystem;
    grain: TrendTemporalGrain;
  } | undefined;
  values: readonly number[];
}) {
  const temporalLabel = trend ? trendTemporalLabels[trend.grain] : null;
  const firstColumnLabel = trend
    ? trend.grain === 'hour'
      ? 'ساعت'
      : trend.grain === 'week'
        ? 'هفتهٔ شروع'
        : trend.grain === 'month'
          ? 'ماه'
          : 'روز'
    : 'دسته';
  return (
    <details className="mt-3 rounded-xl border border-border bg-surface">
      <summary className="cursor-pointer rounded-xl px-3 py-2 text-xs font-bold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background">
        {temporalLabel
          ? `خلاصهٔ ${temporalLabel} و جدول داده`
          : 'خلاصه متنی و جدول داده'}
      </summary>
      <div className="overflow-x-auto border-t border-border">
        {temporalLabel ? (
          <p className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
            تفکیک زمانی: <strong className="text-foreground">{temporalLabel}</strong>
          </p>
        ) : null}
        <table className="w-full min-w-72 text-xs">
          <caption className="sr-only">داده‌های نمودار {title}</caption>
          <thead className="bg-muted/60 text-foreground">
            <tr>
              <th className="px-3 py-2 text-start" scope="col">
                {firstColumnLabel}
              </th>
              <th className="px-3 py-2 text-end" scope="col">
                مقدار
              </th>
            </tr>
          </thead>
          <tbody>
            {values.map((value, index) => (
              <tr
                className="border-t border-border/70"
                key={`${labels[index]}-${index}`}
              >
                <th className="px-3 py-2 text-start font-medium" scope="row">
                  {trend
                    ? trendDateLabel(
                        labels[index] ?? '',
                        trend.calendarSystem,
                        trend.grain,
                        true,
                      )
                    : (labels[index] ?? `دسته ${index + 1}`)}
                </th>
                <td className="px-3 py-2 text-end font-bold tabular-nums">
                  {formatDashboardNumber(value)}
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
        <caption className="sr-only">
          {visualLabels[kind]} {title}
        </caption>
        <thead className="bg-slate-100/95 text-foreground dark:bg-slate-900/95">
          <tr>
            <th className="w-10 px-3 py-2.5 text-center" scope="col">
              #
            </th>
            <th className="px-3 py-2.5 text-start" scope="col">
              عنوان
            </th>
            <th className="px-3 py-2.5 text-end" scope="col">
              مقدار
            </th>
            <th className="w-40 px-3 py-2.5 text-start" scope="col">
              سهم مقایسه‌ای
            </th>
          </tr>
        </thead>
        <tbody>
          {labels.slice(0, 10).map((label, index) => (
            <tr
              className="border-t border-border/70 transition-colors odd:bg-surface even:bg-muted/20 hover:bg-blue-50/60 dark:hover:bg-blue-950/20"
              key={`${label}-${index}`}
            >
              <td className="px-3 py-2.5 text-center font-semibold text-muted-foreground">
                {formatDashboardNumber(index + 1)}
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
                {formatDashboardNumber(values[index] ?? 0)}
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
            <th className="px-3 py-2.5 text-start" scope="row">
              جمع نمایش‌داده‌شده
            </th>
            <td className="px-3 py-2.5 text-end tabular-nums">
              {formatDashboardNumber(total)}
            </td>
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
        `${labels[index] ?? `کارشناس ${index + 1}`}: ${formatDashboardNumber(value)}`,
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
            <div
              className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2.5"
              key={`${label}-${index}`}
            >
              <span
                aria-hidden="true"
                className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-cyan-100 to-blue-100 text-[10px] font-black text-blue-800 ring-1 ring-blue-200 dark:from-cyan-950 dark:to-blue-950 dark:text-blue-100 dark:ring-blue-800"
              >
                {label.trim().slice(0, 2)}
              </span>
              <span className="min-w-0">
                <span
                  className="block truncate text-xs font-bold text-foreground"
                  title={label}
                >
                  {label}
                </span>
                <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <span
                    aria-hidden="true"
                    className="block h-full rounded-full bg-gradient-to-l from-cyan-500 to-blue-600"
                    style={{
                      width: `${Math.max(4, (value / maximum) * 100)}%`,
                    }}
                  />
                </span>
              </span>
              <strong className="min-w-12 text-end text-xs tabular-nums text-foreground">
                {formatDashboardNumber(value)}
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
  range,
  title,
  trendCalendarSystem,
  values,
}: {
  kind: DashboardVisualKind;
  labels: readonly string[];
  range: DashboardRange;
  title: string;
  trendCalendarSystem: TrendCalendarSystem;
  values: readonly number[];
}) {
  const resolvedKind = dashboardVisualKindForData(kind, values);
  const maximum = Math.max(...values, 1);
  const total = values.reduce((sum, value) => sum + value, 0);
  const accessibleSummary = values
    .map(
      (value, index) =>
        `${labels[index] ?? `دسته ${index + 1}`}: ${formatDashboardNumber(value)}`,
    )
    .join('، ');

  if (resolvedKind === 'line') {
    const chartLeft = 100;
    const chartRight = 930;
    const chartTop = 18;
    const chartBottom = 140;
    const pointFor = (value: number, index: number, totalPoints: number) => ({
      x:
        totalPoints > 1
          ? chartLeft + (index * (chartRight - chartLeft)) / (totalPoints - 1)
          : (chartLeft + chartRight) / 2,
      y: chartBottom - (value / maximum) * (chartBottom - chartTop),
    });
    const points = values.map((value, index) => ({
      ...pointFor(value, index, values.length),
      value,
    }));
    const visibleLabelStep =
      labels.length > 12 ? Math.ceil(labels.length / 8) : 1;
    const axisLabelIndexes = labels
      .map((_, index) => index)
      .filter(
        (index) =>
          index % visibleLabelStep === 0 || index === labels.length - 1,
      );
    const temporalGrain = trendTemporalGrain(range, labels);
    return (
      <figure
        aria-label={`${visualLabels[resolvedKind]} ${title}. بازه انتخاب‌شده: ${accessibleSummary}`}
        className="rounded-xl border border-border/80 bg-background px-2 py-3 sm:px-3"
        role="img"
      >
        <svg
          aria-hidden="true"
          className="h-52 w-full"
          preserveAspectRatio="none"
          viewBox="0 0 1000 180"
        >
          {[0, 1, 2, 3, 4].map((index) => {
            const y = chartTop + (index * (chartBottom - chartTop)) / 4;
            const value = maximum * (1 - index / 4);
            return (
              <g key={y}>
                <line
                  className="text-border"
                  stroke="currentColor"
                  strokeDasharray="2 5"
                  strokeWidth="1"
                  x1={chartLeft}
                  x2={chartRight}
                  y1={y}
                  y2={y}
                />
                <text
                  className="fill-muted-foreground"
                  fontSize="10"
                  textAnchor="end"
                  x={chartLeft - 34}
                  y={y + 3}
                >
                  {compactChartValue(value)}
                </text>
              </g>
            );
          })}
          <polyline
            fill="none"
            points={points.map(({ x, y }) => `${x},${y}`).join(' ')}
            stroke="#172554"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />
          {points.map(({ x, y, value }, index) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} fill="#172554" r="3.5">
              <title>{`${trendTooltipTime(
                labels[index] ?? '',
                trendCalendarSystem,
                temporalGrain,
              )} — ${formatDashboardNumber(value)}`}</title>
            </circle>
          ))}
          {axisLabelIndexes.map((index) => {
            const point = points[index];
            if (!point) return null;
            return (
              <text
                className="fill-muted-foreground"
                fontSize="10"
                key={`${labels[index]}-${index}`}
                textAnchor="middle"
                x={point.x}
                y="162"
              >
                {trendDateLabel(
                  labels[index] ?? '',
                  trendCalendarSystem,
                  temporalGrain,
                )}
              </text>
            );
          })}
        </svg>
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
        <div
          aria-hidden="true"
          className="mb-2 flex flex-wrap items-center gap-4 text-[10px] font-bold text-muted-foreground"
        >
          <span className="inline-flex items-center gap-1.5">
            <i className="size-2.5 rounded-sm bg-blue-700" />
            مقدار
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="h-0.5 w-4 bg-amber-500" />
            میانگین روند
          </span>
        </div>
        <svg aria-hidden="true" className="h-48 w-full" viewBox="0 0 600 205">
          {[36, 75, 114, 154].map((y, index) => (
            <g key={y}>
              <line
                className="text-border"
                stroke="currentColor"
                strokeDasharray="4 5"
                x1="42"
                x2="582"
                y1={y}
                y2={y}
              />
              <text
                className="fill-muted-foreground text-[9px]"
                x="36"
                y={y + 3}
                textAnchor="end"
              >
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
                <rect
                  fill={index === 0 ? '#1e3a8a' : '#93a4c7'}
                  height={height}
                  rx="4"
                  width={width}
                  x={x}
                  y={154 - height}
                >
                  <title>{`${visibleLabels[index]}: ${formatDashboardNumber(value)}`}</title>
                </rect>
                <text
                  className="fill-muted-foreground text-[9px]"
                  textAnchor="middle"
                  x={x + width / 2}
                  y="176"
                >
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
            <circle
              cx={x}
              cy={y}
              fill="#fff"
              key={`${x}-${y}`}
              r="4"
              stroke="#d97706"
              strokeWidth="2"
            >
              <title>{`میانگین روند: ${formatDashboardNumber(rollingAverage[index] ?? 0, { maximumFractionDigits: 1 })}`}</title>
            </circle>
          ))}
        </svg>
        <figcaption className="sr-only">{accessibleSummary}</figcaption>
      </figure>
    );
  }

  if (resolvedKind === 'donut') {
    const colorByIndex = new Map(
      values
        .map((value, index) => ({ index, value }))
        .sort((left, right) => right.value - left.value)
        .map(({ index }, rank, rankedValues) => [
          index,
          comparisonRankColor(rank, rankedValues.length),
        ]),
    );
    const segments = values.map((value, index) => {
      const start =
        (values.slice(0, index).reduce((sum, item) => sum + item, 0) / total) *
        100;
      const end = start + (value / total) * 100;
      return {
        start,
        end,
        color:
          colorByIndex.get(index) ?? comparisonRankColor(index, values.length),
      };
    });
    const donutCenter = 220;
    const donutRadius = 110;
    const donutCenterY = 160;
    const externalLabels = values.map((value, index) => {
      const start =
        (values.slice(0, index).reduce((sum, item) => sum + item, 0) / total) *
        360;
      const end = start + (value / total) * 360;
      const radians = (((start + end) / 2 - 90) * Math.PI) / 180;
      const cosine = Math.cos(radians);
      const sine = Math.sin(radians);
      const ringEdgeX = donutCenter + cosine * donutRadius;
      const ringEdgeY = donutCenterY + sine * donutRadius;
      const lineEndX = donutCenter + cosine * (donutRadius + 12);
      const lineEndY = donutCenterY + sine * (donutRadius + 12);
      const onRight = cosine >= 0;
      const labelX = lineEndX + (onRight ? 17 : -17);
      const labelY = Math.min(276, Math.max(42, lineEndY));
      const connectorEndX = labelX + (onRight ? -4 : 4);
      return {
        color:
          colorByIndex.get(index) ?? comparisonRankColor(index, values.length),
        label: labels[index] ?? `دسته ${index + 1}`,
        connectorEndX,
        lineEndX,
        lineEndY,
        labelX,
        labelY,
        onRight,
        ringEdgeX,
        ringEdgeY,
        value,
      };
    });
    return (
      <figure
        aria-label={`${visualLabels[resolvedKind]} ${title}. ${accessibleSummary}`}
        className="rounded-xl border border-border/80 bg-muted/[0.12] p-3 sm:p-4"
        role="img"
      >
        <div
          aria-hidden="true"
          className="relative mx-auto h-64 w-full max-w-[26rem] sm:h-72"
        >
          <svg
            className="absolute inset-0 size-full"
            viewBox="0 0 440 320"
            direction="ltr"
          >
            {segments.map((segment, index) => (
              <circle
                key={index}
                cx={donutCenter}
                cy={donutCenterY}
                r={99}
                fill="none"
                stroke={segment.color}
                strokeWidth={22}
                pathLength={100}
                strokeDasharray={`${segment.end - segment.start} ${100 - (segment.end - segment.start)}`}
                strokeDashoffset={-segment.start}
                transform={`rotate(-90 ${donutCenter} ${donutCenterY})`}
              />
            ))}
            <text
              x={donutCenter}
              y={155}
              textAnchor="middle"
              className="fill-foreground font-semibold"
              fontSize="26"
            >
              {compactChartValue(total)}
            </text>
            <text
              x={donutCenter}
              y={181}
              textAnchor="middle"
              className="fill-foreground"
              fontSize="14"
            >
              مجموع
            </text>
            {externalLabels.map((item, index) => {
              const percent = formatDashboardNumber(
                (item.value / total) * 100,
                {
                  maximumFractionDigits: 1,
                },
              );
              const textY = item.labelY - 9;
              return (
                <g key={`${item.label}-${index}`}>
                  <polyline
                    fill="none"
                    points={`${item.ringEdgeX},${item.ringEdgeY} ${item.lineEndX},${item.lineEndY} ${item.connectorEndX},${item.labelY}`}
                    stroke="currentColor"
                    className="text-muted-foreground"
                    strokeLinecap="round"
                    strokeOpacity="0.85"
                    strokeWidth="0.8"
                  />
                  <text
                    className="fill-muted-foreground"
                    fontSize="12"
                    textAnchor={item.onRight ? 'start' : 'end'}
                    x={item.labelX}
                    y={textY}
                  >
                    <tspan x={item.labelX}>{item.label.slice(0, 18)}</tspan>
                    <tspan
                      className="fill-muted-foreground"
                      direction="ltr"
                      fontSize="12"
                      x={item.labelX}
                      dy="18"
                    >
                      {`${compactChartValue(item.value)} (${percent}%)`}
                    </tspan>
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        <figcaption className="sr-only">{accessibleSummary}</figcaption>
      </figure>
    );
  }

  if (resolvedKind === 'funnel') {
    return (
      <figure
        aria-label={`قیف ${title}. ${accessibleSummary}`}
        className="space-y-2 rounded-xl border border-border/80 bg-muted/[0.18] p-4"
        role="img"
      >
        {values.map((value, index) => (
          <div
            aria-hidden="true"
            className="mx-auto flex min-h-9 items-center justify-between rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground"
            key={`${labels[index]}-${index}`}
            style={{ width: `${Math.max(36, (value / maximum) * 100)}%` }}
          >
            <span className="truncate">{labels[index]}</span>
            <span>{formatDashboardNumber(value)}</span>
          </div>
        ))}
        <figcaption className="sr-only">{accessibleSummary}</figcaption>
      </figure>
    );
  }

  const rankedRows = values
    .map((value, index) => ({
      label: labels[index] ?? `دسته ${index + 1}`,
      value,
      index,
    }))
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
          <div
            aria-hidden="true"
            className="grid grid-cols-[minmax(6rem,0.8fr)_minmax(8rem,2fr)_auto] items-center gap-2.5"
            key={`${label}-${index}`}
          >
            <span className="truncate text-[11px] font-bold" title={label}>
              {label}
            </span>
            <span className="relative block h-5 overflow-hidden rounded-md bg-slate-200/80 dark:bg-slate-700/80">
              <span
                className="absolute inset-y-0 start-0 rounded-md"
                style={{
                  background: `linear-gradient(to left, ${comparisonRankColor(rank, rankedRows.length)}, ${comparisonRankColor(Math.min(rank + 1, rankedRows.length - 1), rankedRows.length)})`,
                  width: `${Math.max(2, (value / maximum) * 100)}%`,
                }}
              />
            </span>
            <strong className="min-w-14 text-end text-[11px] tabular-nums text-foreground">
              {compactChartValue(value)}
            </strong>
          </div>
        ))}
      </div>
      <figcaption className="sr-only">{accessibleSummary}</figcaption>
    </figure>
  );
}

export function dashboardReportCodeFromDrilldown(
  drilldown: string,
): string | undefined {
  try {
    const reportCode = new URL(
      drilldown,
      'https://dashboard.local',
    ).searchParams
      .get('report')
      ?.trim();
    return reportCode || undefined;
  } catch {
    return undefined;
  }
}

function ProjectionSlot({
  visualId,
  kind,
  title,
  description,
  decision,
  drilldown,
  onOpenReportConfiguration,
  onTrendCalendarSystemChange,
  range,
  trendCalendarSystem,
  wide = false,
  data,
}: {
  visualId: string;
  kind: DashboardVisualKind;
  title: string;
  description: string;
  decision?: string | undefined;
  drilldown: string;
  onOpenReportConfiguration(reportCode: string): void;
  onTrendCalendarSystemChange(value: TrendCalendarSystem): void;
  range: DashboardRange;
  trendCalendarSystem: TrendCalendarSystem;
  wide?: boolean;
  data?: DashboardVisualSnapshot | undefined;
}) {
  const [selectedCurrencyCode, setSelectedCurrencyCode] = useState<
    string | undefined
  >();
  const currencySeries = data?.currencySeries ?? [];
  const activeCurrencyCode = currencySeries.some(
    (series) => series.currencyCode === selectedCurrencyCode,
  )
    ? selectedCurrencyCode
    : (data?.currencyCode ?? currencySeries[0]?.currencyCode);
  const displayData = activeCurrencyCode
    ? (currencySeries.find(
        (series) => series.currencyCode === activeCurrencyCode,
      ) ?? data)
    : data;
  const resolvedKind = displayData?.values.length
    ? dashboardVisualKindForData(kind, displayData.values)
    : kind;
  const isEmployeeComparison =
    visualId.startsWith('employee-') &&
    (resolvedKind === 'bar' || resolvedKind === 'stacked-bar');
  const Icon = isEmployeeComparison ? UsersRound : visualIcons[resolvedKind];
  const visualLabel = isEmployeeComparison
    ? 'مقایسه عملکرد تیم'
    : visualLabels[resolvedKind];
  const reportCode = dashboardReportCodeFromDrilldown(drilldown);
  const report = reportCode
    ? reportCatalog.find((candidate) => candidate.code === reportCode)
    : undefined;
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
          <div
            className={cn(
              'flex max-w-full items-center gap-1.5',
              resolvedKind === 'line'
                ? 'flex-row flex-wrap justify-end'
                : 'flex-col items-end',
            )}
            data-dashboard-trend-controls={resolvedKind === 'line' || undefined}
          >
            {currencySeries.length ? (
              <Select
                value={activeCurrencyCode ?? currencySeries[0]?.currencyCode ?? ''}
                onValueChange={setSelectedCurrencyCode}
              >
                <SelectTrigger
                  aria-label={`واحد پول نمودار ${title}`}
                  className="h-7 min-w-28 border-border/80 bg-background px-2 text-[10px] font-bold"
                  data-dashboard-visual-currency-selector
                >
                  <CircleDollarSign aria-hidden="true" className="size-3.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencySeries.map((series) => {
                    const symbol = currencySymbols[series.currencyCode] ??
                      series.currencyCode;
                    return (
                      <SelectItem
                        className="data-[highlighted]:bg-primary data-[highlighted]:text-primary-foreground"
                        key={series.currencyCode}
                        value={series.currencyCode}
                      >
                        <bdi dir="ltr">{`${symbol} ${series.currencyCode}`}</bdi>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            ) : null}
            {resolvedKind === 'line' ? (
              <Select
                value={trendCalendarSystem}
                onValueChange={(value) =>
                  onTrendCalendarSystemChange(value as TrendCalendarSystem)
                }
              >
                <SelectTrigger
                  aria-label="تقویم برچسب‌های محور زمان"
                  className="h-7 min-w-28 border-border/80 bg-background px-2 text-[10px] font-bold"
                >
                  <CalendarCheck aria-hidden="true" className="size-3.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {trendCalendarOptions.map(([value, label]) => (
                    <SelectItem
                      className="data-[highlighted]:bg-primary data-[highlighted]:text-primary-foreground"
                      key={value}
                      value={value}
                    >
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
        </div>
      </div>
      <div className="relative flex-1 p-3.5">
        {displayData?.currencyCode ? (
          <span className="mb-2 block text-[11px] font-semibold text-muted-foreground">
            مبلغ فروش · <bdi dir="ltr">{displayData.currencyCode}</bdi>
          </span>
        ) : null}
        {displayData?.values.length ? (
          isEmployeeComparison ? (
            <EmployeePerformanceBars
              labels={displayData.labels}
              title={title}
              values={displayData.values}
            />
          ) : resolvedKind === 'table' || resolvedKind === 'queue' ? (
            <OperationalDataTable
              kind={resolvedKind}
              labels={displayData.labels}
              title={title}
              values={displayData.values}
            />
          ) : (
            <DashboardChart
              kind={kind}
              labels={displayData.labels}
              range={range}
              title={title}
              trendCalendarSystem={trendCalendarSystem}
              values={displayData.values}
            />
          )
        ) : (
          <>
            <EmptyVisualCanvas kind={kind} />
            <p className="sr-only">دادهٔ تأییدشده برای نمایش موجود نیست</p>
          </>
        )}
        {displayData?.values.length ? (
          <>
            {kind === 'donut' && resolvedKind !== 'donut' ? (
              <p className="mt-2 text-[11px] text-muted-foreground">
                به‌دلیل تعداد یا ماهیت دسته‌ها، سهم‌ها به‌صورت میله‌ای نمایش
                داده شده‌اند.
              </p>
            ) : null}
            {resolvedKind === 'table' || resolvedKind === 'queue' ? null : (
              <VisualDataSummary
                labels={displayData.labels}
                title={title}
                trend={
                  resolvedKind === 'line'
                    ? {
                        calendarSystem: trendCalendarSystem,
                        grain: trendTemporalGrain(range, displayData.labels),
                      }
                    : undefined
                }
                values={displayData.values}
              />
            )}
          </>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border/80 bg-muted/20 px-4 py-3">
        {decision ? (
          <Badge className="bg-amber-100 text-[10px] text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            {decision}
          </Badge>
        ) : null}
        <Button
          className="ms-auto"
          disabled={!report}
          onClick={() => {
            if (report) onOpenReportConfiguration(report.code);
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          {report ? 'بررسی گزارش مرتبط' : 'گزارش مرتبط در کاتالوگ موجود نیست'}
        </Button>
      </div>
    </Card>
  );
}

function DashboardSidebar({
  activePageId,
  activePanel,
  collapsed,
  expandedGroups,
  filterOptions,
  filters,
  isFetching,
  dateRangeError,
  onCollapseToggle,
  onPanelChange,
  onFiltersChange,
  onFiltersReset,
  onGroupToggle,
  onPageSelect,
  onRefresh,
}: {
  activePageId: string;
  activePanel: 'workspace' | 'filters';
  collapsed: boolean;
  expandedGroups: ReadonlySet<string>;
  filterOptions: DashboardFilterOptions | undefined;
  filters: DashboardFilters;
  isFetching: boolean;
  dateRangeError: string;
  onCollapseToggle(): void;
  onPanelChange(panel: 'workspace' | 'filters'): void;
  onFiltersChange(patch: Partial<DashboardFilters>): void;
  onFiltersReset(): void;
  onGroupToggle(pageId: string): void;
  onPageSelect(pageId: string): void;
  onRefresh(): void;
}) {
  const [dateCalendarSystem, setDateCalendarSystem] =
    useState<CalendarSystem>('persian');
  const activePage = dashboardPageById.get(activePageId);
  const activeFiltersTitle = activePage
    ? `فیلترهای ${activePage.title}`
    : 'فیلترهای این صفحه';

  return (
    <Card
      data-dashboard-sidebar
      className={cn(
        'self-start overflow-hidden transition-[width] duration-200 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto',
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
          <p className="text-xs font-bold text-primary">ناوبری</p>
          <h2 id="dashboard-pages-title" className="font-black">
            صفحه‌های داشبورد
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

      {collapsed ? (
        <div className="space-y-2 border-b border-border p-2">
          <Button
            aria-label="نمایش صفحه‌های داشبورد"
            className="size-10 w-full p-0"
            onClick={() => onPanelChange('workspace')}
            size="icon"
            title="صفحه‌های داشبورد"
            variant="ghost"
          >
            <LayoutDashboard aria-hidden="true" className="size-4" />
          </Button>
          <Button
            aria-label="نمایش فیلترهای این صفحه"
            className="size-10 w-full p-0"
            onClick={() => onPanelChange('filters')}
            size="icon"
            title="فیلترهای این صفحه"
            variant="ghost"
          >
            <Filter aria-hidden="true" className="size-4" />
          </Button>
        </div>
      ) : (
        <div
          className="grid grid-cols-2 gap-1 border-b border-border p-2"
          role="tablist"
        >
          <button
            aria-selected={activePanel === 'workspace'}
            className={cn(
              'min-h-10 rounded-xl px-2 text-xs font-black outline-none transition focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              activePanel === 'workspace'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
            onClick={() => onPanelChange('workspace')}
            role="tab"
            type="button"
          >
            صفحه‌های داشبورد
          </button>
          <button
            aria-selected={activePanel === 'filters'}
            className={cn(
              'min-h-10 rounded-xl px-2 text-xs font-black outline-none transition focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              activePanel === 'filters'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
            onClick={() => onPanelChange('filters')}
            role="tab"
            type="button"
          >
            فیلترهای این صفحه
          </button>
        </div>
      )}

      {activePanel === 'workspace' ? (
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
      ) : null}

      {activePanel === 'filters' ? (
        <section
          aria-label={collapsed ? activeFiltersTitle : undefined}
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
                aria-label={`پاک‌کردن ${activeFiltersTitle}`}
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
                  {activeFiltersTitle}
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
                        <SelectItem
                          className="data-[highlighted]:bg-primary data-[highlighted]:text-primary-foreground"
                          key={value}
                          value={value}
                        >
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                <div className="space-y-3 rounded-xl bg-muted/30 p-3">
                  {[
                    ...(dashboardPageFilterKeys[activePageId] ?? []).filter(
                      (key) => key === 'currency',
                    ),
                    ...(dashboardPageFilterKeys[activePageId] ?? []).filter(
                      (key) => key !== 'currency',
                    ),
                  ].map((key) => {
                    const copy = filterCopyForPage(activePageId, key);
                    return (
                      <DimensionFilter
                        allLabel={copy.allLabel}
                        id={`dashboard-filter-${key}`}
                        key={key}
                        label={copy.label}
                        loading={isFetching}
                        onChange={(value) => onFiltersChange({ [key]: value })}
                        options={filterOptions?.[key] ?? []}
                        value={filters[key]}
                      />
                    );
                  })}
                  {!(dashboardPageFilterKeys[activePageId] ?? []).length ? (
                    <p className="text-[11px] leading-5 text-muted-foreground">
                      <Info
                        aria-hidden="true"
                        className="me-1 inline size-3.5"
                      />
                      برای این صفحه فیلتر تکمیلی منتشر نشده است.
                    </p>
                  ) : null}
                </div>

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
      ) : null}
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [reportConfigurationCode, setReportConfigurationCode] = useState<
    string | null
  >(null);
  const [sidebarPanel, setSidebarPanel] = useState<'workspace' | 'filters'>(
    'workspace',
  );
  const [expandedGroups, setExpandedGroups] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [trendCalendarSystem, setTrendCalendarSystem] =
    useState<TrendCalendarSystem>('persian');
  const legalEntity = useLegalEntityContext();
  const selection = legalEntity.context?.selection ?? null;
  const activePage =
    dashboardPages.find((page) => page.id === filters.page) ??
    dashboardPages[0]!;
  const ActivePageIcon = navigationIcons[activePage.id] ?? LayoutDashboard;
  const activePageHeaderTheme =
    dashboardHeaderThemeByPageId[activePage.id] ??
    dashboardHeaderThemeByPageId['executive-overview'];
  const activePageHeaderArtwork =
    dashboardHeaderArtworkByPageId[activePage.id] ??
    dashboardHeaderArtworkByPageId['executive-overview'] ??
    '/images/dashboard-headers/executive-overview.png';
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
  const openReportConfiguration = (reportCode: string) => {
    setReportConfigurationCode(reportCode);
  };
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
          activePanel={sidebarPanel}
          collapsed={sidebarCollapsed}
          dateRangeError={dateRangeError}
          expandedGroups={expandedGroups}
          filterOptions={query.data?.filterOptions}
          filters={filters}
          isFetching={query.isFetching}
          onCollapseToggle={() => setSidebarCollapsed((value) => !value)}
          onPanelChange={(panel) => {
            setSidebarPanel(panel);
            setSidebarCollapsed(false);
          }}
          onFiltersChange={updateFilters}
          onFiltersReset={resetFilters}
          onGroupToggle={toggleNavigationGroup}
          onPageSelect={selectPage}
          onRefresh={() => void query.refetch()}
        />

        <div className="min-w-0 space-y-5">
          <section aria-labelledby="active-dashboard-page-title">
            <div className="space-y-4">
              <header
                className={cn(
                  'relative isolate overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-bl p-4 shadow-sm sm:p-5',
                  activePageHeaderTheme,
                )}
              >
                <Image
                  alt=""
                  aria-hidden="true"
                  className="pointer-events-none object-cover object-right opacity-100 dark:opacity-55"
                  fill
                  quality={45}
                  sizes="(min-width: 1024px) 72vw, 100vw"
                  src={activePageHeaderArtwork}
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-gradient-to-l from-surface/55 via-surface/25 to-transparent dark:from-surface/80 dark:via-surface/45 dark:to-surface/10"
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -end-14 -top-14 size-40 rounded-full bg-primary/10 blur-3xl"
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -start-16 bottom-0 size-32 rounded-full bg-cyan-400/10 blur-3xl"
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -bottom-10 -end-2 text-primary/[0.055] dark:text-primary/[0.12]"
                >
                  <ActivePageIcon className="size-44 stroke-[1.15] sm:size-52" />
                </span>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-10 bottom-0 h-px bg-gradient-to-l from-transparent via-primary/25 to-transparent"
                />
                <div className="relative mx-auto flex max-w-3xl flex-col items-center text-center">
                  <span className="mb-2 grid size-10 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15 shadow-sm">
                    <ActivePageIcon aria-hidden="true" className="size-5" />
                  </span>
                  <h2
                    id="active-dashboard-page-title"
                    className="text-2xl font-black tracking-tight text-foreground sm:text-3xl"
                  >
                    {activePage.title}
                  </h2>
                  <p
                    className="mt-1 text-xs font-bold tracking-wide text-primary"
                    dir="ltr"
                  >
                    {activePage.technicalName}
                  </p>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                    {activePage.description}
                  </p>
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
                      decision={visualization.openDecision}
                      drilldown={visualization.drilldown}
                      onOpenReportConfiguration={openReportConfiguration}
                      onTrendCalendarSystemChange={setTrendCalendarSystem}
                      range={filters.range}
                      trendCalendarSystem={trendCalendarSystem}
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
              metric={query.data?.metrics[selectedKpi.id]}
              onClose={() => updateFilters({ widget: null })}
              onOpenReportConfiguration={openReportConfiguration}
            />
          ) : null}

          {reportConfigurationCode ? (
            <ReportingWorkspace
              configurationOnly
              initialFilterState={{
                reportCode: reportConfigurationCode,
                fromDate: '',
                toDate: '',
                legalEntity: 'ALL',
                currency: 'ALL',
                filterValues: {},
              }}
              key={reportConfigurationCode}
              onConfigurationOpenChange={(open) => {
                if (!open) setReportConfigurationCode(null);
              }}
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}
