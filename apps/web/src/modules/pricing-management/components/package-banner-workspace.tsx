'use client';

import type {
  PackageTourCostGridV1,
  PackageTourHotelPurchaseBatchV1,
  PackageTourPublicationV1,
  TourDepartureV1,
} from '@nora/contracts';
import {
  ArrowRight,
  CalendarDays,
  Eye,
  FileImage,
  Hotel,
  LayoutTemplate,
  LockKeyhole,
  Plane,
  Type,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
} from '@/components/ui/surfaces';
import { cn } from '@/lib/utils';
import {
  packagePricingApi,
  PackagePricingApiError,
  type PackageBannerTemplateV1,
} from '../api/client';
import {
  buildPackageBannerViewModel,
  canViewPackageBanner,
  packageBannerFailureMessages,
  type PackageBannerViewModel,
} from '../model/package-banner';
import { packageBannerDocumentsAdapter } from '../model/package-banner-output';
import { PackagePricingBreadcrumbs } from './package-pricing-breadcrumbs';

type BannerApi = Pick<
  typeof packagePricingApi,
  'session' | 'tours' | 'tourCosts' | 'tourPublications' | 'bannerTemplates'
>;

export interface PackageBannerLoadResult {
  tour: TourDepartureV1;
  grid: PackageTourCostGridV1;
  batch: PackageTourHotelPurchaseBatchV1 | null;
  publication: PackageTourPublicationV1 | null;
  templates: readonly PackageBannerTemplateV1[];
}

export async function loadPackageBanner(
  packageId: string,
  selection: {
    batchId?: string | undefined;
    publicationId?: string | undefined;
  },
  api: BannerApi = packagePricingApi,
): Promise<PackageBannerLoadResult> {
  const session = await api.session();
  if (!canViewPackageBanner(session))
    throw new PackagePricingApiError(
      'برای مشاهده و ساخت بنر، هر دو مجوز package_pricing.read و package_pricing.render لازم است.',
      403,
      'PACKAGE_FORBIDDEN',
    );
  const tours = await api.tours(session);
  const tour = tours.data.find((item) => item.id === packageId);
  if (!tour)
    throw new PackagePricingApiError(
      'پکیج انتخاب‌شده پیدا نشد یا در شعب مجاز شما قرار ندارد.',
      404,
      'PACKAGE_NOT_FOUND',
    );
  const grid = await api.tourCosts(tour.id, session);
  const batch =
    grid.purchaseBatches.find((item) => item.id === selection.batchId) ??
    grid.purchaseBatches[0] ??
    null;
  const [publications, templates] = await Promise.all([
    batch ? api.tourPublications(tour.id, batch.id, session) : [],
    api.bannerTemplates(tour.branchId, session),
  ]);
  const publication =
    publications.find((item) => item.id === selection.publicationId) ??
    publications[0] ??
    null;
  return { tour, grid, batch, publication, templates: templates.data };
}

export function safePricingReturnTo(value?: string) {
  if (!value) return '/sales/pricing/management';
  try {
    const url = new URL(value, 'https://rubi.local');
    return url.origin === 'https://rubi.local' &&
      ['/sales/pricing/management', '/sales/pricing/generator'].includes(
        url.pathname,
      )
      ? `${url.pathname}${url.search}`
      : '/sales/pricing/management';
  } catch {
    return '/sales/pricing/management';
  }
}

function faDate(value: string) {
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  return Number.isNaN(parsed.valueOf())
    ? value
    : new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
      }).format(parsed);
}

function money(amount: string, currencyCode: string) {
  const number = Number(amount);
  const value = Number.isFinite(number)
    ? new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 }).format(
        number,
      )
    : amount;
  return `${value} ${currencyCode}`;
}

function templateTheme(template: PackageBannerTemplateV1) {
  if (template.format === 'STORY')
    return 'from-violet-950 via-fuchsia-900 to-rose-700';
  if (template.format === 'HORIZONTAL' || template.format === 'WEBSITE')
    return 'from-slate-950 via-sky-900 to-cyan-600';
  if (template.format === 'A4')
    return 'from-stone-950 via-amber-900 to-orange-600';
  return 'from-indigo-950 via-blue-900 to-sky-600';
}

function BannerPreview({
  model,
  template,
  title,
  summary,
  cta,
  showPrice,
  showDate,
  showHotel,
}: {
  model: PackageBannerViewModel;
  template: PackageBannerTemplateV1;
  title: string;
  summary: string;
  cta: string;
  showPrice: boolean;
  showDate: boolean;
  showHotel: boolean;
}) {
  const hotels = Array.from(new Set(model.rooms.map((room) => room.hotelName)));
  return (
    <article
      aria-label="پیش‌نمایش واقعی بنر پکیج"
      className={cn(
        'relative isolate mx-auto flex w-full max-w-3xl overflow-hidden rounded-[2rem] bg-gradient-to-br p-6 text-white shadow-2xl sm:p-10',
        templateTheme(template),
      )}
      dir="rtl"
      style={{ aspectRatio: `${template.width} / ${template.height}` }}
    >
      <div className="absolute -start-20 -top-20 -z-10 size-72 rounded-full bg-white/15 blur-3xl" />
      <div className="absolute -bottom-28 -end-20 -z-10 size-80 rounded-full bg-cyan-300/20 blur-3xl" />
      <div className="flex w-full flex-col justify-between gap-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-white/70">{model.route}</p>
            <h2 className="mt-3 text-3xl font-black leading-tight sm:text-5xl">
              {title || model.packageName}
            </h2>
            {summary ? (
              <p className="mt-3 max-w-xl text-sm leading-7 text-white/80 sm:text-base">
                {summary}
              </p>
            ) : null}
          </div>
          <Badge className="border-white/25 bg-white/15 text-white">
            {model.publicationStatus} · نسخه{' '}
            {model.priceVersion.toLocaleString('fa-IR')}
          </Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/20 bg-black/15 p-4 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-xs text-white/70">
              <Plane className="size-4" /> پرواز انتخابی
            </div>
            <p className="mt-2 font-black">{model.flight}</p>
            {model.returnFlight ? (
              <p className="mt-1 text-xs text-white/75">
                برگشت: {model.returnFlight}
              </p>
            ) : null}
          </div>
          {showDate ? (
            <div className="rounded-2xl border border-white/20 bg-black/15 p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-xs text-white/70">
                <CalendarDays className="size-4" /> تاریخ سفر
              </div>
              <p className="mt-2 font-black">
                {faDate(model.startsOn)} تا {faDate(model.endsOn)}
              </p>
            </div>
          ) : null}
        </div>
        {showHotel ? (
          <div className="flex flex-wrap gap-2">
            {hotels.map((hotel) => (
              <span
                className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold"
                key={hotel}
              >
                <Hotel className="ms-1 inline size-3.5" /> {hotel}
              </span>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap items-end justify-between gap-4">
          {showPrice ? (
            <div>
              <p className="text-xs text-white/65">قیمت نهایی قابل عرضه از</p>
              <div className="mt-1 flex flex-wrap gap-x-3 text-2xl font-black sm:text-4xl">
                {model.displayPrices.map((price) => (
                  <span key={price.currencyCode}>
                    {money(price.amount, price.currencyCode)}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <span />
          )}
          <span className="rounded-xl bg-white px-5 py-3 text-sm font-black text-slate-950">
            {cta}
          </span>
        </div>
      </div>
    </article>
  );
}

export function PackageBannerWorkspace({
  packageId,
  batchId,
  publicationId,
  returnTo,
  embedded = false,
}: {
  packageId: string;
  batchId?: string | undefined;
  publicationId?: string | undefined;
  returnTo?: string | undefined;
  embedded?: boolean | undefined;
}) {
  const [result, setResult] = useState<PackageBannerLoadResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [templateId, setTemplateId] = useState('');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [cta, setCta] = useState('رزرو تور');
  const [showPrice, setShowPrice] = useState(true);
  const [showDate, setShowDate] = useState(true);
  const [showHotel, setShowHotel] = useState(true);
  const output = packageBannerDocumentsAdapter.availability();
  const backHref = safePricingReturnTo(returnTo);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await loadPackageBanner(
        packageId,
        { batchId, publicationId },
        packagePricingApi,
      );
      setResult(loaded);
      setTemplateId(loaded.templates[0]?.id ?? '');
      setTitle(loaded.tour.package.name);
    } catch (cause) {
      setResult(null);
      setError(cause);
    } finally {
      setLoading(false);
    }
  }, [batchId, packageId, publicationId]);
  useEffect(() => {
    const timer = globalThis.setTimeout(() => void load(), 0);
    return () => globalThis.clearTimeout(timer);
  }, [load]);

  const template = result?.templates.find((item) => item.id === templateId);
  const validation = useMemo(
    () =>
      result?.batch && result.publication
        ? buildPackageBannerViewModel({
            tour: result.tour,
            batch: result.batch,
            publication: result.publication,
          })
        : null,
    [result],
  );

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-5">
      {!embedded ? (
        <PackagePricingBreadcrumbs
          currentTitle="ساخت بنر پکیج"
          pathname={`/sales/pricing/packages/${encodeURIComponent(packageId)}/banner`}
        />
      ) : null}
      {!embedded ? (
        <PageHeader
          eyebrow="مدیریت قیمت و پکیج‌ها"
          title="ساخت بنر پکیج"
          description="پیش‌نمایش بنر از نسخه منتشرشده قیمت و آیتم‌های قابل‌فروش همین پکیج ساخته می‌شود."
          actions={
            <Link
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
              href={backHref}
            >
              <ArrowRight className="size-4" /> بازگشت به همان پکیج
            </Link>
          }
        />
      ) : null}
      {loading ? (
        <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
          <Skeleton className="h-[32rem]" />
          <Skeleton className="h-[32rem]" />
        </div>
      ) : null}
      {!loading && error ? (
        <ErrorState
          title={
            error instanceof PackagePricingApiError && error.status === 403
              ? 'دسترسی ساخت بنر مجاز نیست'
              : 'اطلاعات بنر در دسترس نیست'
          }
          description={
            error instanceof Error
              ? error.message
              : 'خطای پیش‌بینی‌نشده رخ داد.'
          }
          action={<Button onClick={() => void load()}>تلاش دوباره</Button>}
        />
      ) : null}
      {!loading && !error && result && !result.batch ? (
        <EmptyState
          title="پکیج آیتم قابل‌عرضه ندارد"
          description="برای مقصد و بازه این نوبت، نرخ هتل و نوع اتاق قابل‌فروش ثبت نشده است."
          icon={Hotel}
        />
      ) : null}
      {!loading && !error && result?.batch && !result.publication ? (
        <EmptyState
          title="قیمت معتبر برای ساخت بنر وجود ندارد"
          description="ابتدا نسخه قیمت همین پکیج و بازه را منتشر کنید؛ پیش‌نویس یا نرخ خرید در بنر قابل نمایش نیست."
          icon={FileImage}
        />
      ) : null}
      {!loading && !error && validation && validation.failures.length ? (
        <Card className="grid gap-3 border-destructive/30 p-5">
          <h2 className="font-black text-destructive">ساخت بنر متوقف شد</h2>
          <p className="text-sm text-muted-foreground">
            اطلاعات قابل‌عرضه کامل نیست. موارد زیر را در پکیج اصلاح کنید:
          </p>
          <ul className="grid gap-2 text-sm">
            {validation.failures.map((failure) => (
              <li className="rounded-xl bg-destructive/5 p-3" key={failure}>
                {packageBannerFailureMessages[failure]}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {!loading &&
      !error &&
      validation?.value &&
      result &&
      result.templates.length === 0 ? (
        <EmptyState
          title="قالب بنر فعالی وجود ندارد"
          description="برای شعبه این پکیج، ابتدا یک قالب فعال بنر ثبت کنید. بدون قالب، پیش‌نمایش یا خروجی ساخته نمی‌شود."
          icon={FileImage}
        />
      ) : null}
      {!loading && !error && validation?.value && result && template ? (
        <>
          <Alert
            title="پیش‌نمایش آماده است"
            description="فقط قیمت فروش منتشرشده نمایش داده می‌شود؛ نرخ خرید، کمیسیون و سود داخلی وارد بنر نشده‌اند."
          />
          <div className="grid items-start gap-5 lg:grid-cols-[21rem_minmax(0,1fr)]">
            <Card className="overflow-hidden p-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
              <div className="border-b border-border bg-muted/35 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-black">ویرایشگر پک</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      تغییرات هم‌زمان در پیش‌نمایش اعمال می‌شوند.
                    </p>
                  </div>
                  <Badge className="gap-1.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    آماده
                  </Badge>
                </div>
                <nav
                  aria-label="دسترسی سریع به تنظیمات پک جنریتور"
                  className="mt-4 grid grid-cols-4 gap-1 rounded-xl bg-background/80 p-1"
                >
                  {[
                    ['#generator-template', 'قالب'],
                    ['#generator-copy', 'متن'],
                    ['#generator-display', 'نمایش'],
                    ['#generator-output', 'خروجی'],
                  ].map(([href, label]) => (
                    <a
                      className="rounded-lg px-2 py-2 text-center text-[11px] font-bold text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      href={href}
                      key={href}
                    >
                      {label}
                    </a>
                  ))}
                </nav>
              </div>

              <div className="grid gap-3 p-4">
                <details
                  className="group rounded-2xl border border-border bg-background"
                  id="generator-template"
                  open
                >
                  <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
                    <span className="grid size-9 place-items-center rounded-xl bg-violet-500/10 font-black text-violet-700 dark:text-violet-300">
                      ۰۱
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block text-sm">دسته و قالب</strong>
                      <small className="text-xs text-muted-foreground">
                        انتخاب نوع و ابعاد طرح
                      </small>
                    </span>
                    <LayoutTemplate className="size-4 text-muted-foreground" />
                  </summary>
                  <div className="grid gap-3 border-t border-border p-4">
                    <label className="grid gap-2 text-sm font-bold">
                      قالب فعال شعبه
                      <select
                        className="h-11 rounded-xl border border-input bg-surface px-3"
                        onChange={(event) => setTemplateId(event.target.value)}
                        value={templateId}
                      >
                        {result.templates.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.title} · {item.width}×{item.height}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div
                      aria-label="گالری قالب‌های بنر"
                      className="grid grid-cols-2 gap-2"
                      role="group"
                    >
                      {result.templates.map((item) => (
                        <button
                          aria-pressed={item.id === templateId}
                          className={cn(
                            'grid min-h-20 place-items-center rounded-xl border p-2 text-center transition',
                            item.id === templateId
                              ? 'border-primary bg-primary/5 text-primary'
                              : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/40',
                          )}
                          key={item.id}
                          onClick={() => setTemplateId(item.id)}
                          type="button"
                        >
                          <span className="text-xs font-black">
                            {item.title}
                          </span>
                          <span className="text-[10px]">
                            {item.width}×{item.height}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </details>

                <details
                  className="group rounded-2xl border border-border bg-background"
                  id="generator-copy"
                  open
                >
                  <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
                    <span className="grid size-9 place-items-center rounded-xl bg-sky-500/10 font-black text-sky-700 dark:text-sky-300">
                      ۰۲
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block text-sm">متن و توضیحات</strong>
                      <small className="text-xs text-muted-foreground">
                        عنوان، پیام کوتاه و دعوت
                      </small>
                    </span>
                    <Type className="size-4 text-muted-foreground" />
                  </summary>
                  <div className="grid gap-4 border-t border-border p-4">
                    <label className="grid gap-2 text-sm font-bold">
                      عنوان تبلیغاتی
                      <Input
                        maxLength={90}
                        onChange={(event) => setTitle(event.target.value)}
                        value={title}
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-bold">
                      متن کوتاه
                      <textarea
                        className="min-h-24 rounded-xl border border-input bg-surface p-3 text-sm"
                        maxLength={180}
                        onChange={(event) => setSummary(event.target.value)}
                        placeholder="یک پیام کوتاه برای معرفی این سفر"
                        value={summary}
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-bold">
                      دعوت به اقدام
                      <select
                        className="h-11 rounded-xl border border-input bg-surface px-3"
                        onChange={(event) => setCta(event.target.value)}
                        value={cta}
                      >
                        <option>رزرو تور</option>
                        <option>تماس با ما</option>
                        <option>مشاهده جزئیات</option>
                      </select>
                    </label>
                  </div>
                </details>

                <details
                  className="group rounded-2xl border border-border bg-background"
                  id="generator-display"
                  open
                >
                  <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
                    <span className="grid size-9 place-items-center rounded-xl bg-amber-500/10 font-black text-amber-700 dark:text-amber-300">
                      ۰۳
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block text-sm">تنظیمات نمایش</strong>
                      <small className="text-xs text-muted-foreground">
                        کنترل اجزای قابل‌نمایش
                      </small>
                    </span>
                    <Eye className="size-4 text-muted-foreground" />
                  </summary>
                  <div className="grid gap-3 border-t border-border p-4">
                    {[
                      ['نمایش قیمت', showPrice, setShowPrice],
                      ['نمایش تاریخ', showDate, setShowDate],
                      ['نمایش نام هتل', showHotel, setShowHotel],
                    ].map(([label, checked, setter]) => (
                      <label
                        className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 text-sm font-bold"
                        key={String(label)}
                      >
                        {String(label)}
                        <input
                          checked={Boolean(checked)}
                          className="size-4 accent-primary"
                          onChange={(event) =>
                            (setter as (value: boolean) => void)(
                              event.target.checked,
                            )
                          }
                          type="checkbox"
                        />
                      </label>
                    ))}
                  </div>
                </details>

                <details
                  className="group rounded-2xl border border-border bg-background"
                  id="generator-output"
                  open
                >
                  <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
                    <span className="grid size-9 place-items-center rounded-xl bg-rose-500/10 font-black text-rose-700 dark:text-rose-300">
                      ۰۴
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block text-sm">خروجی طرح</strong>
                      <small className="text-xs text-muted-foreground">
                        اتصال کنترل‌شده به Documents
                      </small>
                    </span>
                    <LockKeyhole className="size-4 text-muted-foreground" />
                  </summary>
                  <div className="border-t border-border p-4">
                    <Button className="w-full" disabled type="button">
                      {output.label}
                    </Button>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {output.reason}
                    </p>
                  </div>
                </details>
              </div>
            </Card>
            <div className="grid min-w-0 gap-4">
              <Card className="overflow-hidden p-0">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/35 px-5 py-3">
                  <div>
                    <h2 className="text-sm font-black">پیش‌نمایش زنده</h2>
                    <p className="text-xs text-muted-foreground">
                      {template.title} · {template.width}×{template.height}
                    </p>
                  </div>
                  <Badge>RTL · HTML/CSS</Badge>
                </div>
                <div className="bg-muted/25 p-4 sm:p-6">
                  <BannerPreview
                    cta={cta}
                    model={validation.value}
                    showDate={showDate}
                    showHotel={showHotel}
                    showPrice={showPrice}
                    summary={summary}
                    template={template}
                    title={title}
                  />
                </div>
              </Card>
              <Card className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">مقصد</p>
                  <strong>{validation.value.destination}</strong>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">بازه سفر</p>
                  <strong>
                    {faDate(validation.value.startsOn)} تا{' '}
                    {faDate(validation.value.endsOn)}
                  </strong>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">پرواز</p>
                  <strong>{validation.value.flight}</strong>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">وضعیت</p>
                  <strong>{validation.value.publicationStatus}</strong>
                </div>
                <div className="sm:col-span-2 lg:col-span-4">
                  <p className="text-xs text-muted-foreground">
                    هتل و نوع اتاق قابل‌عرضه
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {validation.value.rooms.map((room) => (
                      <Badge key={`${room.hotelName}-${room.roomName}`}>
                        {room.hotelName} · {room.roomName} ·{' '}
                        {room.prices
                          .map((price) =>
                            money(price.amount, price.currencyCode),
                          )
                          .join(' + ')}
                      </Badge>
                    ))}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
