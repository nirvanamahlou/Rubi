'use client';

import {
  AlertTriangle,
  BadgePercent,
  BarChart3,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Eye,
  FilePenLine,
  Filter,
  Megaphone,
  MessageSquareOff,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Tags,
  Target,
  UsersRound,
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
  marketingAttributionModels,
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
import { CampaignForm, type CampaignFormMode } from './campaign-form';

type WorkspaceTab =
  | 'dashboard'
  | 'campaigns'
  | 'audiences'
  | 'channels'
  | 'offers'
  | 'attribution'
  | 'budget'
  | 'timeline'
  | 'consent';

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
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton className="h-36" key={index} />
        ))}
      </div>
    );
  }
  if (state === 'empty') {
    return (
      <EmptyState
        title="هنوز کمپینی وجود ندارد"
        description="پس از اتصال Persistence، کمپین‌های مجاز اینجا نمایش داده می‌شوند."
        action={<Button onClick={onReset}>نمایش پیش‌نمایش</Button>}
      />
    );
  }

  const states: Record<
    Exclude<MarketingPreviewState, 'preview' | 'loading' | 'empty'>,
    { title: string; description: string; tone?: 'warning' | 'error' }
  > = {
    error: {
      title: 'دریافت اطلاعات مارکتینگ ناموفق بود',
      description:
        'خطای موقت سرور با Trace ID امن نمایش داده می‌شود؛ داده ساختگی جای پاسخ واقعی قرار نمی‌گیرد.',
      tone: 'error',
    },
    unauthorized: {
      title: 'ابتدا وارد حساب سازمانی شوید',
      description:
        'پاسخ 401 باید کاربر را به جریان ورود هدایت کند و جزئیات داخلی را افشا نکند.',
    },
    forbidden: {
      title: 'مجوز مشاهده مارکتینگ را ندارید',
      description:
        'پاسخ 403 طبق سیاست deny-by-default است؛ دسترسی را مدیر IAM تعیین می‌کند.',
    },
    conflict: {
      title: 'نسخه کمپین تغییر کرده است',
      description:
        'پاسخ 409 یعنی expectedVersion قدیمی است. اطلاعات تازه را دریافت و تغییر را دوباره بررسی کنید.',
      tone: 'warning',
    },
    'awaiting-integration': {
      title: 'ارسال واقعی هنوز متصل نیست',
      description: `Intentها با وضعیت ${MARKETING_DISPATCH_STATUS} باقی می‌مانند؛ Provider، Credential، Retry و Delivery Receipt متعلق به Integrations/Notifications است.`,
      tone: 'warning',
    },
  };
  const selected = states[state];
  return (
    <ErrorState
      title={selected.title}
      description={selected.description}
      action={
        <Button onClick={onReset} variant="outline">
          <RefreshCw aria-hidden="true" className="size-4" />
          بازگشت به پیش‌نمایش
        </Button>
      }
    />
  );
}

function KpiGrid() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {marketingKpiDefinitions.map((kpi) => (
        <Card className="p-4" key={kpi.key}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold">{kpi.title}</p>
              <p className="mt-3 text-2xl font-black text-muted-foreground">
                —
              </p>
            </div>
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <BarChart3 aria-hidden="true" className="size-5" />
            </span>
          </div>
          <p className="mt-3 text-xs leading-6 text-muted-foreground">
            {kpi.definition}
          </p>
          <details className="mt-3 rounded-xl bg-muted/60 p-3 text-xs">
            <summary className="cursor-pointer font-semibold">
              تعریف محاسبه
            </summary>
            <p className="mt-2 leading-6">صورت: {kpi.numerator}</p>
            <p className="leading-6">مخرج: {kpi.denominator ?? 'ندارد'}</p>
          </details>
          <Badge
            className="mt-3 max-w-full break-all font-mono text-[10px]"
            dir="ltr"
          >
            {kpi.status}
          </Badge>
        </Card>
      ))}
    </div>
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
        <div className="flex shrink-0 flex-wrap gap-2">
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
            <dt className="text-muted-foreground">Segment Reference</dt>
            <dd className="mt-1 break-all font-mono text-xs" dir="ltr">
              {campaign.segmentReference}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">مالک</dt>
            <dd className="mt-1">{campaign.ownerRole}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">پیشنهاد / کوپن</dt>
            <dd className="mt-1">
              {campaign.offerTitle} / {campaign.couponCode ?? 'ندارد'}
            </dd>
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
          <div>
            <dt className="text-muted-foreground">نسخه / به‌روزرسانی</dt>
            <dd className="mt-1">
              نسخه {campaign.version.toLocaleString('fa-IR')}،{' '}
              {formatDate(campaign.updatedAt)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">شناسه Preview</dt>
            <dd className="mt-1 break-all font-mono text-xs" dir="ltr">
              {campaign.id}
            </dd>
          </div>
        </dl>
      </details>
    </Card>
  );
}

function CampaignsPanel({
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
          <h2 className="text-xl font-black">کمپین‌ها</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            جست‌وجو، فیلتر، مرتب‌سازی و صفحه‌بندی بدون جدول عریض
          </p>
        </div>
        <Button onClick={() => onOpen('create')}>
          <Plus aria-hidden="true" className="size-4" />
          کمپین جدید
        </Button>
      </div>

      <FilterBar className="grid sm:grid-cols-2 xl:grid-cols-6">
        <FormField id="marketing-search" label="جست‌وجو">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="absolute end-3 top-3.5 size-4 text-muted-foreground"
            />
            <Input
              className="pe-10"
              id="marketing-search"
              placeholder="نام، کد یا هدف"
              value={query.search}
              onChange={(event) => patchQuery({ search: event.target.value })}
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
        <FormField id="marketing-page-size" label="تعداد در صفحه">
          <Select
            value={String(query.pageSize)}
            onValueChange={(value) => patchQuery({ pageSize: Number(value) })}
          >
            <SelectTrigger id="marketing-page-size">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2">۲</SelectItem>
              <SelectItem value="4">۴</SelectItem>
              <SelectItem value="8">۸</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
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
          title="نتیجه‌ای پیدا نشد"
          description="فیلترها یا عبارت جست‌وجو را تغییر دهید."
          action={
            <Button
              onClick={() => setQuery(normalizeMarketingCampaignQuery({}))}
              variant="outline"
            >
              <Filter aria-hidden="true" className="size-4" />
              پاک‌کردن فیلترها
            </Button>
          }
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

function AudiencesPanel() {
  return (
    <section className="grid gap-4">
      <Alert
        title="Segment بدون PII"
        description="Marketing فقط تعریف قواعد، شناسه ناشناس و شمارش تجمیعی را مصرف می‌کند؛ مالک داده مشتری ماژول Customers است."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        {marketingSegments.map((segment) => (
          <Card className="p-5" key={segment.id}>
            <div className="flex items-center justify-between gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <UsersRound aria-hidden="true" className="size-5" />
              </span>
              <Badge>PII: {String(segment.pii)}</Badge>
            </div>
            <h3 className="mt-4 font-black">{segment.title}</h3>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              {segment.rules}
            </p>
            <p className="mt-4 text-sm font-semibold">
              اندازه: {segment.estimatedCount}
            </p>
            <p
              className="mt-2 break-all font-mono text-xs text-muted-foreground"
              dir="ltr"
            >
              {segment.id}
            </p>
          </Card>
        ))}
      </div>
    </section>
  );
}

function ChannelsPanel() {
  return (
    <section className="grid gap-4">
      <Alert
        tone="warning"
        title="اتصال ارسال عمداً غیرفعال است"
        description={`وضعیت همه کانال‌های ارسالی: ${MARKETING_DISPATCH_STATUS}. Marketing فقط Dispatch Intent تولید می‌کند.`}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {channelOptions.map(([channel, label]) => (
          <Card
            className="flex items-center justify-between gap-3 p-4"
            key={channel}
          >
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-700">
                <Send aria-hidden="true" className="size-5" />
              </span>
              <div>
                <p className="font-bold">{label}</p>
                <p
                  className="font-mono text-xs text-muted-foreground"
                  dir="ltr"
                >
                  {channel}
                </p>
              </div>
            </div>
            <Badge>Preview</Badge>
          </Card>
        ))}
      </div>
    </section>
  );
}

function OffersPanel() {
  return (
    <section className="grid gap-5">
      <Alert
        title="مالکیت قیمت نزد Sales"
        description="Marketing فقط Offer Intent و Coupon Reference پیشنهاد می‌دهد؛ قیمت، تخفیف قابل‌اعمال و قرارداد نهایی توسط Sales قطعی می‌شوند."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {marketingOffers.map((offer) => (
          <Card className="p-5" key={offer.id}>
            <Badge>{offer.status}</Badge>
            <h3 className="mt-3 font-black">{offer.title}</h3>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              {offer.rule}
            </p>
            <p className="mt-3 text-xs">مالک نهایی: {offer.owner}</p>
          </Card>
        ))}
      </div>
      <div>
        <h3 className="mb-3 font-black">کوپن‌های پیشنهادی</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {marketingCoupons.map((coupon) => (
            <Card className="p-4" key={coupon.id}>
              <div className="flex items-center justify-between gap-3">
                <strong dir="ltr">{coupon.code}</strong>
                <Badge>{coupon.status}</Badge>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {coupon.limit}
              </p>
              <p className="mt-2 text-xs">
                انقضا: {formatDate(coupon.expiresAt)}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function AttributionPanel() {
  return (
    <section className="grid gap-4">
      <Alert
        tone="warning"
        title="Attribution هنوز تصمیم مالی نیست"
        description={`وضعیت تمام مدل‌ها ${MARKETING_ATTRIBUTION_STATUS} است. درآمد منتسب فقط بعد از قرارداد Analytics و تایید Sales/Finance قابل نمایش خواهد بود.`}
      />
      <div className="grid gap-4 md:grid-cols-3">
        {marketingAttributionModels.map((model) => (
          <Card className="p-5" key={model.id}>
            <div className="flex items-center justify-between">
              <Target aria-hidden="true" className="size-6 text-primary" />
              <Badge>{model.status}</Badge>
            </div>
            <h3 className="mt-4 font-black">{model.title}</h3>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              {model.definition}
            </p>
          </Card>
        ))}
      </div>
    </section>
  );
}

function BudgetPanel() {
  return (
    <section className="grid gap-4">
      <Alert
        title="نمای عملیاتی، نه KPI تحلیلی"
        description="مبالغ زیر داده ساختگی هر کمپین‌اند. جمع کل، CAC، ROAS و درآمد منتسب تا قرارداد Analytics با خط تیره نمایش داده می‌شوند."
      />
      <div className="grid gap-3">
        {marketingPreviewCampaigns.map((campaign) => (
          <Card
            className="grid gap-3 p-4 sm:grid-cols-4 sm:items-center"
            key={campaign.id}
          >
            <div>
              <p className="font-bold">{campaign.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {executionCompanyLabels[campaign.executionCompany]}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">بودجه</p>
              <p className="mt-1 font-semibold" dir="ltr">
                {formatMoney(campaign.budgetAmount, campaign.currencyCode)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                هزینه ثبت‌شده Preview
              </p>
              <p className="mt-1 font-semibold" dir="ltr">
                {formatMoney(campaign.spendAmount, campaign.currencyCode)}
              </p>
            </div>
            <Badge className="justify-self-start sm:justify-self-end">
              Finance Reference لازم است
            </Badge>
          </Card>
        ))}
      </div>
    </section>
  );
}

function TimelinePanel() {
  return (
    <section className="grid gap-4">
      <Alert
        title="Audit Timeline نسخه‌دار"
        description="هر تغییر وضعیت با actorReference ناشناس، دلیل، نسخه مورد انتظار و Timestamp UTC ثبت خواهد شد؛ نام فرد یا PII در Preview وجود ندارد."
      />
      <ol className="relative grid gap-4 border-s-2 border-primary/20 ps-6">
        {marketingTimeline.map((event) => (
          <li className="relative" key={event.id}>
            <span className="absolute -start-[1.95rem] top-5 size-3 rounded-full bg-primary ring-4 ring-background" />
            <Card className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong>{event.action}</strong>
                <Badge>نسخه {event.version.toLocaleString('fa-IR')}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                نقش عامل: {event.actorRole}
              </p>
              <time className="mt-2 block text-xs text-muted-foreground">
                {formatDate(event.occurredAt)}
              </time>
            </Card>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ConsentPanel() {
  return (
    <section className="grid gap-4">
      <Alert
        tone="warning"
        title="کنترل سه‌گانه قبل از هر ارسال"
        description="Consent کانال، Suppression و Frequency Cap باید دقیقاً پیش از Dispatch و با Timestamp مستقل کنترل شوند؛ نتیجه قدیمی قابل استفاده نیست."
      />
      <div className="grid gap-4 md:grid-cols-3">
        {marketingSuppressionSummary.map((item) => (
          <Card className="p-5" key={item.id}>
            <div className="flex items-center justify-between gap-3">
              <MessageSquareOff
                aria-hidden="true"
                className="size-6 text-primary"
              />
              <Badge
                className="max-w-[75%] break-all font-mono text-[10px]"
                dir="ltr"
              >
                {item.status}
              </Badge>
            </div>
            <h3 className="mt-4 font-black">{item.title}</h3>
            <p className="mt-3 text-2xl font-black text-muted-foreground">
              {item.count ?? '—'}
            </p>
          </Card>
        ))}
      </div>
      <Alert
        title="اصل حداقل دسترسی"
        description="نمایش خلاصه حساس به مجوز marketing.sensitive_summary.read نیاز دارد؛ مجوز عمومی read کافی نیست."
      />
    </section>
  );
}

export function MarketingWorkspace() {
  const [state, setState] = useState<MarketingPreviewState>('preview');
  const [tab, setTab] = useState<WorkspaceTab>('dashboard');
  const [dialog, setDialog] = useState<{
    open: boolean;
    mode: CampaignFormMode;
    campaign?: CampaignPreview | undefined;
  }>({ open: false, mode: 'create' });

  const openCampaign = (mode: CampaignFormMode, campaign?: CampaignPreview) =>
    setDialog({ open: true, mode, campaign });
  const stateGate = (
    <StateGate state={state} onReset={() => setState('preview')} />
  );

  return (
    <main className="grid gap-6" dir="rtl">
      <PageHeader
        eyebrow="CRM / Marketing"
        title="مرکز عملیات مارکتینگ"
        description="طراحی کمپین، مخاطب، پیشنهاد، بودجه و انتساب در یک محیط کنترل‌شده؛ Phase A بدون ذخیره‌سازی یا ارسال واقعی"
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
      />

      <Alert
        title="محیط Preview غیرعملیاتی"
        description={MARKETING_PREVIEW_NOTICE}
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

      {state !== 'preview' ? (
        stateGate
      ) : (
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as WorkspaceTab)}
        >
          <TabsList
            aria-label="بخش‌های مارکتینگ"
            className="grid w-full grid-cols-2 gap-1 bg-blue-50 p-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9"
          >
            <TabsTrigger value="dashboard">
              <BarChart3 aria-hidden="true" className="me-1 size-4" />
              داشبورد
            </TabsTrigger>
            <TabsTrigger value="campaigns">
              <Megaphone aria-hidden="true" className="me-1 size-4" />
              کمپین‌ها
            </TabsTrigger>
            <TabsTrigger value="audiences">
              <UsersRound aria-hidden="true" className="me-1 size-4" />
              مخاطبان
            </TabsTrigger>
            <TabsTrigger value="channels">
              <Send aria-hidden="true" className="me-1 size-4" />
              کانال‌ها
            </TabsTrigger>
            <TabsTrigger value="offers">
              <BadgePercent aria-hidden="true" className="me-1 size-4" />
              پیشنهادها
            </TabsTrigger>
            <TabsTrigger value="attribution">
              <Target aria-hidden="true" className="me-1 size-4" />
              انتساب
            </TabsTrigger>
            <TabsTrigger value="budget">
              <CircleDollarSign aria-hidden="true" className="me-1 size-4" />
              بودجه
            </TabsTrigger>
            <TabsTrigger value="timeline">
              <CalendarClock aria-hidden="true" className="me-1 size-4" />
              تاریخچه
            </TabsTrigger>
            <TabsTrigger value="consent">
              <ShieldCheck aria-hidden="true" className="me-1 size-4" />
              رضایت و منع
            </TabsTrigger>
          </TabsList>
          <TabsContent className="mt-5" value="dashboard">
            <section className="grid gap-4">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground">
                  <ClipboardList aria-hidden="true" className="size-5" />
                </span>
                <div>
                  <h2 className="text-xl font-black">
                    شاخص‌های استاندارد مارکتینگ
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    ۱۸ تعریف شفاف؛ مقدار ساختگی تولید نمی‌شود.
                  </p>
                </div>
              </div>
              <KpiGrid />
            </section>
          </TabsContent>
          <TabsContent className="mt-5" value="campaigns">
            <CampaignsPanel onOpen={openCampaign} />
          </TabsContent>
          <TabsContent className="mt-5" value="audiences">
            <AudiencesPanel />
          </TabsContent>
          <TabsContent className="mt-5" value="channels">
            <ChannelsPanel />
          </TabsContent>
          <TabsContent className="mt-5" value="offers">
            <OffersPanel />
          </TabsContent>
          <TabsContent className="mt-5" value="attribution">
            <AttributionPanel />
          </TabsContent>
          <TabsContent className="mt-5" value="budget">
            <BudgetPanel />
          </TabsContent>
          <TabsContent className="mt-5" value="timeline">
            <TimelinePanel />
          </TabsContent>
          <TabsContent className="mt-5" value="consent">
            <ConsentPanel />
          </TabsContent>
        </Tabs>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
        <div className="flex items-center gap-2">
          <AlertTriangle aria-hidden="true" className="size-5" />
          <span>
            Persistence، IAM binding، Analytics و Integration Adapter در Phase B
            نیازمند قرارداد و رزرو مستقل‌اند.
          </span>
        </div>
        <div className="flex gap-2">
          <Tags aria-hidden="true" className="size-4" />
          <span>MARKETING-001 / Phase A</span>
        </div>
      </div>

      <Dialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
      >
        <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
          <DialogTitle>
            {dialog.mode === 'create'
              ? 'ساخت کمپین جدید'
              : dialog.mode === 'edit'
                ? 'ویرایش پیش‌نمایش کمپین'
                : 'مشاهده کمپین'}
          </DialogTitle>
          <DialogDescription>
            {dialog.mode === 'view'
              ? 'اطلاعات فقط خواندنی و کاملاً ساختگی است.'
              : 'فرم چندمرحله‌ای فقط پیش‌نویس محلی می‌سازد و هیچ داده‌ای ثبت نمی‌کند.'}
          </DialogDescription>
          <CampaignForm
            campaign={dialog.campaign}
            key={`${dialog.mode}-${dialog.campaign?.id ?? 'new'}`}
            mode={dialog.mode}
          />
        </DialogContent>
      </Dialog>
    </main>
  );
}
