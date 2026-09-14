'use client';

import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  BriefcaseBusiness,
  CalendarRange,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  CircleDollarSign,
  Clock3,
  DatabaseZap,
  Filter,
  Info,
  LayoutDashboard,
  LineChart,
  ListFilter,
  LockKeyhole,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  TrendingUp,
  UserRoundCog,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import {
  FormField,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/form-controls';
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
import { dashboardProjectionClient } from '../model/projection-client';
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

const dimensionFilters: readonly {
  key: keyof DashboardFilters;
  label: string;
}[] = [
  { key: 'salesChannel', label: 'سایت / کانال فروش' },
  { key: 'branch', label: 'شعبه' },
  { key: 'agent', label: 'کارشناس' },
  { key: 'service', label: 'نوع خدمت' },
  { key: 'agency', label: 'آژانس' },
  { key: 'provider', label: 'Provider' },
  { key: 'currency', label: 'ارز' },
  { key: 'status', label: 'وضعیت' },
];

const visualIcons: Record<DashboardVisualKind, typeof BarChart3> = {
  line: LineChart,
  bar: BarChart3,
  'stacked-bar': BarChart3,
  funnel: ListFilter,
  table: ListFilter,
  queue: AlertTriangle,
};

const visualLabels: Record<DashboardVisualKind, string> = {
  line: 'نمودار روند',
  bar: 'نمودار مقایسه‌ای',
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

const navigationIcons: Record<string, LucideIcon> = {
  'executive-overview': LayoutDashboard,
  'commercial-performance': BriefcaseBusiness,
  'finance-treasury': WalletCards,
  'customer-growth': UsersRound,
  'workforce-hr': UserRoundCog,
};

function EmptyMetric({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn('flex items-end gap-2', compact ? 'mt-2' : 'mt-4')}>
      <span
        className={cn(
          'font-black tracking-tight text-foreground',
          compact ? 'text-2xl' : 'text-3xl',
        )}
        aria-label="داده‌ای دریافت نشده"
      >
        —
      </span>
      <span className="pb-1 text-[11px] font-semibold text-muted-foreground">
        بدون دادهٔ تأییدشده
      </span>
    </div>
  );
}

function KpiCard({
  definition,
  selected,
  onSelect,
  featured = false,
}: {
  definition: DashboardKpiDefinition;
  selected: boolean;
  onSelect(): void;
  featured?: boolean;
}) {
  return (
    <button
      aria-expanded={selected}
      className={cn(
        'group min-w-0 rounded-2xl border bg-surface p-4 text-start shadow-sm outline-none transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring',
        selected ? 'border-primary ring-2 ring-primary/15' : 'border-border',
        featured && 'min-h-44',
      )}
      onClick={onSelect}
      type="button"
    >
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="block text-sm font-black text-foreground">
              {definition.title}
            </span>
            {definition.role ? (
              <Badge className="bg-blue-50 text-[10px] text-blue-700 dark:bg-blue-950/50 dark:text-blue-200">
                {kpiRoleLabels[definition.role]}
              </Badge>
            ) : null}
          </span>
          <span
            className="mt-1 block truncate text-[11px] text-muted-foreground"
            dir="ltr"
          >
            {definition.technicalName}
          </span>
        </span>
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
          {definition.currency === 'required' ? (
            <CircleDollarSign aria-hidden="true" className="size-4" />
          ) : (
            <TrendingUp aria-hidden="true" className="size-4" />
          )}
        </span>
      </span>
      <EmptyMetric compact={!featured} />
      <span className="mt-3 flex flex-wrap gap-1.5">
        <Badge className="bg-muted text-[10px] text-muted-foreground">
          مبنا: {definition.dateBasis}
        </Badge>
        <Badge className="bg-muted text-[10px] text-muted-foreground">
          {definition.currency === 'required'
            ? 'ارز/FX الزامی'
            : 'بدون واحد پول'}
        </Badge>
        {definition.reportCode ? (
          <Badge className="bg-muted text-[10px] text-muted-foreground">
            {definition.reportCode}
          </Badge>
        ) : null}
      </span>
      {definition.decision ? (
        <span className="mt-3 block text-xs leading-5 text-muted-foreground">
          <span className="font-bold text-foreground">تصمیم: </span>
          {definition.decision}
        </span>
      ) : null}
      <span className="mt-3 block text-[11px] font-semibold text-primary">
        جزئیات تعریف شاخص
      </span>
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
    <Card
      className="border-primary/30 bg-primary/[0.025] p-4"
      role="region"
      aria-label={`تعریف ${definition.title}`}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-bold text-primary">تعریف قابل ممیزی KPI</p>
          <h3 className="mt-1 text-lg font-black">
            {definition.title}{' '}
            <span
              className="text-sm font-medium text-muted-foreground"
              dir="ltr"
            >
              ({definition.technicalName})
            </span>
          </h3>
        </div>
        <Button onClick={onClose} size="sm" variant="ghost">
          بستن جزئیات
        </Button>
      </div>
      <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
        <div className="md:col-span-2 xl:col-span-4">
          <dt className="text-xs font-bold text-muted-foreground">
            تعریف کوتاه
          </dt>
          <dd className="mt-1 leading-6">
            معیاری برای پایش {definition.title} در سطح {definition.grain}؛ این
            شاخص برای پاسخ به این تصمیم استفاده می‌شود: {definition.decision}
          </dd>
        </div>
        <div className="md:col-span-2 xl:col-span-4">
          <dt className="text-xs font-bold text-muted-foreground">
            فرمول محاسبه / قاعده اندازه‌گیری
          </dt>
          <dd className="mt-1 rounded-xl bg-surface/80 p-3 leading-6">
            {definition.rule}
          </dd>
        </div>
        <div className="md:col-span-2 xl:col-span-4">
          <dt className="text-xs font-bold text-muted-foreground">
            فیچرها و منابع مورد استفاده
          </dt>
          <dd className="mt-2 flex flex-wrap gap-2">
            {definition.source.map((source) => (
              <Badge className="font-mono text-[11px]" dir="ltr" key={source}>
                {source}
              </Badge>
            ))}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-bold text-muted-foreground">Grain</dt>
          <dd className="mt-1 leading-6">{definition.grain}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold text-muted-foreground">
            Reporting View
          </dt>
          <dd
            className="mt-1 break-words font-mono text-xs leading-6"
            dir="ltr"
          >
            {definition.source.join(' + ')}
          </dd>
        </div>
        {definition.comparison ? (
          <div>
            <dt className="text-xs font-bold text-muted-foreground">
              مقایسه لازم
            </dt>
            <dd className="mt-1 leading-6">{definition.comparison}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-xs font-bold text-muted-foreground">
            حذف‌ها / محدودیت
          </dt>
          <dd className="mt-1 leading-6">{definition.exclusions}</dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3 text-xs">
        <Badge>
          Permission آینده:{' '}
          <span dir="ltr" className="ms-1">
            {definition.permission}
          </span>
        </Badge>
        <Badge>تاریخ: {definition.dateBasis}</Badge>
        {definition.openDecision ? (
          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            وابسته به {definition.openDecision}
          </Badge>
        ) : null}
        {report ? (
          <Button asChild size="sm" variant="outline">
            <Link href={reportHref}>
              پیکربندی گزارش مرتبط
              <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </Link>
          </Button>
        ) : (
          <Button disabled size="sm" variant="outline">
            گزارش مرتبط در کاتالوگ موجود نیست
          </Button>
        )}
      </div>
    </Card>
  );
}

function DimensionFilter({ label }: { label: string }) {
  return (
    <FormField label={label}>
      <Select disabled value="all">
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">همه — در انتظار Projection</SelectItem>
        </SelectContent>
      </Select>
    </FormField>
  );
}

function ProjectionSlot({
  kind,
  title,
  description,
  source,
  decision,
  drilldown,
}: {
  kind: DashboardVisualKind;
  title: string;
  description: string;
  source: readonly string[];
  decision?: string | undefined;
  drilldown: string;
}) {
  const Icon = visualIcons[kind];
  return (
    <div className="min-w-0 rounded-2xl border border-dashed border-blue-200 bg-blue-50/30 p-4 dark:border-blue-900 dark:bg-blue-950/10">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-blue-700 shadow-sm dark:bg-blue-950 dark:text-blue-300">
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-black">{title}</h3>
            <Badge className="bg-white text-[10px] text-blue-700 dark:bg-blue-950 dark:text-blue-200">
              {visualLabels[kind]}
            </Badge>
          </div>
          <p className="mt-1 text-xs leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      <div className="relative mt-5 grid min-h-40 place-items-center overflow-hidden rounded-xl border border-border/70 bg-surface/70 p-4 text-center">
        <span className="pointer-events-none absolute inset-x-4 bottom-8 border-t border-dashed border-border" />
        <span className="pointer-events-none absolute inset-y-4 right-8 border-r border-dashed border-border" />
        <div>
          <DatabaseZap
            aria-hidden="true"
            className="mx-auto size-6 text-muted-foreground"
          />
          <p className="mt-2 text-xs font-black">
            {visualLabels[kind]} آماده است؛ داده‌ای رسم نشده
          </p>
          <p
            className="mt-1 break-words font-mono text-[10px] leading-5 text-muted-foreground"
            dir="ltr"
          >
            {source.join(' + ')}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold text-muted-foreground">
          در انتظار دادهٔ تأییدشده
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
    </div>
  );
}

function DashboardSidebar({
  activePageId,
  collapsed,
  expandedGroups,
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
  return (
    <Card
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
                    'flex min-h-11 min-w-0 flex-1 items-center rounded-xl text-start text-sm font-bold outline-none transition focus-visible:ring-2 focus-visible:ring-ring',
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
                    className="grid size-10 shrink-0 place-items-center rounded-xl text-muted-foreground outline-none transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
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
                          'flex min-h-10 w-full items-center rounded-lg px-3 text-start text-xs font-bold outline-none transition focus-visible:ring-2 focus-visible:ring-ring',
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
                      gregorianEnglish
                      id="dashboard-from"
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
                      gregorianEnglish
                      id="dashboard-to"
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
                  <SelectTrigger id="dashboard-range">
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
                  {dimensionFilters.map((item) => (
                    <DimensionFilter key={item.key} label={item.label} />
                  ))}
                  <p className="text-[11px] leading-5 text-muted-foreground">
                    <Info aria-hidden="true" className="me-1 inline size-3.5" />
                    ابعاد پس از انتشار قرارداد فیلتر نسخه‌دار فعال می‌شوند.
                  </p>
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
    () => new Set(['commercial-performance', 'customer-growth']),
  );
  const legalEntity = useLegalEntityContext();
  const selection = legalEntity.context?.selection ?? null;
  const query = useQuery({
    queryKey: ['dashboard-public-projection-v1', filters, selection],
    queryFn: ({ signal }) =>
      dashboardProjectionClient.load({
        filters,
        legalEntity: selection,
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
  const selectedKpi =
    dashboardKpis.find((item) => item.id === filters.widget) ?? null;
  const activePage =
    dashboardPages.find((page) => page.id === filters.page) ??
    dashboardPages[0]!;
  const activePageKpis = dashboardKpis.filter((kpi) =>
    activePage.kpiIds.includes(kpi.id),
  );

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
          onPageSelect={(page) => updateFilters({ page, widget: null })}
          onRefresh={() => void query.refetch()}
        />

        <div className="min-w-0 space-y-5">
          <section aria-labelledby="active-dashboard-page-title">
            <Card className="overflow-hidden p-4 sm:p-5">
              <div className="border-b border-border pb-4">
                <div>
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <h2
                      id="active-dashboard-page-title"
                      className="text-xl font-black"
                    >
                      {activePage.title}
                    </h2>
                    <span className="text-xs font-bold text-primary" dir="ltr">
                      {activePage.technicalName}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {activePage.description}
                  </p>
                </div>
              </div>

              {activePageKpis.length > 0 ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {activePageKpis.map((item) => (
                    <KpiCard
                      key={item.id}
                      definition={item}
                      featured
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
                <p className="mt-4 rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
                  برای این صفحه هنوز KPI تأییدشده‌ای در Projection عمومی منتشر
                  نشده است.
                </p>
              )}

              <div className="mt-4 grid gap-3 xl:grid-cols-2">
                {activePage.visualizations.map((visualization) => (
                  <ProjectionSlot
                    key={visualization.id}
                    kind={visualization.kind}
                    title={visualization.title}
                    description={visualization.description}
                    source={visualization.source}
                    decision={visualization.openDecision}
                    drilldown={visualization.drilldown}
                  />
                ))}
              </div>
            </Card>
          </section>

          {selectedKpi ? (
            <KpiDefinitionPanel
              definition={selectedKpi}
              onClose={() => updateFilters({ widget: null })}
            />
          ) : null}

          <section className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
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
              <p className="mt-4 border-t border-border pt-3 text-[11px] leading-6 text-muted-foreground">
                metadata آینده: generatedAt، dataAsOf، timezone، dateBasis،
                currencyFxBasis، filters، reportVersion و permissionSnapshot.
              </p>
            </Card>
          </section>
        </div>
      </section>
    </div>
  );
}
