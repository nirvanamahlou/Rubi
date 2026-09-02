'use client';

import {
  AlertTriangle,
  ArrowRight,
  BadgePercent,
  BarChart3,
  BellRing,
  ChevronLeft,
  ChevronRight,
  Eye,
  FilePenLine,
  FileStack,
  FilterX,
  Gauge,
  Megaphone,
  MessageSquareText,
  MousePointerClick,
  Plus,
  RefreshCw,
  Route,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';

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
import { cn } from '@/lib/utils';
import {
  MARKETING_ANALYTICS_STATUS,
  MARKETING_ATTRIBUTION_STATUS,
  MARKETING_DISPATCH_STATUS,
  MARKETING_PREVIEW_NOTICE,
  MARKETING_UI_VERSION,
  marketingKpiDefinitions,
  type MarketingPreviewState,
} from '../api/contracts';
import {
  campaignChannelLabels,
  campaignStatusLabels,
  executionCompanyLabels,
  filterAndSortCampaigns,
  marketingCoupons,
  marketingOffers,
  marketingPreviewCampaigns,
  marketingSegments,
  marketingSuppressionSummary,
  marketingTimeline,
  normalizeMarketingCampaignQuery,
  paginateCampaigns,
  type CampaignChannel,
  type CampaignPreview,
  type CampaignStatus,
  type ExecutionCompany,
  type MarketingCampaignQuery,
} from '../model/marketing';
import {
  marketingSectionTabs,
  marketingSections,
  previewItemsFor,
  type MarketingPreviewItem,
  type MarketingSectionDefinition,
  type MarketingSectionKey,
} from '../model/reference-data';
import { CampaignCalendar } from './campaign-calendar';
import { CampaignForm, type CampaignFormMode } from './campaign-form';

const previewStates: readonly [MarketingPreviewState, string][] = [
  ['preview', 'پیش‌نمایش'],
  ['loading', 'در حال بارگذاری'],
  ['empty', 'خالی'],
  ['error', 'خطای سرور'],
  ['unauthorized', 'بدون احراز هویت'],
  ['forbidden', 'دسترسی ممنوع'],
  ['conflict', 'تعارض نسخه'],
  ['awaiting-integration', 'در انتظار اتصال ارسال'],
];

const statusOptions = Object.entries(campaignStatusLabels) as [
  CampaignStatus,
  string,
][];
const channelOptions = Object.entries(campaignChannelLabels) as [
  CampaignChannel,
  string,
][];
const companyOptions = Object.entries(executionCompanyLabels) as [
  ExecutionCompany,
  string,
][];

const sectionIcons: Record<MarketingSectionKey, LucideIcon> = {
  dashboard: Gauge,
  campaigns: Megaphone,
  audiences: UsersRound,
  communications: MessageSquareText,
  content: FileStack,
  offers: BadgePercent,
  journeys: Route,
  reports: BarChart3,
  settings: Settings2,
};

const toneClasses: Record<MarketingSectionDefinition['tone'], string> = {
  blue: 'bg-blue-50 text-blue-700 ring-blue-100',
  violet: 'bg-violet-50 text-violet-700 ring-violet-100',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  amber: 'bg-amber-50 text-amber-700 ring-amber-100',
  rose: 'bg-rose-50 text-rose-700 ring-rose-100',
  cyan: 'bg-cyan-50 text-cyan-700 ring-cyan-100',
};

function formatMoney(amount: string, currencyCode: string) {
  const [integer = '0', fraction] = amount.split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
  return `${grouped}${fraction ? `٫${fraction}` : ''} ${currencyCode}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Tehran',
  }).format(new Date(value));
}

function statusTone(status: CampaignStatus) {
  if (status === 'RUNNING' || status === 'APPROVED')
    return 'bg-emerald-100 text-emerald-800';
  if (status === 'CANCELLED') return 'bg-destructive/10 text-destructive';
  if (status === 'PAUSED' || status === 'READY_FOR_APPROVAL')
    return 'bg-amber-100 text-amber-800';
  return 'bg-secondary text-secondary-foreground';
}

function StateGate({
  state,
  onReset,
}: {
  state: MarketingPreviewState;
  onReset: () => void;
}) {
  if (state === 'preview') return null;
  if (state === 'loading') {
    return (
      <div
        aria-label="در حال بارگذاری"
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        {Array.from({ length: 9 }, (_, index) => (
          <Skeleton className="h-44" key={index} />
        ))}
      </div>
    );
  }
  if (state === 'empty') {
    return (
      <EmptyState
        action={<Button onClick={onReset}>نمایش داده‌های نمونه</Button>}
        description="پس از اتصال Persistence، داده‌های مجاز اینجا نمایش داده می‌شوند."
        title="هنوز داده‌ای وجود ندارد"
      />
    );
  }
  const states: Record<
    Exclude<MarketingPreviewState, 'preview' | 'loading' | 'empty'>,
    { title: string; description: string }
  > = {
    error: {
      title: 'دریافت اطلاعات مارکتینگ ناموفق بود',
      description:
        'خطای موقت با Trace ID امن نمایش داده می‌شود و داده جعلی جای پاسخ واقعی قرار نمی‌گیرد.',
    },
    unauthorized: {
      title: 'ابتدا وارد حساب سازمانی شوید',
      description: 'پاسخ 401 کاربر را به جریان ورود هدایت می‌کند.',
    },
    forbidden: {
      title: 'مجوز مشاهده مارکتینگ را ندارید',
      description: 'دسترسی طبق سیاست deny-by-default توسط IAM تعیین می‌شود.',
    },
    conflict: {
      title: 'نسخه اطلاعات تغییر کرده است',
      description: 'اطلاعات تازه را دریافت و تغییر را دوباره بررسی کنید.',
    },
    'awaiting-integration': {
      title: 'ارسال واقعی هنوز متصل نیست',
      description: `نیت‌های ارسال با وضعیت ${MARKETING_DISPATCH_STATUS} باقی می‌مانند.`,
    },
  };
  return (
    <ErrorState
      action={
        <Button onClick={onReset} variant="outline">
          <RefreshCw aria-hidden="true" className="size-4" />
          بازگشت به پیش‌نمایش
        </Button>
      }
      description={states[state].description}
      title={states[state].title}
    />
  );
}

function MarketingHub({
  onSelect,
}: {
  onSelect: (section: MarketingSectionKey) => void;
}) {
  return (
    <section className="grid gap-5" aria-labelledby="marketing-hub-title">
      <div>
        <h2 className="text-xl font-black" id="marketing-hub-title">
          بخش‌های مارکتینگ
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          برای ورود به هر بخش، کارت مربوط را انتخاب کنید.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {marketingSections.map((section) => {
          const Icon = sectionIcons[section.key];
          return (
            <Card className="flex h-full flex-col p-5" key={section.key}>
              <div className="flex items-start justify-between gap-4">
                <span
                  className={cn(
                    'grid size-12 place-items-center rounded-2xl ring-4',
                    toneClasses[section.tone],
                  )}
                >
                  <Icon aria-hidden="true" className="size-6" />
                </span>
                <ChevronLeft
                  aria-hidden="true"
                  className="size-5 text-muted-foreground"
                />
              </div>
              <h3 className="mt-5 text-lg font-black">{section.title}</h3>
              <p className="mt-2 min-h-14 text-sm leading-7 text-muted-foreground">
                {section.description}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {section.highlights.map((highlight) => (
                  <Badge key={highlight}>{highlight}</Badge>
                ))}
              </div>
              <Button
                className="mt-5 w-full"
                onClick={() => onSelect(section.key)}
                variant="outline"
              >
                ورود به {section.title}
                <ChevronLeft aria-hidden="true" className="size-4" />
              </Button>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function DashboardPanel({ onNotice }: { onNotice: (message: string) => void }) {
  const [startDate, setStartDate] = useState('2026-09-01');
  const [endDate, setEndDate] = useState('2026-09-30');
  const [company, setCompany] = useState<ExecutionCompany | 'ALL'>('ALL');
  const summary: readonly [string, string, LucideIcon][] = [
    [
      'کمپین‌های نمونه',
      marketingPreviewCampaigns.length.toLocaleString('fa-IR'),
      Megaphone,
    ],
    [
      'کمپین در حال اجرا',
      marketingPreviewCampaigns
        .filter((item) => item.status === 'RUNNING')
        .length.toLocaleString('fa-IR'),
      Gauge,
    ],
    [
      'سگمنت تعریف‌شده',
      marketingSegments.length.toLocaleString('fa-IR'),
      UsersRound,
    ],
    ['هشدار عملیاتی', '۲', BellRing],
  ];
  return (
    <section className="grid gap-5">
      <FilterBar className="grid md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]">
        <FormField id="dashboard-start" label="از تاریخ">
          <DatePicker
            id="dashboard-start"
            onChange={setStartDate}
            value={startDate}
          />
        </FormField>
        <FormField id="dashboard-end" label="تا تاریخ">
          <DatePicker
            id="dashboard-end"
            onChange={setEndDate}
            value={endDate}
          />
        </FormField>
        <FormField id="dashboard-company" label="شرکت مجری">
          <Select
            value={company}
            onValueChange={(value) => setCompany(value as typeof company)}
          >
            <SelectTrigger id="dashboard-company">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">هر دو شرکت</SelectItem>
              {companyOptions.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <Button
          onClick={() =>
            onNotice(`فیلتر داشبورد برای ${startDate} تا ${endDate} اعمال شد.`)
          }
        >
          <MousePointerClick aria-hidden="true" className="size-4" />
          اعمال فیلتر
        </Button>
      </FilterBar>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summary.map(([label, value, Icon]) => (
          <Card className="p-4" key={label}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-2 text-2xl font-black">{value}</p>
              </div>
              <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                <Icon aria-hidden="true" className="size-5" />
              </span>
            </div>
          </Card>
        ))}
      </div>
      <Alert
        description={`مقادیر تحلیلی با وضعیت ${MARKETING_ANALYTICS_STATUS} عمداً خالی‌اند؛ فقط شمارش داده‌های Preview نمایش داده می‌شود.`}
        title="مرز داده عملیاتی و تحلیلی"
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {marketingKpiDefinitions.slice(0, 6).map((kpi) => (
          <Card className="p-4" key={kpi.key}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold">{kpi.title}</p>
                <p className="mt-3 text-2xl font-black text-muted-foreground">
                  —
                </p>
              </div>
              <BarChart3 aria-hidden="true" className="size-5 text-primary" />
            </div>
            <p className="mt-3 text-xs leading-6 text-muted-foreground">
              {kpi.definition}
            </p>
            <Badge className="mt-3 font-mono text-[10px]" dir="ltr">
              {kpi.status}
            </Badge>
          </Card>
        ))}
      </div>
    </section>
  );
}

function CampaignCard({
  campaign,
  onOpen,
}: {
  campaign: CampaignPreview;
  onOpen: (mode: CampaignFormMode, campaign: CampaignPreview) => void;
}) {
  return (
    <Card className="p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={statusTone(campaign.status)}>
              {campaignStatusLabels[campaign.status]}
            </Badge>
            <span className="font-mono text-xs text-muted-foreground" dir="ltr">
              {campaign.internalCode}
            </span>
          </div>
          <h3 className="mt-3 text-lg font-black">{campaign.name}</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {campaign.objective}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => onOpen('view', campaign)}
            size="sm"
            variant="outline"
          >
            <Eye aria-hidden="true" className="size-4" />
            مشاهده
          </Button>
          <Button
            onClick={() => onOpen('edit', campaign)}
            size="sm"
            variant="secondary"
          >
            <FilePenLine aria-hidden="true" className="size-4" />
            ویرایش Preview
          </Button>
        </div>
      </div>
      <dl className="mt-4 grid gap-3 rounded-xl bg-muted/45 p-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <dt className="text-xs text-muted-foreground">نوع کمپین</dt>
          <dd className="mt-1 font-semibold">{campaign.campaignType}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">شرکت مجری</dt>
          <dd className="mt-1 font-semibold">
            {executionCompanyLabels[campaign.executionCompany]}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">بازه اجرا</dt>
          <dd className="mt-1 font-semibold">
            {formatDate(campaign.startsAt)} تا {formatDate(campaign.endsAt)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">بودجه / هزینه</dt>
          <dd className="mt-1 font-semibold" dir="ltr">
            {formatMoney(campaign.budgetAmount, campaign.currencyCode)} /{' '}
            {formatMoney(campaign.spendAmount, campaign.currencyCode)}
          </dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        {campaign.channels.map((channel) => (
          <Badge key={channel}>{campaignChannelLabels[channel]}</Badge>
        ))}
      </div>
      <details className="mt-4 rounded-xl border border-border p-4 text-sm">
        <summary className="cursor-pointer font-bold">
          جزئیات کامل کمپین
        </summary>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">مخاطب</dt>
            <dd className="mt-1">{campaign.audienceSummary}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">پیشنهاد / کوپن</dt>
            <dd className="mt-1">
              {campaign.offerTitle} / {campaign.couponCode ?? 'ندارد'}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">مالک</dt>
            <dd className="mt-1">{campaign.ownerRole}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">UTM Campaign</dt>
            <dd className="mt-1 break-all font-mono text-xs" dir="ltr">
              {campaign.utmCampaign}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">محدودیت ارسال</dt>
            <dd className="mt-1">{campaign.frequencyCap}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">درآمد منتسب</dt>
            <dd className="mt-1">— ({MARKETING_ATTRIBUTION_STATUS})</dd>
          </div>
        </dl>
      </details>
    </Card>
  );
}

function CampaignList({
  onOpen,
}: {
  onOpen: (mode: CampaignFormMode, campaign?: CampaignPreview) => void;
}) {
  const [query, setQuery] = useState<MarketingCampaignQuery>(() =>
    normalizeMarketingCampaignQuery({}),
  );
  const filtered = useMemo(
    () => filterAndSortCampaigns(marketingPreviewCampaigns, query),
    [query],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / query.pageSize));
  const currentPage = Math.min(query.page, totalPages);
  const campaigns = paginateCampaigns(filtered, currentPage, query.pageSize);
  const patchQuery = (patch: Partial<MarketingCampaignQuery>) =>
    setQuery((current) =>
      normalizeMarketingCampaignQuery({
        ...current,
        ...patch,
        page: patch.page ?? 1,
      }),
    );
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-black">فهرست کمپین‌ها</h3>
          <p className="text-sm text-muted-foreground">
            جست‌وجو، فیلتر تاریخ و صفحه‌بندی واکنش‌گرا
          </p>
        </div>
        <Button onClick={() => onOpen('create')}>
          <Plus aria-hidden="true" className="size-4" />
          کمپین جدید
        </Button>
      </div>
      <FilterBar className="grid sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
        <FormField id="marketing-search" label="جست‌وجو">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="absolute end-3 top-3.5 size-4 text-muted-foreground"
            />
            <Input
              className="pe-10"
              id="marketing-search"
              onChange={(event) => patchQuery({ search: event.target.value })}
              placeholder="نام، کد یا هدف"
              value={query.search}
            />
          </div>
        </FormField>
        <FormField id="marketing-status" label="وضعیت">
          <Select
            value={query.status}
            onValueChange={(value) =>
              patchQuery({
                status: value as MarketingCampaignQuery['status'],
              })
            }
          >
            <SelectTrigger id="marketing-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">همه وضعیت‌ها</SelectItem>
              {statusOptions.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField id="marketing-channel" label="کانال">
          <Select
            value={query.channel}
            onValueChange={(value) =>
              patchQuery({
                channel: value as MarketingCampaignQuery['channel'],
              })
            }
          >
            <SelectTrigger id="marketing-channel">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">همه کانال‌ها</SelectItem>
              {channelOptions.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField id="marketing-company" label="شرکت مجری">
          <Select
            value={query.company}
            onValueChange={(value) =>
              patchQuery({
                company: value as MarketingCampaignQuery['company'],
              })
            }
          >
            <SelectTrigger id="marketing-company">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">هر دو شرکت</SelectItem>
              {companyOptions.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField id="marketing-start" label="فعال از تاریخ">
          <DatePicker
            id="marketing-start"
            onChange={(value) => patchQuery({ startsAfter: value })}
            placeholder="همه تاریخ‌ها"
            value={query.startsAfter}
          />
        </FormField>
        <FormField id="marketing-end" label="فعال تا تاریخ">
          <DatePicker
            id="marketing-end"
            onChange={(value) => patchQuery({ endsBefore: value })}
            placeholder="همه تاریخ‌ها"
            value={query.endsBefore}
          />
        </FormField>
        <FormField id="marketing-sort" label="مرتب‌سازی">
          <Select
            value={query.sortBy}
            onValueChange={(value) =>
              patchQuery({ sortBy: value as MarketingCampaignQuery['sortBy'] })
            }
          >
            <SelectTrigger id="marketing-sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updatedAt">آخرین تغییر</SelectItem>
              <SelectItem value="startsAt">زمان شروع</SelectItem>
              <SelectItem value="budgetAmount">بودجه</SelectItem>
              <SelectItem value="name">نام</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <div className="flex items-end">
          <Button
            className="w-full"
            onClick={() => setQuery(normalizeMarketingCampaignQuery({}))}
            variant="outline"
          >
            <FilterX aria-hidden="true" className="size-4" />
            پاک‌کردن
          </Button>
        </div>
      </FilterBar>
      {campaigns.length ? (
        <div className="grid gap-4">
          {campaigns.map((campaign) => (
            <CampaignCard
              campaign={campaign}
              key={campaign.id}
              onOpen={(mode, item) => onOpen(mode, item)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          action={
            <Button
              onClick={() => setQuery(normalizeMarketingCampaignQuery({}))}
              variant="outline"
            >
              پاک‌کردن فیلترها
            </Button>
          }
          description="فیلترها یا بازه تاریخ را تغییر دهید."
          title="نتیجه‌ای پیدا نشد"
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3">
        <PaginationShell
          currentPage={currentPage}
          totalLabel={`${filtered.length.toLocaleString('fa-IR')} کمپین ساختگی`}
        />
        <div className="flex gap-2">
          <Button
            aria-label="صفحه قبل"
            disabled={currentPage <= 1}
            onClick={() => patchQuery({ page: currentPage - 1 })}
            size="icon"
            variant="outline"
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </Button>
          <Button
            aria-label="صفحه بعد"
            disabled={currentPage >= totalPages}
            onClick={() => patchQuery({ page: currentPage + 1 })}
            size="icon"
            variant="outline"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function BudgetPanel() {
  return (
    <section className="grid gap-3">
      {marketingPreviewCampaigns.map((campaign) => (
        <Card
          className="grid gap-3 p-4 sm:grid-cols-4 sm:items-center"
          key={campaign.id}
        >
          <div>
            <p className="font-bold">{campaign.name}</p>
            <p className="text-xs text-muted-foreground">
              {executionCompanyLabels[campaign.executionCompany]}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">بودجه</p>
            <p className="font-semibold" dir="ltr">
              {formatMoney(campaign.budgetAmount, campaign.currencyCode)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">هزینه Preview</p>
            <p className="font-semibold" dir="ltr">
              {formatMoney(campaign.spendAmount, campaign.currencyCode)}
            </p>
          </div>
          <Badge className="justify-self-start sm:justify-self-end">
            Finance Reference لازم است
          </Badge>
        </Card>
      ))}
    </section>
  );
}

function ApprovalPanel() {
  return (
    <section className="grid gap-4">
      <Alert
        description="رویدادها با نقش ناشناس و نسخه مورد انتظار نگهداری می‌شوند."
        title="گردش تأیید نسخه‌دار"
      />
      <ol className="grid gap-3">
        {marketingTimeline.map((event) => (
          <li key={event.id}>
            <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-bold">{event.action}</p>
                <p className="text-sm text-muted-foreground">
                  نقش عامل: {event.actorRole}
                </p>
              </div>
              <div className="text-end">
                <Badge>نسخه {event.version.toLocaleString('fa-IR')}</Badge>
                <time className="mt-2 block text-xs text-muted-foreground">
                  {formatDate(event.occurredAt)}
                </time>
              </div>
            </Card>
          </li>
        ))}
      </ol>
    </section>
  );
}

function AbPanel({ onNotice }: { onNotice: (message: string) => void }) {
  const experiments = [
    [
      'preview-ab-subject',
      'نسخه عنوان پیام',
      'عنوان کوتاه در برابر عنوان توضیحی',
      'در حال طراحی',
    ],
    [
      'preview-ab-landing',
      'نسخه صفحه فرود',
      'چیدمان کارت‌ها در برابر چیدمان فهرستی',
      'آماده بررسی',
    ],
  ] as const;
  return (
    <section className="grid gap-4 md:grid-cols-2">
      {experiments.map(([id, title, description, status]) => (
        <Card className="p-5" key={id}>
          <div className="flex items-center justify-between">
            <Sparkles aria-hidden="true" className="size-5 text-primary" />
            <Badge>{status}</Badge>
          </div>
          <h3 className="mt-4 font-black">{title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          <Button
            className="mt-4"
            onClick={() => onNotice(`جزئیات ${title} بازبینی شد.`)}
            variant="outline"
          >
            مشاهده نسخه‌ها
          </Button>
        </Card>
      ))}
    </section>
  );
}

function CampaignsPanel({
  onOpen,
  onNotice,
}: {
  onOpen: (mode: CampaignFormMode, campaign?: CampaignPreview) => void;
  onNotice: (message: string) => void;
}) {
  const [tab, setTab] = useState('list');
  return (
    <Tabs onValueChange={setTab} value={tab}>
      <TabsList
        aria-label="بخش‌های کمپین"
        className="grid w-full grid-cols-2 gap-1 bg-blue-50 p-2 md:grid-cols-3 xl:grid-cols-5"
      >
        {marketingSectionTabs.campaigns.map(([key, label]) => (
          <TabsTrigger key={key} value={key}>
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent className="mt-5" value="list">
        <CampaignList onOpen={onOpen} />
      </TabsContent>
      <TabsContent className="mt-5" value="calendar">
        <CampaignCalendar
          campaigns={marketingPreviewCampaigns}
          onOpen={(campaign) => onOpen('view', campaign)}
        />
      </TabsContent>
      <TabsContent className="mt-5" value="budget">
        <BudgetPanel />
      </TabsContent>
      <TabsContent className="mt-5" value="approval">
        <ApprovalPanel />
      </TabsContent>
      <TabsContent className="mt-5" value="ab">
        <AbPanel onNotice={onNotice} />
      </TabsContent>
    </Tabs>
  );
}

function SegmentGrid() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {marketingSegments.map((segment) => (
        <Card className="p-5" key={segment.id}>
          <div className="flex items-center justify-between">
            <UsersRound aria-hidden="true" className="size-5 text-primary" />
            <Badge>بدون PII</Badge>
          </div>
          <h3 className="mt-4 font-black">{segment.title}</h3>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            {segment.rules}
          </p>
          <p className="mt-4 text-sm font-semibold">
            اندازه: {segment.estimatedCount}
          </p>
        </Card>
      ))}
    </div>
  );
}

function OfferGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {marketingOffers.map((offer) => (
        <Card className="p-5" key={offer.id}>
          <Badge>{offer.status}</Badge>
          <h3 className="mt-3 font-black">{offer.title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{offer.rule}</p>
        </Card>
      ))}
      {marketingCoupons.map((coupon) => (
        <Card className="p-5" key={coupon.id}>
          <Badge>{coupon.status}</Badge>
          <h3 className="mt-3 font-black" dir="ltr">
            {coupon.code}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">{coupon.limit}</p>
        </Card>
      ))}
    </div>
  );
}

function GenericItemGrid({
  items,
  onOpen,
  onNotice,
}: {
  items: readonly MarketingPreviewItem[];
  onOpen: (item: MarketingPreviewItem) => void;
  onNotice: (message: string) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <Card className="p-5" key={item.id}>
          <div className="flex items-center justify-between gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <Target aria-hidden="true" className="size-5" />
            </span>
            <Badge>{item.status}</Badge>
          </div>
          <h3 className="mt-4 font-black">{item.title}</h3>
          <p className="mt-2 min-h-12 text-sm leading-7 text-muted-foreground">
            {item.description}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            {item.meta} · {formatDate(item.updatedAt)}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => onOpen(item)} size="sm" variant="outline">
              <Eye aria-hidden="true" className="size-4" />
              جزئیات
            </Button>
            <Button
              onClick={() =>
                onNotice(`${item.title} در محیط Preview بررسی شد.`)
              }
              size="sm"
              variant="secondary"
            >
              بررسی Preview
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

type GenericSectionKey = Exclude<
  MarketingSectionKey,
  'dashboard' | 'campaigns'
>;

function GenericSection({
  section,
  onOpen,
  onNotice,
}: {
  section: GenericSectionKey;
  onOpen: (item: MarketingPreviewItem) => void;
  onNotice: (message: string) => void;
}) {
  const tabs = marketingSectionTabs[section];
  const [tab, setTab] = useState(tabs.at(0)?.[0] ?? '');
  const items = previewItemsFor(section, tab);
  const special =
    section === 'audiences' && tab === 'segments' ? (
      <SegmentGrid />
    ) : section === 'offers' && tab === 'discounts' ? (
      <OfferGrid />
    ) : null;
  const actionLabels: Record<GenericSectionKey, string> = {
    audiences: 'ساخت سگمنت',
    communications: 'ساخت نیت ارسال',
    content: 'افزودن محتوای Preview',
    offers: 'پیشنهاد جدید',
    journeys: 'ساخت سفر مشتری',
    reports: 'درخواست خروجی',
    settings: 'ثبت تنظیم Preview',
  };
  return (
    <Tabs onValueChange={setTab} value={tab}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <TabsList
          aria-label={`زیر‌بخش‌های ${section}`}
          className="flex w-full flex-wrap gap-1 bg-blue-50 p-2 xl:w-auto"
        >
          {tabs.map(([key, label]) => (
            <TabsTrigger key={key} value={key}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <Button
          onClick={() =>
            onNotice(`${actionLabels[section]} به‌صورت محلی آماده شد.`)
          }
        >
          <Plus aria-hidden="true" className="size-4" />
          {actionLabels[section]}
        </Button>
      </div>
      {tabs.map(([key, , description]) => (
        <TabsContent className="mt-5" key={key} value={key}>
          <Alert
            className="mb-4"
            description={description}
            title="داده‌های ساختگی و غیرعملیاتی"
          />
          {special && key === tab ? (
            special
          ) : (
            <GenericItemGrid
              items={key === tab ? items : []}
              onNotice={onNotice}
              onOpen={onOpen}
            />
          )}
          {section === 'audiences' && key === 'subscriptions' ? (
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {marketingSuppressionSummary.map((item) => (
                <Card className="p-4" key={item.id}>
                  <ShieldCheck
                    aria-hidden="true"
                    className="size-5 text-primary"
                  />
                  <h3 className="mt-3 font-bold">{item.title}</h3>
                  <Badge className="mt-3 font-mono text-[9px]" dir="ltr">
                    {item.status}
                  </Badge>
                </Card>
              ))}
            </div>
          ) : null}
        </TabsContent>
      ))}
    </Tabs>
  );
}

export function MarketingWorkspace() {
  const [state, setState] = useState<MarketingPreviewState>('preview');
  const [section, setSection] = useState<MarketingSectionKey | null>(null);
  const [notice, setNotice] = useState(
    'داده‌های نمونه مارکتینگ آماده نمایش است.',
  );
  const [detailItem, setDetailItem] = useState<MarketingPreviewItem | null>(
    null,
  );
  const [campaignDialog, setCampaignDialog] = useState<{
    open: boolean;
    mode: CampaignFormMode;
    campaign?: CampaignPreview;
  }>({ open: false, mode: 'create' });
  const openCampaign = (mode: CampaignFormMode, campaign?: CampaignPreview) =>
    setCampaignDialog(
      campaign ? { open: true, mode, campaign } : { open: true, mode },
    );
  const selectedSection = marketingSections.find(
    (item) => item.key === section,
  );
  const genericSection =
    section && !['dashboard', 'campaigns'].includes(section)
      ? (section as GenericSectionKey)
      : null;
  return (
    <main className="grid gap-6" dir="rtl">
      <PageHeader
        actions={
          <>
            <Select
              value={state}
              onValueChange={(value) =>
                setState(value as MarketingPreviewState)
              }
            >
              <SelectTrigger aria-label="انتخاب حالت نمایش" className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {previewStates.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => openCampaign('create')}>
              <Plus aria-hidden="true" className="size-4" />
              کمپین جدید
            </Button>
          </>
        }
        description={
          selectedSection?.description ??
          'مدیریت یکپارچه کمپین، مخاطب، ارتباطات، محتوا، پیشنهاد، سفر مشتری و گزارش‌ها'
        }
        eyebrow="CRM / Marketing"
        title={selectedSection?.title ?? 'مرکز مارکتینگ'}
      />
      <Alert
        description={MARKETING_PREVIEW_NOTICE}
        title="محیط Preview غیرعملیاتی"
      >
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge className="font-mono text-[10px]" dir="ltr">
            {MARKETING_UI_VERSION}
          </Badge>
          <Badge className="font-mono text-[10px]" dir="ltr">
            {MARKETING_ANALYTICS_STATUS}
          </Badge>
          <Badge className="font-mono text-[10px]" dir="ltr">
            {MARKETING_DISPATCH_STATUS}
          </Badge>
        </div>
      </Alert>
      <div
        aria-live="polite"
        className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950"
        role="status"
      >
        <MousePointerClick aria-hidden="true" className="size-4 shrink-0" />
        <span>{notice}</span>
      </div>
      {state !== 'preview' ? (
        <StateGate onReset={() => setState('preview')} state={state} />
      ) : section === null ? (
        <MarketingHub
          onSelect={(value) => {
            setSection(value);
            setNotice(
              `بخش ${marketingSections.find((item) => item.key === value)?.title} باز شد.`,
            );
          }}
        />
      ) : (
        <section className="grid gap-5">
          <div>
            <Button
              onClick={() => {
                setSection(null);
                setNotice('به صفحه اصلی مارکتینگ برگشتید.');
              }}
              variant="ghost"
            >
              <ArrowRight aria-hidden="true" className="size-4" />
              بازگشت به بخش‌های مارکتینگ
            </Button>
          </div>
          {section === 'dashboard' ? (
            <DashboardPanel onNotice={setNotice} />
          ) : section === 'campaigns' ? (
            <CampaignsPanel onNotice={setNotice} onOpen={openCampaign} />
          ) : genericSection ? (
            <GenericSection
              key={genericSection}
              onNotice={setNotice}
              onOpen={setDetailItem}
              section={genericSection}
            />
          ) : null}
        </section>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
        <div className="flex items-center gap-2">
          <AlertTriangle aria-hidden="true" className="size-5" />
          <span>
            Persistence، Analytics و اتصال ارسال در این نسخه فعال نیست؛ همه
            شناسه‌ها با preview- شروع می‌شوند.
          </span>
        </div>
        <span>MARKETING-001B</span>
      </div>
      <Dialog
        open={campaignDialog.open}
        onOpenChange={(open) =>
          setCampaignDialog((current) => ({ ...current, open }))
        }
      >
        <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
          <DialogTitle>
            {campaignDialog.mode === 'create'
              ? 'ساخت کمپین جدید'
              : campaignDialog.mode === 'edit'
                ? 'ویرایش پیش‌نمایش کمپین'
                : 'مشاهده کمپین'}
          </DialogTitle>
          <DialogDescription>
            {campaignDialog.mode === 'view'
              ? 'اطلاعات فقط خواندنی و کاملاً ساختگی است.'
              : 'فرم چندمرحله‌ای فقط پیش‌نویس محلی می‌سازد و داده‌ای ذخیره نمی‌کند.'}
          </DialogDescription>
          <CampaignForm
            campaign={campaignDialog.campaign}
            key={`${campaignDialog.mode}-${campaignDialog.campaign?.id ?? 'new'}`}
            mode={campaignDialog.mode}
          />
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(detailItem)}
        onOpenChange={(open) => {
          if (!open) setDetailItem(null);
        }}
      >
        <DialogContent>
          <DialogTitle>{detailItem?.title ?? 'جزئیات'}</DialogTitle>
          <DialogDescription>{detailItem?.description}</DialogDescription>
          {detailItem ? (
            <dl className="mt-5 grid gap-3 rounded-xl bg-muted/50 p-4 text-sm">
              <div>
                <dt className="text-muted-foreground">وضعیت</dt>
                <dd className="font-bold">{detailItem.status}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">شناسه</dt>
                <dd className="break-all font-mono text-xs" dir="ltr">
                  {detailItem.id}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">آخرین تغییر</dt>
                <dd>{formatDate(detailItem.updatedAt)}</dd>
              </div>
            </dl>
          ) : null}
          <Button
            className="mt-5"
            onClick={() => {
              if (detailItem) setNotice(`جزئیات ${detailItem.title} تأیید شد.`);
              setDetailItem(null);
            }}
          >
            تأیید و بستن
          </Button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
