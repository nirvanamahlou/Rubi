'use client';

import {
  AlertTriangle,
  ArrowDownUp,
  Banknote,
  BarChart3,
  Building2,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Coins,
  Eye,
  FilePenLine,
  FileSpreadsheet,
  Landmark,
  LockKeyhole,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/overlays';
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  FilterBar,
  PageHeader,
  PaginationShell,
  Skeleton,
} from '@/components/ui/surfaces';
import {
  FINANCE_PREVIEW_NOTICE,
  FINANCE_UI_CONTRACT_VERSION,
  financePreviewEndpointRoutes,
  normalizeFinanceWorkspaceQuery,
  type FinancePreviewState,
  type FinanceWorkspaceGroup,
} from '../api/contracts';
import {
  filterFinanceFeatures,
  filterFinanceRecords,
  financeGroupLabels,
  financePreviewRecords,
  paginateFinanceRecords,
  type FinanceFeature,
  type FinancePreviewRecord,
} from '../model/finance';
import {
  FinancePreviewForm,
  type FinanceFormKind,
  type FinanceFormMode,
} from './finance-preview-form';

type WorkspaceTab =
  'overview' | 'capabilities' | 'operations' | 'release' | 'reports';

const previewStates: readonly [FinancePreviewState, string][] = [
  ['preview', 'Preview'],
  ['loading', 'Loading'],
  ['empty', 'Empty'],
  ['error', 'Error'],
  ['forbidden', 'Forbidden'],
];

const groupIcons: Readonly<Record<FinanceWorkspaceGroup, LucideIcon>> = {
  ledger: Landmark,
  treasury: WalletCards,
  'sales-purchase': ReceiptText,
  'travel-settlement': CircleDollarSign,
  planning: CalendarClock,
  reporting: BarChart3,
};

const statusLabels: Readonly<Record<FinancePreviewRecord['status'], string>> = {
  DRAFT: 'پیش‌نویس',
  PENDING_APPROVAL: 'در انتظار تایید',
  APPROVED: 'تاییدشده',
  CONDITIONAL: 'مشروط',
  BLOCKED: 'مسدود',
};

const kindLabels: Readonly<Record<FinancePreviewRecord['kind'], string>> = {
  RECEIPT: 'دریافت',
  PAYMENT: 'پرداخت',
  CHECK: 'چک',
  INVOICE: 'فاکتور',
  JOURNAL: 'سند',
  RELEASE: 'آزادسازی',
};

function formatMoney(amount: string, currencyCode: string) {
  const parts = amount.split('.');
  const integer = parts[0] ?? '0';
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
  return grouped + (parts[1] ? '٫' + parts[1] : '') + ' ' + currencyCode;
}

function SummaryCard({
  detail,
  icon: Icon,
  label,
  tone = 'primary',
  value,
}: {
  detail: string;
  icon: LucideIcon;
  label: string;
  tone?: 'primary' | 'warning' | 'danger' | 'success';
  value: string;
}) {
  const toneClass =
    tone === 'danger'
      ? 'bg-destructive/10 text-destructive'
      : tone === 'warning'
        ? 'bg-amber-500/10 text-amber-700'
        : tone === 'success'
          ? 'bg-emerald-500/10 text-emerald-700'
          : 'bg-primary/10 text-primary';
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">{label}</p>
          <p className="mt-2 text-xl font-black">{value}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
        </div>
        <span
          className={'grid size-11 place-items-center rounded-2xl ' + toneClass}
        >
          <Icon aria-hidden="true" className="size-5" />
        </span>
      </div>
    </Card>
  );
}

function StatePanel({
  onRetry,
  state,
}: {
  onRetry: () => void;
  state: Exclude<FinancePreviewState, 'preview'>;
}) {
  if (state === 'loading') {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton className="h-40 w-full" key={index} />
        ))}
      </div>
    );
  }
  if (state === 'empty') {
    return (
      <EmptyState
        description="هیچ رکوردی مطابق فیلتر وجود ندارد."
        title="نتیجه مالی پیدا نشد"
      />
    );
  }
  if (state === 'forbidden') {
    return (
      <EmptyState
        description="دسترسی Finance به‌صورت deny-by-default و branch-scoped است."
        icon={ShieldAlert}
        title="دسترسی مالی مجاز نیست"
      />
    );
  }
  return (
    <ErrorState
      action={
        <Button onClick={onRetry} type="button" variant="outline">
          <RefreshCw className="size-4" />
          تلاش دوباره
        </Button>
      }
      description="این خطا فقط UI State است و درخواست شبکه اجرا نشده."
      title="خطای نمایشی"
    />
  );
}

function FinanceFilters({
  onChange,
  query,
}: {
  onChange: (query: ReturnType<typeof normalizeFinanceWorkspaceQuery>) => void;
  query: ReturnType<typeof normalizeFinanceWorkspaceQuery>;
}) {
  return (
    <FilterBar className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <FormField id="finance-search" label="جست‌وجوی سراسری مالی">
        <div className="relative">
          <Search className="absolute end-3 top-3.5 size-4 text-muted-foreground" />
          <Input
            className="pe-10"
            id="finance-search"
            onChange={(event) =>
              onChange({ ...query, search: event.target.value, page: 1 })
            }
            placeholder="حساب، چک، قرارداد، طرف‌حساب..."
            value={query.search}
          />
        </div>
      </FormField>
      <FormField label="شعبه">
        <Select
          onValueChange={(value) =>
            onChange({ ...query, branchReference: value, page: 1 })
          }
          value={query.branchReference}
        >
          <SelectTrigger aria-label="فیلتر شعبه">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">همه شعب</SelectItem>
            <SelectItem value="شعبه نمونه مرکزی">شعبه نمونه مرکزی</SelectItem>
            <SelectItem value="شعبه نمونه غرب">شعبه نمونه غرب</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      <FormField label="دوره مالی">
        <Select
          onValueChange={(value) =>
            onChange({ ...query, fiscalPeriodReference: value, page: 1 })
          }
          value={query.fiscalPeriodReference}
        >
          <SelectTrigger aria-label="فیلتر دوره مالی">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">همه دوره‌ها</SelectItem>
            <SelectItem value="دوره نمونه ۱۴۰۵-۰۱">
              دوره نمونه ۱۴۰۵-۰۱
            </SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      <FormField label="ارز">
        <Select
          onValueChange={(value) =>
            onChange({
              ...query,
              currencyCode: value as ReturnType<
                typeof normalizeFinanceWorkspaceQuery
              >['currencyCode'],
              page: 1,
            })
          }
          value={query.currencyCode}
        >
          <SelectTrigger aria-label="فیلتر ارز">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">همه ارزها</SelectItem>
            {['IRR', 'USD', 'EUR', 'TRY', 'AED'].map((currency) => (
              <SelectItem key={currency} value={currency}>
                {currency}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      <FormField label="وضعیت">
        <Select
          onValueChange={(value) =>
            onChange({ ...query, status: value, page: 1 })
          }
          value={query.status}
        >
          <SelectTrigger aria-label="فیلتر وضعیت">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">همه وضعیت‌ها</SelectItem>
            {Object.entries(statusLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      <FormField id="finance-party-filter" label="طرف‌حساب">
        <Input
          id="finance-party-filter"
          onChange={(event) =>
            onChange({ ...query, partyReference: event.target.value, page: 1 })
          }
          placeholder="نام synthetic"
          value={query.partyReference}
        />
      </FormField>
      <FormField label="مرتب‌سازی">
        <Select
          onValueChange={(value) =>
            onChange({
              ...query,
              sortBy: value as ReturnType<
                typeof normalizeFinanceWorkspaceQuery
              >['sortBy'],
            })
          }
          value={query.sortBy}
        >
          <SelectTrigger aria-label="مرتب‌سازی">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updatedAt">آخرین تغییر</SelectItem>
            <SelectItem value="dueAt">سررسید</SelectItem>
            <SelectItem value="amount">مبلغ</SelectItem>
            <SelectItem value="status">وضعیت</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      <Button
        onClick={() =>
          onChange({
            ...query,
            sortDirection: query.sortDirection === 'asc' ? 'desc' : 'asc',
          })
        }
        type="button"
        variant="outline"
      >
        <ArrowDownUp className="size-4" />
        {query.sortDirection === 'asc' ? 'صعودی' : 'نزولی'}
      </Button>
    </FilterBar>
  );
}

function FeatureCard({
  feature,
  onOpen,
}: {
  feature: FinanceFeature;
  onOpen: (kind: FinanceFormKind) => void;
}) {
  const Icon = groupIcons[feature.group];
  const kind: FinanceFormKind =
    feature.id === 10
      ? 'RECEIPT'
      : feature.id === 11 || feature.id === 12 || feature.id === 14
        ? 'PAYMENT'
        : feature.id === 13
          ? 'CHECK'
          : feature.id === 15 || feature.id === 16
            ? 'INVOICE'
            : 'JOURNAL';
  return (
    <Card className="flex h-full flex-col p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <Badge>بخش {feature.id.toLocaleString('fa-IR')}</Badge>
      </div>
      <h3 className="mt-4 font-bold">{feature.title}</h3>
      <p className="mt-2 flex-1 text-xs leading-6 text-muted-foreground">
        {feature.description}
      </p>
      <p
        className="mt-4 border-t border-border pt-3 text-[11px] text-muted-foreground"
        dir="ltr"
      >
        {feature.permission}
      </p>
      <Button
        className="mt-3"
        onClick={() => onOpen(kind)}
        size="sm"
        type="button"
        variant="outline"
      >
        {feature.primaryAction}
      </Button>
    </Card>
  );
}

function CapabilityWorkspace({
  onGroup,
  onOpen,
  query,
}: {
  onGroup: (group: FinanceWorkspaceGroup | 'ALL') => void;
  onOpen: (kind: FinanceFormKind) => void;
  query: ReturnType<typeof normalizeFinanceWorkspaceQuery>;
}) {
  const features = filterFinanceFeatures(query);
  const groups = Object.entries(financeGroupLabels) as [
    FinanceWorkspaceGroup,
    string,
  ][];
  return (
    <div className="space-y-5">
      <nav
        aria-label="گروه‌های داخلی مالی"
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-7"
      >
        <Button
          onClick={() => onGroup('ALL')}
          size="sm"
          type="button"
          variant={query.group === 'ALL' ? 'primary' : 'outline'}
        >
          همه ۳۰ بخش
        </Button>
        {groups.map(([value, label]) => {
          const Icon = groupIcons[value];
          return (
            <Button
              key={value}
              onClick={() => onGroup(value)}
              size="sm"
              type="button"
              variant={query.group === value ? 'primary' : 'outline'}
            >
              <Icon className="size-4" />
              {label}
            </Button>
          );
        })}
      </nav>
      <Alert
        description="Navigation داخلی Grid است؛ منوی اصلی CRM همچنان دقیقاً ۱۷ بخش دارد."
        title={
          features.length.toLocaleString('fa-IR') + ' قابلیت مطابق جست‌وجو'
        }
      />
      {features.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {features.map((feature) => (
            <FeatureCard feature={feature} key={feature.id} onOpen={onOpen} />
          ))}
        </div>
      ) : (
        <EmptyState
          description="کلیدواژه دیگری مانند چک، ارز، سود یا بودجه را جست‌وجو کنید."
          title="قابلیت پیدا نشد"
        />
      )}
    </div>
  );
}

function formKindFor(record: FinancePreviewRecord): FinanceFormKind {
  return record.kind === 'RELEASE'
    ? 'RELEASE'
    : record.kind === 'JOURNAL'
      ? 'JOURNAL'
      : record.kind;
}

function OperationsWorkspace({
  onOpen,
  onPage,
  query,
}: {
  onOpen: (
    kind: FinanceFormKind,
    mode: FinanceFormMode,
    record: FinancePreviewRecord,
  ) => void;
  onPage: (page: number) => void;
  query: ReturnType<typeof normalizeFinanceWorkspaceQuery>;
}) {
  const results = filterFinanceRecords(financePreviewRecords, query);
  const page = paginateFinanceRecords(results, query.page, query.pageSize);
  return (
    <div className="space-y-4">
      {page.length ? (
        <div className="grid gap-3">
          {page.map((record) => (
            <Card className="p-4" key={record.id}>
              <div className="grid gap-3 md:grid-cols-[0.7fr_1.5fr_1.2fr_1fr_0.8fr] md:items-center">
                <div>
                  <Badge>{kindLabels[record.kind]}</Badge>
                  <Badge className="mt-2 md:ms-1">
                    {statusLabels[record.status]}
                  </Badge>
                </div>
                <div>
                  <p className="font-bold">{record.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                    {record.contractReference}
                  </p>
                </div>
                <p className="text-sm">{record.party}</p>
                <p className="text-sm font-black" dir="ltr">
                  {formatMoney(record.amount, record.currencyCode)}
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={() => onOpen(formKindFor(record), 'view', record)}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <Eye className="size-4" />
                  </Button>
                  <Button
                    onClick={() => onOpen(formKindFor(record), 'edit', record)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <FilePenLine className="size-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          description="فیلترها را تغییر دهید."
          title="عملیات مطابق فیلتر پیدا نشد"
        />
      )}
      <div className="flex items-center justify-between gap-3">
        <Button
          disabled={query.page === 1}
          onClick={() => onPage(query.page - 1)}
          size="sm"
          type="button"
          variant="outline"
        >
          <ChevronRight className="size-4" /> قبل
        </Button>
        <PaginationShell
          currentPage={query.page}
          totalLabel={
            results.length.toLocaleString('fa-IR') + ' رکورد synthetic'
          }
        />
        <Button
          disabled={query.page * query.pageSize >= results.length}
          onClick={() => onPage(query.page + 1)}
          size="sm"
          type="button"
          variant="outline"
        >
          بعد <ChevronLeft className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function ReleaseWorkspace({ onOpen }: { onOpen: () => void }) {
  const states = [
    [
      'BLOCKED',
      'مسدود',
      'شرایط وصول یا اعتبار فراهم نیست.',
      'bg-destructive/10 text-destructive',
    ],
    [
      'CONDITIONAL',
      'مشروط',
      'برنامه پرداخت، چک معتبر یا استثنای زمان‌دار.',
      'bg-amber-500/10 text-amber-700',
    ],
    [
      'APPROVED',
      'مجاز',
      'تسویه کامل یا اعتبار مصوب.',
      'bg-emerald-500/10 text-emerald-700',
    ],
  ] as const;
  return (
    <div className="space-y-5">
      <Alert
        description="صدور عملیاتی می‌تواند انجام شود، اما مشاهده و تحویل سند تا Financial Release ممنوع است."
        title="صدور، آزادسازی و تحویل سه state مستقل‌اند"
        tone="warning"
      />
      <div className="grid gap-4 md:grid-cols-3">
        {states.map(([status, title, description, tone]) => (
          <Card className="p-5" key={status}>
            <span
              className={
                'inline-flex rounded-full px-3 py-1 text-xs font-bold ' + tone
              }
            >
              {status}
            </span>
            <h3 className="mt-4 text-lg font-black">{title}</h3>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              {description}
            </p>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <Card className="p-5">
          <h3 className="font-bold">Timeline مالی پرونده سفر نمونه</h3>
          <ol className="mt-5 space-y-4 border-s border-border ps-5">
            {[
              ['فاکتور فروش از Public Reference دریافت شد', '۱۰:۰۰ UTC'],
              ['دریافت ترکیبی Preview بررسی شد', '۱۰:۳۰ UTC'],
              ['چک معتبر synthetic ثبت شد', '۱۱:۰۰ UTC'],
              ['وضعیت CONDITIONAL پیشنهاد شد', '۱۱:۱۵ UTC'],
            ].map(([title, at]) => (
              <li className="relative" key={title}>
                <span className="absolute -start-[1.55rem] top-1.5 size-2 rounded-full bg-primary" />
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{at}</p>
              </li>
            ))}
          </ol>
        </Card>
        <Card className="p-5">
          <ShieldCheck className="size-6 text-primary" />
          <h3 className="mt-4 font-bold">استثنای مدیر</h3>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            دلیل، انقضای UTC، تاییدکننده دوم متفاوت و Audit کامل اجباری است.
          </p>
          <Button className="mt-5" onClick={onOpen} type="button">
            فرم Release
          </Button>
        </Card>
      </div>
    </div>
  );
}

function ReportsWorkspace({
  onRoute,
}: {
  onRoute: (format: 'xlsx' | 'pdf') => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        {(
          [
            [
              'xlsx',
              'مسیر خروجی Excel',
              financePreviewEndpointRoutes.excelExport,
              FileSpreadsheet,
            ],
            [
              'pdf',
              'مسیر خروجی PDF',
              financePreviewEndpointRoutes.pdfExport,
              ReceiptText,
            ],
          ] as const
        ).map(([format, title, route, Icon]) => (
          <Card className="p-5" key={format}>
            <Icon className="size-6 text-primary" />
            <h3 className="mt-4 font-bold">{title}</h3>
            <p
              className="mt-2 break-all text-xs text-muted-foreground"
              dir="ltr"
            >
              {route}
            </p>
            <Button
              className="mt-5"
              onClick={() => onRoute(format)}
              type="button"
              variant="outline"
            >
              تعریف درخواست {format.toUpperCase()}
            </Button>
          </Card>
        ))}
      </div>
      <Alert
        description="فقط route، filter snapshot و permission تعریف شده‌اند؛ هیچ فایل جعلی ساخته نمی‌شود."
        title="خروجی واقعی تا اتصال Documents/Worker مسدود است"
        tone="warning"
      />
      <Card className="p-5">
        <h3 className="font-bold">گزارش‌های تخصصی گردشگری</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[
            'سود قرارداد، تور، مسیر و فروشنده',
            'تخفیف تامین‌کننده و خرید خالص',
            'هزینه پرواز، هتل، ترانسفر، بیمه و ویزا',
            'مطالبات مشتریان و آژانس‌ها',
            'بدهی ایرلاین، هتل، DMC و کارگزار',
            'Timeline و Audit پرونده',
          ].map((report) => (
            <div
              className="rounded-xl border border-border bg-muted/20 p-3 text-sm font-semibold"
              key={report}
            >
              {report}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function FinanceWorkspace() {
  const [state, setState] = useState<FinancePreviewState>('preview');
  const [tab, setTab] = useState<WorkspaceTab>('overview');
  const [query, setQuery] = useState(() =>
    normalizeFinanceWorkspaceQuery({ pageSize: 5 }),
  );
  const [form, setForm] = useState<{
    kind: FinanceFormKind;
    mode: FinanceFormMode;
    record?: FinancePreviewRecord;
  } | null>(null);
  const [exportRoute, setExportRoute] = useState<'xlsx' | 'pdf' | null>(null);
  const filteredCount = useMemo(
    () => filterFinanceRecords(financePreviewRecords, query).length,
    [query],
  );

  function openCreate(kind: FinanceFormKind) {
    setForm({ kind, mode: 'create' });
  }

  return (
    <main className="space-y-6" dir="rtl">
      <PageHeader
        actions={
          <>
            <Button onClick={() => openCreate('JOURNAL')} type="button">
              <Plus className="size-4" /> سند نمایشی جدید
            </Button>
            <Button
              onClick={() => openCreate('RECEIPT')}
              type="button"
              variant="outline"
            >
              <Banknote className="size-4" /> دریافت نمایشی
            </Button>
          </>
        }
        description="Sub-ledger عملیاتی دوطرفه سفر؛ تصمیم‌ها PROPOSED و همه داده‌ها synthetic هستند."
        eyebrow="FINANCE-001 · Decision-gated Foundation"
        title="مالی و خزانه‌داری"
      />
      <Alert
        description={FINANCE_PREVIEW_NOTICE}
        title="نمونه طراحی و ذخیره‌نشده"
        tone="warning"
      >
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {previewStates.map(([value, label]) => (
              <Button
                aria-pressed={state === value}
                key={value}
                onClick={() => setState(value)}
                size="sm"
                type="button"
                variant={state === value ? 'primary' : 'outline'}
              >
                {label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>{FINANCE_UI_CONTRACT_VERSION}</Badge>
            <Badge className="bg-destructive/10 text-destructive">
              Prisma/Migration ندارد
            </Badge>
          </div>
        </div>
      </Alert>

      <FinanceFilters onChange={setQuery} query={query} />

      <Tabs
        onValueChange={(value) => setTab(value as WorkspaceTab)}
        value={tab}
      >
        <TabsList className="grid w-full grid-cols-2 gap-1 sm:grid-cols-5">
          <TabsTrigger value="overview">داشبورد</TabsTrigger>
          <TabsTrigger value="capabilities">۳۰ بخش</TabsTrigger>
          <TabsTrigger value="operations">عملیات</TabsTrigger>
          <TabsTrigger value="release">آزادسازی</TabsTrigger>
          <TabsTrigger value="reports">گزارش‌ها</TabsTrigger>
        </TabsList>

        {state !== 'preview' ? (
          <div className="mt-5">
            <StatePanel onRetry={() => setState('preview')} state={state} />
          </div>
        ) : (
          <>
            <TabsContent className="mt-5 space-y-5" value="overview">
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <SummaryCard
                  detail="۲ حساب نمونه · از خطوط posted آینده"
                  icon={Landmark}
                  label="مانده بانک"
                  value="۸۴۰٬۰۰۰٬۰۰۰ IRR"
                />
                <SummaryCard
                  detail="۲ صندوق نمونه · غیرقابل ویرایش دستی"
                  icon={WalletCards}
                  label="مانده صندوق"
                  value="۱۲۵٬۰۰۰٬۰۰۰ IRR"
                />
                <SummaryCard
                  detail="۴ سررسید synthetic"
                  icon={ArrowDownUp}
                  label="حساب‌های دریافتنی"
                  tone="warning"
                  value="۳۶۰٬۰۰۰٬۰۰۰ IRR"
                />
                <SummaryCard
                  detail="تامین‌کنندگان و کارگزاران نمونه"
                  icon={Building2}
                  label="حساب‌های پرداختنی"
                  tone="danger"
                  value="۲۱۰٬۰۰۰٬۰۰۰ IRR"
                />
                <SummaryCard
                  detail="۷، ۳ و ۱ روز مانده"
                  icon={CalendarClock}
                  label="چک نزدیک سررسید"
                  tone="warning"
                  value="۳ فقره"
                />
                <SummaryCard
                  detail="فروش snapshot منهای خرید خالص"
                  icon={Sparkles}
                  label="سود قراردادهای نمونه"
                  tone="success"
                  value="۱۵۰٬۰۰۰٬۰۰۰ IRR"
                />
              </section>
              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <Card className="p-5">
                  <h2 className="font-bold">سود پرونده سفر نمونه</h2>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {[
                      ['فروش قرارداد', '۴۸۰٬۰۰۰٬۰۰۰ IRR'],
                      ['خرید اولیه', '۳۴۰٬۰۰۰٬۰۰۰ IRR'],
                      ['تخفیف تامین‌کننده', '۲۵٬۰۰۰٬۰۰۰ IRR'],
                      ['کارمزد و هزینه', '۱۵٬۰۰۰٬۰۰۰ IRR'],
                      ['خرید خالص', '۳۳۰٬۰۰۰٬۰۰۰ IRR'],
                      ['سود محاسباتی', '۱۵۰٬۰۰۰٬۰۰۰ IRR'],
                    ].map(([label, value]) => (
                      <div
                        className="rounded-xl border border-border bg-muted/20 p-3"
                        key={label}
                      >
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="mt-1 text-sm font-black">{value}</p>
                      </div>
                    ))}
                  </div>
                </Card>
                <Card className="p-5">
                  <Coins className="size-6 text-primary" />
                  <h2 className="mt-4 font-bold">تفکیک هزینه خدمت</h2>
                  <div className="mt-4 space-y-3">
                    {[
                      ['پرواز', '۴۵٪'],
                      ['هتل', '۳۲٪'],
                      ['ترانسفر', '۸٪'],
                      ['بیمه و ویزا', '۷٪'],
                      ['کمیسیون و سایر', '۸٪'],
                    ].map(([label, value]) => (
                      <div className="flex justify-between text-sm" key={label}>
                        <span>{label}</span>
                        <span className="font-bold">{value}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
              <Alert
                description={
                  filteredCount.toLocaleString('fa-IR') +
                  ' عملیات synthetic با فیلتر جاری؛ مانده و سود فیلد دستی نیستند.'
                }
                title="نمای کلی فیلترشده"
              />
            </TabsContent>

            <TabsContent className="mt-5" value="capabilities">
              <CapabilityWorkspace
                onGroup={(group) => setQuery({ ...query, group, page: 1 })}
                onOpen={openCreate}
                query={query}
              />
            </TabsContent>

            <TabsContent className="mt-5" value="operations">
              <div className="mb-4 flex flex-wrap gap-2">
                {(
                  [
                    ['JOURNAL', 'سند'],
                    ['RECEIPT', 'دریافت'],
                    ['PAYMENT', 'پرداخت'],
                    ['CHECK', 'چک'],
                    ['INVOICE', 'فاکتور'],
                    ['RELEASE', 'آزادسازی'],
                  ] as const
                ).map(([kind, label]) => (
                  <Button
                    key={kind}
                    onClick={() => openCreate(kind)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Plus className="size-4" /> {label}
                  </Button>
                ))}
              </div>
              <OperationsWorkspace
                onOpen={(kind, mode, record) => setForm({ kind, mode, record })}
                onPage={(page) => setQuery({ ...query, page })}
                query={query}
              />
            </TabsContent>

            <TabsContent className="mt-5" value="release">
              <ReleaseWorkspace onOpen={() => openCreate('RELEASE')} />
            </TabsContent>

            <TabsContent className="mt-5" value="reports">
              <ReportsWorkspace onRoute={setExportRoute} />
              {exportRoute ? (
                <Alert
                  className="mt-4"
                  description={
                    'Route ' +
                    exportRoute.toUpperCase() +
                    ' انتخاب شد؛ درخواست یا فایل ساخته نشد.'
                  }
                  title="مسیر خروجی آماده اتصال آینده است"
                />
              ) : null}
            </TabsContent>
          </>
        )}
      </Tabs>

      <Alert
        description="حسابداری قانونی، Tax/Recognition، FX authoritative، posting، approval workflow و release اجرایی مسدودند."
        title="مرز حسابداری داخلی و قانونی"
      >
        <div className="mt-3 flex flex-wrap gap-2">
          {['DEC-OPEN-001', 'DEC-OPEN-004', 'DEC-OPEN-005', 'DEC-OPEN-016'].map(
            (decision) => (
              <Badge className="bg-amber-500/10 text-amber-700" key={decision}>
                <LockKeyhole className="me-1 size-3" /> {decision} · PROPOSED
              </Badge>
            ),
          )}
        </div>
      </Alert>

      {form ? (
        <FinancePreviewForm
          kind={form.kind}
          mode={form.mode}
          onClose={() => setForm(null)}
          {...(form.record ? { record: form.record } : {})}
        />
      ) : null}
    </main>
  );
}
