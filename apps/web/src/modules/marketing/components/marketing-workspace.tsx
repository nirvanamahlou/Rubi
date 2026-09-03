'use client';

import {
  ArrowRight,
  BadgePercent,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Download,
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
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

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
  MARKETING_ATTRIBUTION_STATUS,
  MARKETING_DISPATCH_STATUS,
  type MarketingPreviewState,
} from '../api/contracts';
import {
  campaignChannelLabels,
  campaignStatusLabels,
  executionCompanyLabels,
  filterAndSortCampaigns,
  marketingPreviewCampaigns,
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
  type MarketingPreviewItem,
  type MarketingSectionDefinition,
  type MarketingSectionKey,
} from '../model/reference-data';
import { CampaignCalendar } from './campaign-calendar';
import { CampaignForm, type CampaignFormMode } from './campaign-form';
import {
  CampaignDetailReference,
  MarketingDashboardReference,
  MarketingReferenceSection,
} from './marketing-reference-pages';

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

const toneClasses: Record<
  MarketingSectionDefinition['tone'],
  { icon: string; glow: string }
> = {
  blue: {
    icon: 'bg-blue-100 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300',
    glow: 'from-blue-400/14',
  },
  violet: {
    icon: 'bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300',
    glow: 'from-violet-400/14',
  },
  emerald: {
    icon: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300',
    glow: 'from-emerald-400/14',
  },
  amber: {
    icon: 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300',
    glow: 'from-amber-400/14',
  },
  rose: {
    icon: 'bg-rose-100 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300',
    glow: 'from-rose-400/14',
  },
  cyan: {
    icon: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-300',
    glow: 'from-cyan-400/14',
  },
};

function formatMoney(amount: string, currencyCode: string) {
  const [integer = '0', fraction] = amount.split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
  return `${grouped}${fraction ? `٫${fraction}` : ''} ${currencyCode}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'medium',
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
          <RefreshCw aria-hidden="true" className="size-4" /> بازگشت به
          پیش‌نمایش
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
    <section
      aria-labelledby="marketing-hub-title"
      className="grid gap-5 text-right"
      dir="rtl"
    >
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
          const tone = toneClasses[section.tone];
          return (
            <button
              aria-label={`ورود به بخش ${section.title}`}
              className="group rounded-2xl text-right outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              key={section.key}
              onClick={() => onSelect(section.key)}
              type="button"
            >
              <Card className="relative flex h-full min-h-64 flex-col overflow-hidden p-5 transition duration-200 group-hover:-translate-y-1 group-hover:border-primary/35 group-hover:shadow-[var(--shadow-card)]">
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent opacity-80',
                    tone.glow,
                  )}
                />
                <div className="relative flex h-full flex-col">
                  <div className="flex items-start gap-4">
                    <span
                      className={cn(
                        'grid size-14 shrink-0 place-items-center rounded-2xl transition group-hover:scale-105',
                        tone.icon,
                      )}
                    >
                      <Icon aria-hidden="true" className="size-7" />
                    </span>
                    <div className="min-w-0 pt-1">
                      <h3 className="text-base font-black leading-7 text-foreground">
                        {section.title}
                      </h3>
                      <p className="mt-1 text-xs leading-6 text-muted-foreground">
                        {section.description}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-1.5">
                    {section.highlights.map((highlight) => (
                      <Badge key={highlight}>{highlight}</Badge>
                    ))}
                  </div>

                  <div className="mt-auto flex items-center justify-between border-t border-border/70 pt-4 text-sm">
                    <span className="font-semibold text-muted-foreground">
                      {section.highlights.length.toLocaleString('fa-IR')}{' '}
                      زیرمجموعه
                    </span>
                    <span className="flex items-center gap-2 font-bold text-primary">
                      ورود به بخش
                      <ChevronLeft
                        aria-hidden="true"
                        className="size-4 transition-transform group-hover:-translate-x-1"
                      />
                    </span>
                  </div>
                </div>
              </Card>
            </button>
          );
        })}
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
            <Eye aria-hidden="true" className="size-4" /> مشاهده
          </Button>
          <Button
            onClick={() => onOpen('edit', campaign)}
            size="sm"
            variant="secondary"
          >
            <FilePenLine aria-hidden="true" className="size-4" /> ویرایش Preview
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
            <dd className="mt-1">
              داده آزمایشی ({MARKETING_ATTRIBUTION_STATUS})
            </dd>
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
          <Plus aria-hidden="true" className="size-4" /> کمپین جدید
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
              patchQuery({ status: value as MarketingCampaignQuery['status'] })
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
            <FilterX aria-hidden="true" className="size-4" /> پاک‌کردن
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
          totalLabel={`${filtered.length.toLocaleString('fa-IR')} کمپین آزمایشی`}
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

function BudgetPanel({ onNotice }: { onNotice: (message: string) => void }) {
  const rows = [
    ['جشنواره تابستان اروپا', 66, '۲.۱ از ۳.۲ میلیارد'],
    ['پرواز استانبول', 70, '۱.۴ از ۲ میلیارد'],
    ['هتل‌های دبی', 65, '۹۸۰ از ۱٬۵۰۰ میلیون'],
    ['معرفی تور نوروز', 18, '۹۰۰ از ۵ میلیارد'],
  ] as const;
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card className="p-5 xl:col-span-2">
        <h3 className="font-black">مصرف بودجه کمپین‌ها</h3>
        <div className="mt-5 grid gap-4">
          {rows.map(([label, percent, value]) => (
            <button
              className="grid gap-2 text-start sm:grid-cols-[12rem_1fr_10rem] sm:items-center"
              key={label}
              onClick={() => onNotice(`جزئیات بودجه ${label} باز شد.`)}
              type="button"
            >
              <strong>{label}</strong>
              <span className="h-2.5 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-primary"
                  style={{ width: `${percent}%` }}
                />
              </span>
              <small className="text-muted-foreground">{value}</small>
            </button>
          ))}
        </div>
      </Card>
      <Card className="p-5">
        <h3 className="font-black">کنترل هزینه</h3>
        <dl className="mt-4 grid gap-3">
          {[
            ['بودجه مصوب', '۱۱.۷ میلیارد'],
            ['هزینه قطعی', '۵.۳۸ میلیارد'],
            ['تعهد باز', '۱.۲ میلیارد'],
          ].map(([label, value]) => (
            <div
              className="flex justify-between border-b border-dashed border-border py-3 last:border-0"
              key={label}
            >
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-black">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card className="overflow-x-auto xl:col-span-3">
        <table className="w-full min-w-[54rem] text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              {[
                'کمپین',
                'نوع هزینه',
                'تأمین‌کننده',
                'مبلغ',
                'تاریخ',
                'سند مالی',
                'وضعیت',
              ].map((header) => (
                <th className="p-4 text-start" key={header}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              [
                'جشنواره تابستان اروپا',
                'پیامک',
                'کاوه‌نگار',
                '۴۲۰ میلیون',
                '۱۴۰۵/۰۶/۱۰',
                'FIN-8821',
                'قطعی',
              ],
              [
                'جشنواره تابستان اروپا',
                'تبلیغ کلیکی',
                'گوگل ادز',
                '۸۸۰ میلیون',
                '۱۴۰۵/۰۶/۱۲',
                'FIN-8848',
                'قطعی',
              ],
              [
                'پرواز استانبول',
                'بنر سایت',
                'تیم محتوا',
                '۱۲۰ میلیون',
                '۱۴۰۵/۰۶/۱۵',
                '—',
                'برآوردی',
              ],
            ].map((row) => (
              <tr className="border-t border-border" key={row.join('-')}>
                {row.map((cell) => (
                  <td className="p-4" key={cell}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function ApprovalPanel({
  onOpen,
  onNotice,
}: {
  onOpen: (mode: CampaignFormMode, campaign?: CampaignPreview) => void;
  onNotice: (message: string) => void;
}) {
  const requests = [
    ['تورهای نوروز ۱۴۰۶', '۵ میلیارد', 'حسین موسوی', '۲ ساعت پیش'],
    ['بازگشت مشتریان غیرفعال', '۸۰۰ میلیون', 'مریم احمدی', '۵ ساعت پیش'],
    ['پیشنهاد ویژه کیش', '۱.۲ میلیارد', 'علی رضایی', 'دیروز'],
  ] as const;
  return (
    <section className="grid gap-4 md:grid-cols-2">
      {requests.map(([name, budget, owner, time], index) => (
        <Card className="p-5" key={name}>
          <div className="flex justify-between gap-3">
            <div>
              <h3 className="font-black">{name}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                درخواست فعال‌سازی کمپین
              </p>
            </div>
            <Badge className="bg-amber-100 text-amber-800">
              در انتظار تأیید
            </Badge>
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-lg bg-muted/40 p-3">
              <dt className="text-xs text-muted-foreground">بودجه</dt>
              <dd className="mt-1 font-bold">{budget}</dd>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <dt className="text-xs text-muted-foreground">درخواست‌کننده</dt>
              <dd className="mt-1 font-bold">{owner}</dd>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <dt className="text-xs text-muted-foreground">زمان</dt>
              <dd className="mt-1 font-bold">{time}</dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() => onNotice(`${name} در Preview تأیید شد.`)}
              size="sm"
            >
              تأیید
            </Button>
            <Button
              onClick={() => onNotice(`${name} برای اصلاح بازگردانده شد.`)}
              size="sm"
              variant="destructive"
            >
              بازگشت برای اصلاح
            </Button>
            <Button
              onClick={() =>
                onOpen(
                  'view',
                  marketingPreviewCampaigns[
                    index % marketingPreviewCampaigns.length
                  ],
                )
              }
              size="sm"
              variant="outline"
            >
              مشاهده جزئیات
            </Button>
          </div>
        </Card>
      ))}
    </section>
  );
}

function AbPanel({ onNotice }: { onNotice: (message: string) => void }) {
  const experiments = [
    [
      'عنوان پیام اروپا',
      'جشنواره تابستان اروپا',
      'عنوان پیامک',
      'سفر اروپا با نرخ ویژه',
      'تابستانت را در اروپا بساز',
      '۲۰٬۰۰۰',
      'B · بهبود ۱۴٪',
      'فعال',
    ],
    [
      'بنر پرواز استانبول',
      'پرواز استانبول شهریور',
      'تصویر',
      'بنر شهر',
      'بنر قیمت',
      '۳۴٬۸۰۰',
      'A · بهبود ۸٪',
      'پایان‌یافته',
    ],
    [
      'CTA هتل دبی',
      'هتل‌های دبی پاییز',
      'متن دکمه',
      'مشاهده هتل‌ها',
      'رزرو با تخفیف',
      '۱۲٬۴۰۰',
      'هنوز معنادار نیست',
      'درحال جمع‌آوری',
    ],
  ] as const;
  return (
    <Card className="overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <h3 className="font-black">تست‌های A/B</h3>
        <Button onClick={() => onNotice('فرم تست A/B جدید باز شد.')}>
          <Plus aria-hidden="true" className="size-4" /> تست جدید
        </Button>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[72rem] text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              {[
                'نام تست',
                'کمپین',
                'متغیر',
                'نسخه A',
                'نسخه B',
                'نمونه',
                'نتیجه فعلی',
                'وضعیت',
                'عملیات',
              ].map((header) => (
                <th className="p-4 text-start" key={header}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {experiments.map((row) => (
              <tr className="border-t border-border" key={row[0]}>
                {row.map((cell) => (
                  <td className="p-4" key={cell}>
                    {cell}
                  </td>
                ))}
                <td className="p-4">
                  <Button
                    aria-label={`مشاهده ${row[0]}`}
                    onClick={() => onNotice(`نسخه‌های ${row[0]} باز شد.`)}
                    size="icon"
                    variant="outline"
                  >
                    <Eye aria-hidden="true" className="size-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
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
        className="flex h-auto w-full flex-wrap justify-start gap-1 bg-blue-50 p-2 dark:bg-blue-950/40"
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
        <BudgetPanel onNotice={onNotice} />
      </TabsContent>
      <TabsContent className="mt-5" value="approval">
        <ApprovalPanel onNotice={onNotice} onOpen={onOpen} />
      </TabsContent>
      <TabsContent className="mt-5" value="ab">
        <AbPanel onNotice={onNotice} />
      </TabsContent>
    </Tabs>
  );
}

type GenericSectionKey = Exclude<
  MarketingSectionKey,
  'dashboard' | 'campaigns'
>;

export function MarketingWorkspace() {
  const [state, setState] = useState<MarketingPreviewState>('preview');
  const [section, setSection] = useState<MarketingSectionKey | null>(null);
  const [notice, setNotice] = useState('');
  const [detailItem, setDetailItem] = useState<MarketingPreviewItem | null>(
    null,
  );
  const [campaignDialog, setCampaignDialog] = useState<{
    open: boolean;
    mode: CampaignFormMode;
    campaign?: CampaignPreview;
  }>({ open: false, mode: 'create' });
  const syncSectionFromHistory = useCallback(() => {
    const requestedSection = new URL(window.location.href).searchParams.get(
      'section',
    );
    setSection(
      marketingSections.some((item) => item.key === requestedSection)
        ? (requestedSection as MarketingSectionKey)
        : null,
    );
    setNotice('');
  }, []);
  useEffect(() => {
    const initialSyncFrame = window.requestAnimationFrame(
      syncSectionFromHistory,
    );
    window.addEventListener('popstate', syncSectionFromHistory);
    return () => {
      window.cancelAnimationFrame(initialSyncFrame);
      window.removeEventListener('popstate', syncSectionFromHistory);
    };
  }, [syncSectionFromHistory]);
  const navigateToSection = useCallback(
    (nextSection: MarketingSectionKey | null, replace = false) => {
      const url = new URL(window.location.href);
      if (nextSection) url.searchParams.set('section', nextSection);
      else url.searchParams.delete('section');
      const nextUrl = `${url.pathname}${url.search}${url.hash}`;
      const method = replace ? 'replaceState' : 'pushState';
      window.history[method](window.history.state, '', nextUrl);
      setSection(nextSection);
      setNotice('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [],
  );
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
  const secondaryHeaderAction =
    section === 'dashboard'
      ? 'خروجی داشبورد'
      : section === 'campaigns'
        ? 'خروجی اکسل'
        : section === 'audiences'
          ? 'ورود گروهی Excel'
          : section === 'communications'
            ? 'گزارش ارسال'
            : section === 'content'
              ? 'خروجی فایل‌ها'
              : section === 'offers'
                ? 'گزارش استفاده'
                : section === 'journeys'
                  ? 'گزارش اجرا'
                  : section === 'settings'
                    ? 'خروجی تنظیمات'
                    : null;
  return (
    <main
      className="grid gap-6 text-right [&_td]:text-right [&_th]:text-right"
      dir="rtl"
    >
      <PageHeader
        actions={
          <>
            {section === null ? (
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
            ) : secondaryHeaderAction ? (
              <Button
                onClick={() => setNotice(`${secondaryHeaderAction} آماده شد.`)}
                variant="outline"
              >
                <Download aria-hidden="true" className="size-4" />{' '}
                {secondaryHeaderAction}
              </Button>
            ) : null}
            {section === null || section === 'campaigns' ? (
              <Button onClick={() => openCampaign('create')}>
                <Plus aria-hidden="true" className="size-4" /> ایجاد کمپین
              </Button>
            ) : null}
          </>
        }
        description={
          selectedSection?.description ??
          'مدیریت یکپارچه کمپین، مخاطب، ارتباطات، محتوا، پیشنهاد، سفر مشتری و گزارش‌ها'
        }
        title={selectedSection?.title ?? 'مرکز مارکتینگ'}
      />
      {state !== 'preview' ? (
        <StateGate onReset={() => setState('preview')} state={state} />
      ) : section === null ? (
        <MarketingHub
          onSelect={(value) => {
            navigateToSection(value);
          }}
        />
      ) : (
        <section className="grid gap-5">
          <div>
            <Button
              onClick={() => {
                navigateToSection(null, true);
              }}
              variant="ghost"
            >
              <ArrowRight aria-hidden="true" className="size-4" /> بازگشت به
              بخش‌های مارکتینگ
            </Button>
          </div>
          {section === 'dashboard' ? (
            <MarketingDashboardReference
              onNotice={setNotice}
              onOpen={setDetailItem}
            />
          ) : section === 'campaigns' ? (
            <CampaignsPanel onNotice={setNotice} onOpen={openCampaign} />
          ) : genericSection ? (
            <MarketingReferenceSection
              key={genericSection}
              onNotice={setNotice}
              onOpen={setDetailItem}
              section={genericSection}
            />
          ) : null}
        </section>
      )}
      {notice ? (
        <div
          aria-live="polite"
          className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground shadow-sm"
          role="status"
        >
          <MousePointerClick
            aria-hidden="true"
            className="size-4 shrink-0 text-primary"
          />
          <span>{notice}</span>
        </div>
      ) : null}
      <Dialog
        open={campaignDialog.open}
        onOpenChange={(open) =>
          setCampaignDialog((current) => ({ ...current, open }))
        }
      >
        <DialogContent className="max-h-[92vh] max-w-7xl overflow-y-auto">
          <DialogTitle>
            {campaignDialog.mode === 'create'
              ? 'ساخت کمپین جدید'
              : campaignDialog.mode === 'edit'
                ? 'ویرایش پیش‌نمایش کمپین'
                : 'جزئیات کمپین'}
          </DialogTitle>
          {campaignDialog.mode === 'view' ? (
            <DialogDescription>
              نمای ۳۶۰ درجه کمپین با داده‌های کاملاً آزمایشی مرجع.
            </DialogDescription>
          ) : null}
          {campaignDialog.mode === 'view' && campaignDialog.campaign ? (
            <CampaignDetailReference
              campaign={campaignDialog.campaign}
              onNotice={setNotice}
            />
          ) : (
            <CampaignForm
              campaign={campaignDialog.campaign}
              key={`${campaignDialog.mode}-${campaignDialog.campaign?.id ?? 'new'}`}
              mode={campaignDialog.mode}
            />
          )}
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
                <dt className="text-muted-foreground">شناسه آزمایشی</dt>
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
