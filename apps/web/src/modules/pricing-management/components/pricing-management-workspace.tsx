'use client';

import type {
  IamPermissionCode,
  LoginResponse,
  PackageListQueryV1,
  PackagePageV1,
  PackageStatus,
  PackageSummaryV1,
} from '@nora/contracts';
import {
  Archive,
  ClipboardCheck,
  FileImage,
  FilePlus2,
  FileText,
  History,
  Layers3,
  ListFilter,
  RefreshCw,
  Scale,
  Search,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  PaginationShell,
  Skeleton,
} from '@/components/ui/surfaces';
import { cn } from '@/lib/utils';
import { packagePricingApi, PackagePricingApiError } from '../api/client';

const tabs = [
  ['packages', 'پکیج‌ها', Layers3],
  ['create', 'ساخت پکیج', FilePlus2],
  ['periods', 'بازه‌های قیمت', ListFilter],
  ['rules', 'قواعد قیمت', Scale],
  ['quotes', 'پیش‌فاکتورها', FileText],
  ['templates', 'قالب‌های بنر', FileImage],
  ['outputs', 'خروجی‌ها', Archive],
  ['audit', 'ردپای تغییرات', History],
] as const;
type PricingTab = (typeof tabs)[number][0];

const statusLabels: Record<PackageStatus, string> = {
  DRAFT: 'پیش‌نویس',
  READY_FOR_REVIEW: 'آماده بررسی',
  APPROVED: 'تأییدشده',
  PUBLISHED: 'منتشرشده',
  STOPPED: 'متوقف',
  EXPIRED: 'منقضی',
  ARCHIVED: 'بایگانی',
};

const tabPermissions: Record<PricingTab, IamPermissionCode> = {
  packages: 'package_pricing.read',
  create: 'package_pricing.create',
  periods: 'package_pricing.period.manage',
  rules: 'package_pricing.rule.manage',
  quotes: 'package_pricing.quote.create',
  templates: 'package_pricing.template.manage',
  outputs: 'package_pricing.render',
  audit: 'package_pricing.audit.read',
};

export async function loadPricingWorkspace(
  api: Pick<typeof packagePricingApi, 'session' | 'list'> = packagePricingApi,
  query: PackageListQueryV1 = { page: 1, pageSize: 20 },
) {
  const activeSession = await api.session();
  if (!activeSession.user.permissions.includes('package_pricing.read'))
    throw new PackagePricingApiError(
      'برای مشاهده پکیج‌ها مجوز package_pricing.read لازم است.',
      403,
      'PACKAGE_FORBIDDEN',
    );
  const packages = await api.list(query, activeSession);
  return { activeSession, packages };
}

function money(amount: string, currencyCode: string) {
  const [integer = '0', fraction] = amount.split('.');
  const formatted = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
  return `${formatted}${fraction ? `٫${fraction}` : ''} ${currencyCode}`.replace(
    /\d/g,
    (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]!,
  );
}

function errorTitle(error: unknown) {
  if (error instanceof PackagePricingApiError) {
    if (error.status === 401) return 'نشست معتبر نیست';
    if (error.status === 403) return 'دسترسی مجاز نیست';
    if (error.status === 409) return 'تعارض هم‌زمانی';
  }
  return 'اطلاعات قیمت‌گذاری در دسترس نیست';
}

function optionalQuery(
  current: PackageListQueryV1,
  key: 'branchId' | 'search',
  value: string,
): PackageListQueryV1 {
  const next = { ...current, page: 1 };
  if (value) next[key] = value;
  else delete next[key];
  return next;
}

function PackageList({ rows }: { rows: readonly PackageSummaryV1[] }) {
  if (!rows.length)
    return (
      <EmptyState
        title="پکیجی ثبت نشده است"
        description="پس از ثبت اولین پکیج، نسخه، وضعیت انتشار، ظرفیت و قیمت نهایی آن اینجا دیده می‌شود."
      />
    );
  return (
    <div className="grid gap-3" aria-label="فهرست پکیج‌ها">
      {rows.map((item) => (
        <Card
          className="grid gap-4 p-4 lg:grid-cols-[1.4fr_1fr_1fr_auto] lg:items-center"
          key={item.id}
        >
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{statusLabels[item.status]}</Badge>
              <span className="font-mono text-xs text-muted-foreground">
                {item.code}
              </span>
            </div>
            <h2 className="mt-2 font-black">{item.titleFa}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {item.destinationNameSnapshot}
            </p>
          </div>
          <div className="text-sm">
            <p className="text-xs text-muted-foreground">حرکت / بازگشت</p>
            <p className="mt-1 font-semibold" dir="ltr">
              {item.departureDate || '—'} / {item.returnDate || '—'}
            </p>
          </div>
          <div className="text-sm">
            <p className="text-xs text-muted-foreground">آخرین قیمت منتشرشده</p>
            <p className="mt-1 font-bold" dir="ltr">
              {item.latestPrice
                ? money(item.latestPrice.amount, item.latestPrice.currencyCode)
                : '—'}
            </p>
          </div>
          <div className="text-xs text-muted-foreground">
            نسخه {item.version.toLocaleString('fa-IR')} · ظرفیت{' '}
            {item.capacity.toLocaleString('fa-IR')}
          </div>
        </Card>
      ))}
    </div>
  );
}

function OperationalEmpty({ tab }: { tab: Exclude<PricingTab, 'packages'> }) {
  const content: Record<typeof tab, readonly [string, string]> = {
    create: [
      'نرخ هتل متصل است؛ نرخ و ظرفیت بلیت باقی مانده',
      'بازه‌های نسخه‌دار هتل از Master Data قابل ارجاع‌اند. ساخت پکیج ترکیبی تا ارائه نرخ پایه و ظرفیت قابل recheck بلیت با SOURCE_RATE_UNAVAILABLE متوقف می‌شود.',
    ],
    periods: [
      'بازه‌ای انتخاب نشده است',
      'یک پکیج را از برگه پکیج‌ها انتخاب کنید تا بازه‌های نسخه‌دار قیمت مدیریت شوند.',
    ],
    rules: [
      'قاعده‌ای انتخاب نشده است',
      'قواعد به ترتیب sequence محاسبه و همراه نسخه قیمت snapshot می‌شوند.',
    ],
    quotes: [
      'پیش‌فاکتوری ثبت نشده است',
      'پیش‌فاکتور فقط از نسخه منتشرشده و با کنترل حداقل قیمت ساخته می‌شود.',
    ],
    templates: [
      'قالب بنری ثبت نشده است',
      'قالب‌ها نسخه‌دارند و برند صادرکننده را در زمان درخواست خروجی snapshot می‌کنند.',
    ],
    outputs: [
      'خروجی آماده‌ای وجود ندارد',
      'Renderer هنوز متصل نیست؛ درخواست معتبر با وضعیت AWAITING_RENDERER ثبت می‌شود و موفقیت جعلی نمایش داده نمی‌شود.',
    ],
    audit: [
      'رویدادی انتخاب نشده است',
      'برای مشاهده actor، شعبه، نسخه، دلیل و نتیجه، ابتدا یک پکیج را انتخاب کنید.',
    ],
  };
  return <EmptyState title={content[tab][0]} description={content[tab][1]} />;
}

export function PricingManagementWorkspace() {
  const [activeTab, setActiveTab] = useState<PricingTab>('packages');
  const [session, setSession] = useState<LoginResponse | null>(null);
  const [result, setResult] = useState<PackagePageV1 | null>(null);
  const [query, setQuery] = useState<PackageListQueryV1>({
    page: 1,
    pageSize: 20,
  });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const request = useRef(0);
  const load = useCallback(async () => {
    const current = ++request.current;
    setLoading(true);
    setError(null);
    try {
      const loaded = await loadPricingWorkspace(packagePricingApi, query);
      if (current !== request.current) return;
      setSession(loaded.activeSession);
      setResult(loaded.packages);
    } catch (cause) {
      if (current !== request.current) return;
      setSession(null);
      setResult(null);
      setError(cause);
    } finally {
      if (current === request.current) setLoading(false);
    }
  }, [query]);
  useEffect(() => {
    const timer = globalThis.setTimeout(() => void load(), 0);
    return () => globalThis.clearTimeout(timer);
  }, [load]);

  const allowed = (tab: PricingTab) =>
    Boolean(session?.user.permissions.includes(tabPermissions[tab]));

  return (
    <main className="mx-auto grid w-full max-w-7xl gap-5">
      <PageHeader
        eyebrow="فروش و ارتباط با مشتری"
        title="مدیریت قیمت و پکیج‌ها"
        description="پکیج، قواعد، نسخه قیمت، پیش‌فاکتور و خروجی برندشده با کنترل شعبه و سازوکار maker/checker"
        actions={
          <>
            <Link
              className={buttonVariants({ variant: 'primary', size: 'sm' })}
              href="/master-data/accommodation/hotel-rates"
            >
              نرخ‌های هتل
            </Link>
            <Link
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
              href="/sales"
            >
              بازگشت به قراردادها
            </Link>
          </>
        }
      />
      <Alert
        title="مرز مالکیت نرخ مبنا"
        description="قرارداد نسخه‌دار نرخ پایه هتل از Master Data متصل است. این بخش به جدول ماژول دیگر دسترسی مستقیم ندارد و تا ارائه نرخ/ظرفیت بلیت، محاسبه پکیج ترکیبی fail-closed می‌ماند."
      />
      <div
        className="flex gap-2 overflow-x-auto rounded-2xl border border-border bg-surface p-2"
        role="tablist"
        aria-label="بخش‌های مدیریت قیمت"
      >
        {tabs.map(([key, label, Icon]) => (
          <button
            aria-selected={activeTab === key}
            className={cn(
              'flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-xs font-bold transition',
              activeTab === key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted',
            )}
            key={key}
            onClick={() => setActiveTab(key)}
            role="tab"
            type="button"
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>
      {activeTab === 'packages' ? (
        <>
          <Card className="grid gap-3 p-4 md:grid-cols-[1fr_14rem_auto] md:items-end">
            <label className="text-xs font-bold">
              جست‌وجوی کد یا عنوان
              <span className="relative mt-2 block">
                <Search className="absolute end-3 top-3 size-4 text-muted-foreground" />
                <Input
                  className="pe-10"
                  onChange={(event) => setSearch(event.target.value)}
                  value={search}
                />
              </span>
            </label>
            <label className="text-xs font-bold">
              شعبه
              <select
                className="mt-2 h-11 w-full rounded-xl border border-input bg-surface px-3 text-sm"
                disabled={!session}
                onChange={(event) =>
                  setQuery((value) =>
                    optionalQuery(value, 'branchId', event.target.value),
                  )
                }
                value={query.branchId ?? ''}
              >
                <option value="">همه شعب مجاز</option>
                {session?.user.branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2">
              <Button
                onClick={() =>
                  setQuery((value) =>
                    optionalQuery(value, 'search', search.trim()),
                  )
                }
              >
                اعمال فیلتر
              </Button>
              <Button
                aria-label="به‌روزرسانی"
                disabled={loading}
                onClick={() => void load()}
                size="icon"
                variant="outline"
              >
                <RefreshCw className="size-4" />
              </Button>
            </div>
          </Card>
          {loading ? (
            <div className="grid gap-3">
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton className="h-28" key={index} />
              ))}
            </div>
          ) : null}
          {!loading && error ? (
            <ErrorState
              title={errorTitle(error)}
              description={
                error instanceof Error
                  ? error.message
                  : 'خطای پیش‌بینی‌نشده رخ داد.'
              }
              action={
                <Button onClick={() => void load()} variant="outline">
                  تلاش دوباره
                </Button>
              }
            />
          ) : null}
          {!loading && !error && result ? (
            <>
              <PackageList rows={result.data} />
              <PaginationShell
                currentPage={result.meta.page}
                totalLabel={`${result.meta.total.toLocaleString('fa-IR')} پکیج`}
              />
            </>
          ) : null}
        </>
      ) : allowed(activeTab) ? (
        <OperationalEmpty tab={activeTab} />
      ) : (
        <EmptyState
          title="دسترسی مجاز نیست"
          description={`برای این برگه مجوز ${tabPermissions[activeTab]} لازم است.`}
          icon={ClipboardCheck}
        />
      )}
    </main>
  );
}
