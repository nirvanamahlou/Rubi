'use client';
import { MarketingSectionMetrics } from './marketing-section-metrics';
import { currencySymbol } from '@/lib/currency-symbol';
import { useRouteAccess } from '@/modules/iam/access-context';
import type {
  AuthenticatedActor,
  MarketingCampaignPageV1,
} from '@nora/contracts';

import {
  BadgePercent,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FilePenLine,
  ListPlus,
  FileStack,
  FilterX,
  Gauge,
  Megaphone,
  MessageSquareText,
  MousePointerClick,
  Plus,
  Power,
  Route,
  Search,
  Target,
  Settings2,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

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
  FilterBar,
  PageHeader,
  PaginationShell,
} from '@/components/ui/surfaces';
import { cn } from '@/lib/utils';
import { MARKETING_SECTION_CHANGE_EVENT } from '@/lib/navigation';
import { marketingApi } from '../api/records-client';
import {
  campaignChannelLabels,
  campaignStatusLabels,
  executionCompanyLabels,
  normalizeMarketingCampaignQuery,
  type CampaignChannel,
  type CampaignPreview,
  type CampaignStatus,
  type ExecutionCompany,
  type MarketingCampaignQuery,
} from '../model/marketing';
import {
  campaignInputFromDraft,
  campaignPreviewFromRecord,
  ensureCampaignPublicationAttempt,
  executeCampaignPublication,
  type CampaignPublicationAttempt,
  type SegmentOption,
} from '../model/durable-records';
import {
  marketingSectionTabs,
  marketingSections,
  type MarketingPreviewItem,
  type MarketingSectionDefinition,
  type MarketingSectionKey,
} from '../model/reference-data';
import { downloadRowsAsExcel } from '../utils/excel-export';
import { CampaignDeleteButton } from './campaign-delete-button';
import { CampaignCalendar } from './campaign-calendar';
import {
  CampaignForm,
  type CampaignDraft,
  type CampaignFormMode,
} from './campaign-form';
import { CampaignDetail } from './campaign-detail';
import { CampaignDeclarationsForm } from './campaign-declarations-form';
import {
  MarketingDashboardReference,
  MarketingReferenceSection,
} from './marketing-reference-pages';

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
  process: Route,
  dashboard: Gauge,
  campaigns: Megaphone,
  audiences: UsersRound,
  leads: Target,
  communications: MessageSquareText,
  content: FileStack,
  offers: BadgePercent,
  journeys: Route,
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
  return `${grouped}${fraction ? `٫${fraction}` : ''} ${currencySymbol(currencyCode)}`;
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

function MarketingHub({
  onSelect,
}: {
  onSelect: (section: MarketingSectionKey) => void;
}) {
  const allowed = useRouteAccess();
  return (
    <section
      aria-label="فهرست کارت‌های ماژول مارکتینگ"
      className="text-right"
      dir="rtl"
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {marketingSections
          .filter((section) => allowed('/marketing?section=' + section.key))
          .map((section) => {
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

export function CampaignCard({
  campaign,
  disabled,
  onOpen,
  onToggleActive,
  onDetails,
  onDeleted,
}: {
  campaign: CampaignPreview;
  disabled: boolean;
  onOpen: (mode: CampaignFormMode, campaign: CampaignPreview) => void;
  onToggleActive: () => void;
  onDetails: () => void;
  onDeleted?: () => void;
}) {
  return (
    <Card className={cn('p-4 transition', disabled && 'opacity-60')}>
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
            aria-label={`ثبت جزئیات ${campaign.name}`}
            title="ثبت جزئیات"
            size="icon"
            variant="outline"
            onClick={onDetails}
          >
            <ListPlus aria-hidden="true" className="size-4" />
          </Button>
          <Button
            aria-label={
              disabled
                ? `فعال‌سازی ${campaign.name}`
                : `غیرفعال‌سازی ${campaign.name}`
            }
            className={cn(
              disabled
                ? 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                : 'border-destructive/35 text-destructive hover:bg-destructive/10 hover:text-destructive',
            )}
            onClick={onToggleActive}
            size="icon"
            title={disabled ? 'فعال‌سازی' : 'غیرفعال‌سازی'}
            variant="outline"
          >
            <Power aria-hidden="true" className="size-4" />
          </Button>
          <Button
            aria-label={`مشاهده ${campaign.name}`}
            onClick={() => onOpen('view', campaign)}
            size="icon"
            title="مشاهده"
            variant="outline"
          >
            <Eye aria-hidden="true" className="size-4" />
          </Button>
          <Button
            aria-label={`ویرایش ${campaign.name}`}
            onClick={() => onOpen('edit', campaign)}
            size="icon"
            title="ویرایش"
            variant="secondary"
          >
            <FilePenLine aria-hidden="true" className="size-4" />
          </Button>
          {onDeleted ? (
            <CampaignDeleteButton campaign={campaign} onDeleted={onDeleted} />
          ) : null}
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
            {formatMoney(
              campaign.budgetAmount,
              campaign.budgetCurrencyCode ?? campaign.currencyCode,
            )}
            {' / '}
            {(
              campaign.spendTotals ?? [
                {
                  amount: campaign.spendAmount,
                  currencyCode: campaign.currencyCode,
                },
              ]
            )
              .map((total) => formatMoney(total.amount, total.currencyCode))
              .join(' + ')}
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
              انتساب مالی در این قرارداد مارکتینگ موجود نیست.
            </dd>
          </div>
        </dl>
      </details>
    </Card>
  );
}

function CampaignList({
  segments,
  revision,
  onOpen,
  onNotice,
  onDetails,
}: {
  segments: readonly SegmentOption[];
  revision: number;
  onOpen: (mode: CampaignFormMode, campaign?: CampaignPreview) => void;
  onNotice: (message: string) => void;
  onDetails: (campaign: CampaignPreview) => void;
}) {
  const [query, setQuery] = useState<MarketingCampaignQuery>(() =>
    normalizeMarketingCampaignQuery({}),
  );
  const [disabledCampaigns, setDisabledCampaigns] = useState<Set<string>>(
    () => new Set(),
  );
  const [result, setResult] = useState<MarketingCampaignPageV1>({
    data: [],
    page: 1,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [exporting, setExporting] = useState(false);
  const onRetry = () => setReload((value) => value + 1);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError('');
      void marketingApi
        .campaignPage(query, controller.signal)
        .then((response) => {
          if (!controller.signal.aborted) setResult(response);
        })
        .catch((reason: unknown) => {
          if (!controller.signal.aborted)
            setError(
              reason instanceof Error
                ? reason.message
                : 'دریافت کمپین‌ها انجام نشد.',
            );
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, revision, reload]);
  const totalPages = Math.max(1, Math.ceil(result.total / query.pageSize));
  const currentPage = result.page;
  const campaigns = result.data.map((record) =>
    campaignPreviewFromRecord(record, segments),
  );
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
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={exporting || loading || Boolean(error)}
            onClick={async () => {
              setExporting(true);
              try {
                const filtered: CampaignPreview[] = [];
                for (let page = 1; ; page++) {
                  const response = await marketingApi.campaignPage({
                    ...query,
                    page,
                    pageSize: 20,
                  });
                  if (response.page !== page) break;
                  filtered.push(
                    ...response.data.map((row) =>
                      campaignPreviewFromRecord(row, segments),
                    ),
                  );
                  if (page * 20 >= response.total) break;
                }
                downloadRowsAsExcel({
                  filename: 'کمپین‌های-مارکتینگ',
                  sheetName: 'کمپین‌ها',
                  columns: [
                    'کد',
                    'نام',
                    'نوع',
                    'شرکت مجری',
                    'شروع',
                    'پایان',
                    'وضعیت',
                  ],
                  rows: filtered.map((item) => [
                    item.internalCode,
                    item.name,
                    item.campaignType,
                    executionCompanyLabels[item.executionCompany],
                    formatDate(item.startsAt),
                    formatDate(item.endsAt),
                    campaignStatusLabels[item.status],
                  ]),
                });
                onNotice('خروجی اکسل کمپین‌های فیلترشده دانلود شد.');
              } catch (reason) {
                onNotice(
                  reason instanceof Error
                    ? reason.message
                    : 'دریافت کمپین‌ها انجام نشد.',
                );
              } finally {
                setExporting(false);
              }
            }}
            variant="outline"
          >
            <Download aria-hidden="true" className="size-4" /> خروجی اکسل
          </Button>
          <Button
            aria-label="افزودن کمپین جدید"
            onClick={() => onOpen('create')}
            size="icon"
            title="کمپین جدید"
          >
            <Plus aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </div>
      <FilterBar className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
      {loading ? (
        <Card className="p-6 text-center" role="status">
          در حال دریافت کمپین‌ها…
        </Card>
      ) : error ? (
        <Card className="grid gap-3 p-6 text-center" role="alert">
          <p>{error}</p>
          <Button
            className="justify-self-center"
            onClick={onRetry}
            variant="outline"
          >
            تلاش دوباره
          </Button>
        </Card>
      ) : campaigns.length ? (
        <div className="grid gap-4">
          {campaigns.map((campaign) => (
            <CampaignCard
              campaign={campaign}
              disabled={disabledCampaigns.has(campaign.id)}
              key={campaign.id}
              onOpen={(mode, item) => onOpen(mode, item)}
              onDetails={() => onDetails(campaign)}
              onDeleted={onRetry}
              onToggleActive={() => {
                const isDisabled = disabledCampaigns.has(campaign.id);
                setDisabledCampaigns((current) => {
                  const next = new Set(current);
                  if (next.has(campaign.id)) next.delete(campaign.id);
                  else next.add(campaign.id);
                  return next;
                });
                onNotice(
                  isDisabled
                    ? `کمپین «${campaign.name}» فعال شد.`
                    : `کمپین «${campaign.name}» غیرفعال شد.`,
                );
              }}
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
          totalLabel={`${result.total.toLocaleString('fa-IR')} کمپین ثبت‌شده`}
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

function BudgetPanel({ campaigns }: { campaigns: readonly CampaignPreview[] }) {
  return (
    <div className="grid gap-4">
      <Card className="p-5">
        <h3 className="font-black">مصرف بودجه کمپین‌ها</h3>
        <div className="mt-5 grid gap-4">
          {campaigns.map((campaign) => (
            <div
              className="grid gap-2 text-start sm:grid-cols-[12rem_1fr_18rem] sm:items-center"
              key={campaign.id}
            >
              <strong>{campaign.name}</strong>
              <span className="h-2.5 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-primary"
                  style={{
                    width: `${Math.min(100, Number(campaign.progressPercent))}%`,
                  }}
                />
              </span>
              <small className="text-muted-foreground" dir="ltr">
                {formatMoney(
                  campaign.budgetAmount,
                  campaign.budgetCurrencyCode ?? campaign.currencyCode,
                )}
                {' / '}
                {(campaign.spendTotals ?? [])
                  .map((total) => formatMoney(total.amount, total.currencyCode))
                  .join(' + ') || '—'}
              </small>
            </div>
          ))}
        </div>
      </Card>
      <Card className="grid gap-3 p-5">
        <h3 className="font-black">ریز هزینه‌های کمپین‌ها</h3>
        {campaigns.flatMap((campaign) =>
          (campaign.spendLines ?? []).map((line, index) => (
            <div
              className="grid gap-2 border-b py-3 sm:grid-cols-3"
              key={`${campaign.id}-${line.id ?? index}`}
            >
              <strong>{campaign.name}</strong>
              <span>{line.label}</span>
              <span dir="ltr">
                {formatMoney(line.amount, line.currencyCode)}
              </span>
            </div>
          )),
        )}
        {!campaigns.some((campaign) => campaign.spendLines?.length) ? (
          <p className="text-sm text-muted-foreground">
            هنوز هزینه‌ای ثبت نشده است.
          </p>
        ) : null}
      </Card>
    </div>
  );
}

function CampaignsPanel({
  segments,
  revision,
  onOpen,
  onNotice,
  onDetails,
}: {
  segments: readonly SegmentOption[];
  revision: number;
  onOpen: (mode: CampaignFormMode, campaign?: CampaignPreview) => void;
  onNotice: (message: string) => void;
  onDetails: (campaign: CampaignPreview) => void;
}) {
  const [tab, setTab] = useState('list');
  const [auxiliary, setAuxiliary] = useState<MarketingCampaignPageV1['data']>(
    [],
  );
  const [auxiliaryError, setAuxiliaryError] = useState('');
  const [auxiliaryLoading, setAuxiliaryLoading] = useState(false);
  useEffect(() => {
    if (tab === 'list') return;
    let current = true;
    const timer = window.setTimeout(() => {
      setAuxiliaryLoading(true);
      setAuxiliaryError('');
      void marketingApi
        .campaigns()
        .then((response) => {
          if (current) setAuxiliary(response.data);
        })
        .catch((reason: unknown) => {
          if (current)
            setAuxiliaryError(
              reason instanceof Error
                ? reason.message
                : 'دریافت کمپین‌ها انجام نشد.',
            );
        })
        .finally(() => {
          if (current) setAuxiliaryLoading(false);
        });
    }, 0);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [tab, revision]);
  const campaigns = auxiliary.map((record) =>
    campaignPreviewFromRecord(record, segments),
  );
  const auxiliaryNotice = auxiliaryLoading ? (
    <p role="status">در حال دریافت کمپین‌ها…</p>
  ) : auxiliaryError ? (
    <p role="alert">{auxiliaryError}</p>
  ) : null;
  return (
    <Tabs
      className="grid gap-0 text-right"
      dir="rtl"
      onValueChange={setTab}
      value={tab}
    >
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
        <CampaignList
          segments={segments}
          revision={revision}
          onNotice={onNotice}
          onOpen={onOpen}
          onDetails={onDetails}
        />
      </TabsContent>
      <TabsContent className="mt-5" value="calendar">
        {auxiliaryNotice ?? (
          <CampaignCalendar
            campaigns={campaigns}
            onOpen={(campaign) => onOpen('view', campaign)}
          />
        )}
      </TabsContent>
      <TabsContent className="mt-5" value="budget">
        {auxiliaryNotice ?? <BudgetPanel campaigns={campaigns} />}
      </TabsContent>
    </Tabs>
  );
}

type GenericSectionKey = Exclude<
  MarketingSectionKey,
  'process' | 'dashboard' | 'campaigns'
>;

function resolveMarketingSection(
  requestedSection: string | null,
): MarketingSectionKey | null {
  return marketingSections.some((item) => item.key === requestedSection)
    ? (requestedSection as MarketingSectionKey)
    : null;
}

export function MarketingWorkspace({
  initialSection = null,
}: {
  initialSection?: string | null;
}) {
  const router = useRouter();
  const [actor, setActor] = useState<AuthenticatedActor | null>(null);
  const [campaignRevision, setCampaignRevision] = useState(0);
  const [segments, setSegments] = useState<SegmentOption[]>([]);
  const publicationAttempt = useRef<CampaignPublicationAttempt | null>(null);
  const [section, setSection] = useState<MarketingSectionKey | null>(() =>
    resolveMarketingSection(initialSection),
  );
  const [notice, setNotice] = useState('');
  const [detailItem, setDetailItem] = useState<MarketingPreviewItem | null>(
    null,
  );
  const [campaignDialog, setCampaignDialog] = useState<{
    open: boolean;
    mode: CampaignFormMode;
    campaign?: CampaignPreview;
  }>({ open: false, mode: 'create' });
  const [declarationsCampaign, setDeclarationsCampaign] =
    useState<CampaignPreview | null>(null);
  useEffect(() => {
    if (section !== 'campaigns') return;
    let current = true;
    void Promise.all([marketingApi.access(), marketingApi.assets('SEGMENT')])
      .then(([access, response]) => {
        if (!current) return;
        setActor(access);
        setSegments(response.data.map(({ id, name }) => ({ id, name })));
      })
      .catch((reason: unknown) => {
        if (current)
          setNotice(
            reason instanceof Error
              ? reason.message
              : 'دریافت کمپین‌ها انجام نشد.',
          );
      });
    return () => {
      current = false;
    };
  }, [section]);
  const syncSectionFromHistory = useCallback(() => {
    const requestedSection = new URL(window.location.href).searchParams.get(
      'section',
    );
    setSection(resolveMarketingSection(requestedSection));
    setNotice('');
  }, []);
  useEffect(() => {
    window.addEventListener('popstate', syncSectionFromHistory);
    return () => {
      window.removeEventListener('popstate', syncSectionFromHistory);
    };
  }, [syncSectionFromHistory]);
  const navigateToSection = useCallback(
    (nextSection: MarketingSectionKey | null, replace = false) => {
      const url = new URL(window.location.href);
      if (nextSection) url.searchParams.set('section', nextSection);
      else url.searchParams.delete('section');
      const nextUrl = `${url.pathname}${url.search}${url.hash}`;
      if (replace) router.replace(nextUrl, { scroll: false });
      else router.push(nextUrl, { scroll: false });
      window.dispatchEvent(
        new CustomEvent(MARKETING_SECTION_CHANGE_EVENT, {
          detail: nextSection,
        }),
      );
      setSection(nextSection);
      setNotice('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [router],
  );
  const openCampaign = (mode: CampaignFormMode, campaign?: CampaignPreview) =>
    setCampaignDialog(
      campaign ? { open: true, mode, campaign } : { open: true, mode },
    );
  const selectedSection = marketingSections.find(
    (item) => item.key === section,
  );
  const genericSection =
    section && !['process', 'dashboard', 'campaigns'].includes(section)
      ? (section as GenericSectionKey)
      : null;
  return (
    <main
      className="grid gap-6 text-right [&_td]:text-right [&_th]:text-right"
      dir="rtl"
    >
      <PageHeader
        description={
          section === 'content'
            ? ''
            : (selectedSection?.description ??
              'مدیریت یکپارچه کمپین، مخاطب، محتوا و پیشنهاد')
        }
        title={selectedSection?.title ?? 'مرکز مارکتینگ'}
      />
      {section === null ? (
        <MarketingHub
          onSelect={(value) => {
            navigateToSection(value);
          }}
        />
      ) : (
        <section className="grid gap-5">
          {section === 'dashboard' ? (
            <MarketingDashboardReference
              onNotice={setNotice}
              onOpen={setDetailItem}
            />
          ) : section === 'campaigns' ? (
            <>
              <MarketingSectionMetrics section="campaigns" />
              <CampaignsPanel
                segments={segments}
                revision={campaignRevision}
                onNotice={setNotice}
                onOpen={openCampaign}
                onDetails={setDeclarationsCampaign}
              />
            </>
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
          className="fixed bottom-6 left-6 z-[80] flex max-w-md items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground shadow-lg"
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
        open={Boolean(declarationsCampaign)}
        onOpenChange={(open) => {
          if (!open) setDeclarationsCampaign(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogTitle>
            ثبت جزئیات کمپین — {declarationsCampaign?.name}
          </DialogTitle>
          {declarationsCampaign ? (
            <CampaignDeclarationsForm
              key={declarationsCampaign.id}
              campaign={declarationsCampaign}
              onSave={async (input, key) => {
                await marketingApi.updateCampaign(
                  declarationsCampaign.id,
                  input,
                  key,
                );
                setCampaignRevision((value) => value + 1);
                setDeclarationsCampaign(null);
                setNotice('پیشرفت، هزینه‌ها و لینک‌های کمپین ذخیره شدند.');
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
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
                ? 'ویرایش کمپین'
                : 'جزئیات کمپین'}
          </DialogTitle>
          {campaignDialog.mode === 'view' ? (
            <DialogDescription>
              نمای ۳۶۰ درجه کمپین با داده‌های ذخیره‌شده سرور.
            </DialogDescription>
          ) : null}
          {campaignDialog.mode === 'view' && campaignDialog.campaign ? (
            <CampaignDetail
              campaign={campaignDialog.campaign}
              onPublish={async () => {
                const campaign = campaignDialog.campaign;
                if (!campaign || campaign.status !== 'DRAFT') return;
                try {
                  await marketingApi.publishCampaign(
                    campaign.id,
                    campaign.version,
                  );
                  setCampaignRevision((value) => value + 1);
                  setCampaignDialog((current) => ({ ...current, open: false }));
                  setNotice('پیش‌نویس ذخیره‌شده منتشر شد.');
                } catch (error) {
                  setNotice(
                    error instanceof Error
                      ? error.message
                      : 'انتشار پیش‌نویس انجام نشد.',
                  );
                }
              }}
            />
          ) : (
            <CampaignForm
              campaign={campaignDialog.campaign}
              key={`${campaignDialog.mode}-${campaignDialog.campaign?.id ?? 'new'}`}
              mode={campaignDialog.mode}
              ownerUserId={actor?.userId ?? ''}
              segments={segments}
              onSave={async (draft: CampaignDraft) => {
                if (!actor?.branchIds[0])
                  throw new Error('شعبه فعال برای ذخیره مشخص نیست.');
                const input = campaignInputFromDraft(
                  draft,
                  campaignDialog.campaign,
                );
                if (campaignDialog.mode === 'create') {
                  publicationAttempt.current = ensureCampaignPublicationAttempt(
                    publicationAttempt.current,
                    input,
                  );
                  await executeCampaignPublication(
                    publicationAttempt.current,
                    input,
                    actor.branchIds[0],
                    marketingApi,
                  );
                  publicationAttempt.current = null;
                  setNotice(
                    'کمپین در سامانه منتشر شد؛ اتصال خارجی همچنان غیرفعال است.',
                  );
                } else if (campaignDialog.campaign) {
                  await marketingApi.updateCampaign(
                    campaignDialog.campaign.id,
                    input,
                  );
                  setNotice('تغییرات کمپین با ثبت نسخه و سابقه ذخیره شد.');
                }
                setCampaignRevision((value) => value + 1);
                setCampaignDialog((current) => ({ ...current, open: false }));
              }}
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
            aria-label="تأیید و بستن"
            className="mt-5"
            size="icon"
            title="تأیید و بستن"
            onClick={() => {
              if (detailItem) setNotice(`جزئیات ${detailItem.title} تأیید شد.`);
              setDetailItem(null);
            }}
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
