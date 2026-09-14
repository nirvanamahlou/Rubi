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
import type { CalendarSystem } from '@/components/ui/date-picker.utils';
import {
  FormField,
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
      aria-controls="kpi-definition-panel"
      aria-expanded={selected}
      aria-haspopup="dialog"
      className={cn(
        'group relative min-h-48 min-w-0 overflow-hidden rounded-2xl border bg-surface p-4 text-start shadow-sm outline-none transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ring',
        selected ? 'border-primary ring-2 ring-primary/15' : 'border-border',
        featured && 'bg-gradient-to-bl from-blue-50/60 via-surface to-surface dark:from-blue-950/20',
      )}
      onClick={onSelect}
      type="button"
    >
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="block text-[15px] font-black text-foreground">
              {definition.title}
            </span>
            {definition.role ? (
              <Badge className="bg-blue-50 text-[10px] text-blue-700 dark:bg-blue-950/50 dark:text-blue-200">
                {kpiRoleLabels[definition.role]}
              </Badge>
            ) : null}
          </span>
          <span className="mt-1.5 block text-xs leading-5 text-muted-foreground">
            شاخص {definition.role === 'outcome' ? 'نتیجه' : 'عملکرد'} در بازه
            انتخاب‌شده
          </span>
        </span>
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-900">
          {definition.currency === 'required' ? (
            <CircleDollarSign aria-hidden="true" className="size-5" />
          ) : (
            <TrendingUp aria-hidden="true" className="size-5" />
          )}
        </span>
      </span>
      <EmptyMetric compact />
      <span className="mt-4 flex flex-wrap gap-1.5 border-t border-border/80 pt-3">
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

            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border p-3">
                <dt className="text-xs font-bold text-muted-foreground">
                  سطح محاسبه (Grain)
                </dt>
                <dd className="mt-1 leading-6">{definition.grain}</dd>
              </div>
              <div className="rounded-xl border border-border p-3">
                <dt className="text-xs font-bold text-muted-foreground">
                  مبنای زمانی
                </dt>
                <dd className="mt-1 leading-6" dir="ltr">
                  {definition.dateBasis}
                </dd>
              </div>
              <div className="rounded-xl border border-border p-3">
                <dt className="text-xs font-bold text-muted-foreground">
                  سیاست واحد پول
                </dt>
                <dd className="mt-1 leading-6">
                  {definition.currency === 'required'
                    ? 'ارز و سیاست تبدیل FX الزامی است.'
                    : 'واحد پول برای این شاخص کاربرد ندارد.'}
                </dd>
              </div>
              <div className="rounded-xl border border-border p-3">
                <dt className="text-xs font-bold text-muted-foreground">
                  مبنای مقایسه
                </dt>
                <dd className="mt-1 leading-6">{definition.comparison}</dd>
              </div>
            </dl>

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

function EmptyVisualCanvas({ kind }: { kind: DashboardVisualKind }) {
  if (kind === 'table' || kind === 'queue') {
    return (
      <div
        aria-label={`نمای خالی ${visualLabels[kind]}`}
        className="overflow-hidden rounded-xl border border-border/80 bg-muted/[0.18]"
      >
        <div className="grid grid-cols-4 gap-3 border-b border-border/80 bg-muted/45 px-4 py-2.5">
          {[0, 1, 2, 3].map((item) => (
            <span className="h-2 rounded-full bg-muted-foreground/15" key={item} />
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
        className="grid min-h-44 place-items-center rounded-xl border border-border/80 bg-muted/[0.18] p-5"
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

  return (
    <div
      aria-label={`نمای خالی ${visualLabels[kind]}`}
      className="relative min-h-44 overflow-hidden rounded-xl border border-border/80 bg-[linear-gradient(to_bottom,transparent_24%,hsl(var(--border)/0.55)_25%,transparent_26%,transparent_49%,hsl(var(--border)/0.55)_50%,transparent_51%,transparent_74%,hsl(var(--border)/0.55)_75%,transparent_76%)]"
    >
      <span className="absolute inset-y-4 right-9 border-r border-border/80" />
      <span className="absolute inset-x-4 bottom-9 border-t border-border/80" />
      {kind === 'bar' || kind === 'stacked-bar' ? (
        <div aria-hidden="true" className="absolute inset-x-14 bottom-10 flex h-20 items-end justify-between gap-3 opacity-35">
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

function ProjectionSlot({
  kind,
  title,
  description,
  source,
  decision,
  drilldown,
  featured = false,
}: {
  kind: DashboardVisualKind;
  title: string;
  description: string;
  source: readonly string[];
  decision?: string | undefined;
  drilldown: string;
  featured?: boolean;
}) {
  const Icon = visualIcons[kind];
  return (
    <Card
      className={cn(
        'min-w-0 overflow-hidden p-4 shadow-sm',
        featured && 'xl:col-span-2',
      )}
    >
      <div className="flex items-start justify-between gap-3">
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
        <Badge className="shrink-0 bg-blue-50 text-[10px] text-blue-700 dark:bg-blue-950/50 dark:text-blue-200">
          {visualLabels[kind]}
        </Badge>
      </div>
      <div className="relative mt-4">
        <EmptyVisualCanvas kind={kind} />
        <div className="pointer-events-none absolute inset-0 grid place-items-center p-4 text-center">
          <div className="max-w-xs rounded-xl border border-border/80 bg-surface/95 px-4 py-3 shadow-sm backdrop-blur-sm">
            <DatabaseZap
              aria-hidden="true"
              className="mx-auto size-5 text-blue-700 dark:text-blue-300"
            />
            <p className="mt-1.5 text-xs font-black text-foreground">
              دادهٔ تأییدشده برای نمایش موجود نیست
            </p>
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/80 pt-3">
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
  const [dateCalendarSystem, setDateCalendarSystem] =
    useState<CalendarSystem>('persian');

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
                      calendarSystem={dateCalendarSystem}
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
            <div className="space-y-4">
              <header className="border-b border-border pb-4 sm:flex sm:items-end sm:justify-between sm:gap-4">
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
                <span className="mt-3 inline-flex rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-200 sm:mt-0">
                  KPI و تحلیل‌های عملیاتی
                </span>
              </header>

              {activePageKpis.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
                <p className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
                  برای این صفحه هنوز KPI تأییدشده‌ای در Projection عمومی منتشر
                  نشده است.
                </p>
              )}

              <div className="grid gap-4 xl:grid-cols-2">
                {activePage.visualizations.map((visualization, index) => (
                  <ProjectionSlot
                    featured={index === 0}
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
            </div>
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
