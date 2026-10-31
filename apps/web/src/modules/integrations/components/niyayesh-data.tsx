'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  Skeleton,
} from '@/components/ui/surfaces';
import { Button } from '@/components/ui/button';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import { integrationsApi } from '../api/client';
import { NiyayeshEditor } from './niyayesh-editor';
import { NiyayeshWorkbooks } from './niyayesh-workbooks';

const labels: Record<string, string> = {
  valid: 'اعتبار فایل',
  applied: 'ثبت انجام‌شده',
  file_name: 'نام فایل',
  warnings: 'هشدارها',
  errors: 'خطاها',
  created: 'جدید',
  updated: 'به‌روزشده',
  unchanged: 'بدون تغییر',
  deleted: 'حذف‌شده',
  skipped_expired: 'منقضی و ردشده',
  tours: 'تورها',
  tour_prices: 'قیمت‌های تور',
  hotel_rates: 'نرخ هتل',
  tickets: 'بلیت‌ها',
  destinations: 'مقصدها',
  id: 'شناسه',
  name: 'نام',
  title: 'عنوان',
  slug: 'نام در نشانی',
  status: 'وضعیت',
  description: 'توضیحات',
  price: 'مبلغ',
  currency: 'ارز',
  amount: 'مبلغ',
  created_at: 'زمان ایجاد',
  updated_at: 'آخرین تغییر',
  is_active: 'فعال',
  first_name: 'نام',
  last_name: 'نام خانوادگی',
  phone: 'تلفن',
  email: 'ایمیل',
  items: 'اقلام',
  departures: 'حرکت‌ها',
  itinerary: 'برنامه سفر',
  hotels: 'هتل‌ها',
  country: 'کشور',
  city: 'شهر',
  date: 'تاریخ',
  nights: 'شب‌ها',
  capacity: 'ظرفیت',
  payment_status: 'وضعیت پرداخت',
  total_amount: 'مبلغ کل',
  total_price: 'قیمت کل',
};
export function ExternalFields({
  value,
  depth = 0,
}: {
  value: unknown;
  depth?: number;
}) {
  if (value === null || value === undefined)
    return <span className="text-muted-foreground">ثبت نشده</span>;
  if (typeof value === 'boolean') return <span>{value ? 'بله' : 'خیر'}</span>;
  if (typeof value !== 'object')
    return (
      <span className="break-words whitespace-pre-wrap">{String(value)}</span>
    );
  if (depth > 12) return <span>جزئیات تو در تو بیش از حد مجاز است.</span>;
  if (Array.isArray(value))
    return value.length ? (
      <div className="grid gap-2">
        {value.map((v, i) => (
          <div key={i} className="rounded border border-border p-2">
            <ExternalFields value={v} depth={depth + 1} />
          </div>
        ))}
      </div>
    ) : (
      <span>موردی ثبت نشده</span>
    );
  return (
    <dl className="grid gap-2">
      {Object.entries(value).map(([key, v]) => (
        <div
          key={key}
          className="grid gap-1 border-b border-border py-2 sm:grid-cols-[12rem_1fr]"
        >
          <dt className="text-sm text-muted-foreground">
            {labels[key] ?? key.replaceAll('_', ' ')}
          </dt>
          <dd className="min-w-0 text-sm">
            <ExternalFields value={v} depth={depth + 1} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function NiyayeshData({
  branchId,
  expectedSystemId,
}: {
  branchId: string;
  expectedSystemId?: string;
}) {
  const [dashboard, setDashboard] = useState<Awaited<
    ReturnType<typeof integrationsApi.niyayeshDashboard>
  > | null>(null);
  const [metric, setMetric] = useState('');
  const [view, setView] = useState('data');
  const [status, setStatus] = useState<Awaited<
    ReturnType<typeof integrationsApi.niyayeshStatus>
  > | null>(null);
  const [page, setPage] = useState<Awaited<
    ReturnType<typeof integrationsApi.niyayeshResources>
  > | null>(null);
  const [resource, setResource] = useState('');
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [after, setAfter] = useState(0);
  const [history, setHistory] = useState<number[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setBusy(true);
      setError('');
      setPage(null);
      try {
        const access = await integrationsApi.ssoAccess(
          branchId,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setSsoEnabled(access.enabled);
        const state = await integrationsApi.niyayeshStatus(
          branchId,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setStatus(state);
        if (expectedSystemId && state.registrySystemId !== expectedSystemId)
          return;
        if (state.state === 'CONNECTED') {
          const totals = await integrationsApi.niyayeshDashboard(
            branchId,
            controller.signal,
          );
          if (controller.signal.aborted) return;
          setDashboard(totals);
        }
        if (resource && state.resources.some((r) => r.code === resource)) {
          const data = await integrationsApi.niyayeshResources(
            branchId,
            resource,
            after,
            controller.signal,
            metric || undefined,
          );
          if (!controller.signal.aborted) setPage(data);
        }
      } catch (e) {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : 'ارتباط برقرار نشد.');
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    })();
    return () => controller.abort();
  }, [branchId, resource, after, revision, metric, expectedSystemId]);
  if (
    expectedSystemId &&
    status &&
    status.registrySystemId !== expectedSystemId
  )
    return (
      <EmptyState
        title="این سایت هنوز متصل نشده است"
        description="آمار و ورود اطلاعات پس از تنظیم و آزمون اتصال واقعی همین سایت فعال می‌شود؛ داده‌ای از سایت دیگر نمایش داده نمی‌شود."
      />
    );
  return (
    <Card className="p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">داده‌های نیایش سیر</h2>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => setRevision((v) => v + 1)}
        >
          بررسی و دریافت تازه
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        اطلاعات مستقیم از API نیایش با مجوز شخصی شما دریافت می‌شود. این نما
        داده‌ای را در مشتریان، فروش یا مالی نورا ثبت نمی‌کند.
      </p>
      {ssoEnabled ? (
        <Button
          disabled={busy}
          onClick={() => {
            setError('');
            void integrationsApi
              .launchSso(branchId)
              .catch((e) =>
                setError(e instanceof Error ? e.message : 'ورود انجام نشد.'),
              );
          }}
        >
          ورود با حساب نورا به پنل نیایش
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">
          ورود شخصی نیازمند مجوز «ورود شخصی به پنل نیایش» در مدیریت کاربران است.
        </p>
      )}
      {error ? (
        <Alert tone="error" title="دریافت داده کامل نشد" description={error} />
      ) : null}
      {busy ? <Skeleton className="h-24" /> : null}
      {status?.state === 'NOT_CONFIGURED' ? (
        <EmptyState
          title="اتصال نیایش تنظیم نشده است"
          description="تنظیم امن سرور و نگاشت حساب شخصی لازم است."
        />
      ) : null}
      {status?.state === 'CONNECTED' ? (
        <>
          <div className="flex flex-wrap gap-3">
            <Badge>اتصال API تأیید شد</Badge>
            <Badge>
              {status.environment === 'LOCAL'
                ? 'محیط محلی — اطلاعات سایت عملیاتی نیست'
                : status.environment}
            </Badge>
            <span className="text-xs">
              بررسی: {new Date(status.checkedAt!).toLocaleString('fa-IR')}
            </span>
          </div>
          {dashboard ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {dashboard.metrics.map((m) => (
                  <button
                    key={m.key}
                    className="rounded-xl border border-border bg-surface p-4 text-start disabled:opacity-60"
                    disabled={busy || m.value === null}
                    onClick={() => {
                      setView('data');
                      setResource(m.resource);
                      setMetric(m.key);
                      setAfter(0);
                      setHistory([]);
                    }}
                  >
                    <span className="block text-sm font-semibold">
                      {m.title}
                    </span>
                    <strong className="my-2 block text-2xl">
                      {m.value === null
                        ? 'بدون مجوز'
                        : m.value.toLocaleString('fa-IR')}
                    </strong>
                    <span className="text-xs text-muted-foreground">
                      {m.definition}
                    </span>
                  </button>
                ))}
              </div>
              <nav
                className="flex flex-wrap gap-2"
                aria-label="اطلاعات و عملیات سایت"
              >
                <Button
                  variant={view === 'data' ? 'primary' : 'outline'}
                  onClick={() => setView('data')}
                >
                  اطلاعات و جزئیات
                </Button>
                <Button
                  variant={view === 'imports' ? 'primary' : 'outline'}
                  onClick={() => setView('imports')}
                >
                  ورود هتل، قیمت تور و بلیت
                </Button>
                <Button
                  variant={view === 'editor' ? 'primary' : 'outline'}
                  onClick={() => setView('editor')}
                >
                  تعریف و ویرایش تور و هتل
                </Button>
              </nav>
              {view === 'editor' ? (
                <NiyayeshEditor
                  branchId={branchId}
                  onSaved={() => setRevision((v) => v + 1)}
                />
              ) : null}
              {view === 'imports' ? (
                dashboard.imports.length ? (
                  <NiyayeshWorkbooks
                    branchId={branchId}
                    available={dashboard.imports}
                    onApplied={() => setRevision((v) => v + 1)}
                  />
                ) : (
                  <EmptyState
                    title="مجوز ورود فایل فعال نیست"
                    description="تیک ورود فایل مربوطه در مدیریت کاربران نورا و مجوز متناظر حساب شخصی در نیایش باید فعال باشند."
                  />
                )
              ) : null}
            </>
          ) : null}
          {view === 'data' ? (
            <>
              <label className="block text-sm">
                بخش اطلاعات
                <NativeSearchSelect
                  value={resource}
                  onChange={(e) => {
                    setResource(e.target.value);
                    setMetric('');
                    setAfter(0);
                    setHistory([]);
                    setPage(null);
                  }}
                >
                  <option value="">انتخاب بخش</option>
                  {status.resources.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.title}
                    </option>
                  ))}
                </NativeSearchSelect>
              </label>
              {metric ? (
                <p className="text-sm text-muted-foreground">
                  فیلتر:{' '}
                  {dashboard?.metrics.find((m) => m.key === metric)?.title}{' '}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setMetric('');
                      setAfter(0);
                      setHistory([]);
                    }}
                  >
                    نمایش همه
                  </Button>
                </p>
              ) : null}
              {!status.resources.length ? (
                <EmptyState
                  title="منبع مجازی برای این حساب وجود ندارد"
                  description="مجوز منبع در نورا و پنل نیایش باید فعال باشد."
                />
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
      {page && view === 'data' && !busy && !error ? (
        <>
          <p className="text-sm">
            {page.items.length.toLocaleString('fa-IR')} رکورد در این صفحه؛ مبالغ
            و ارزها مطابق منبع نمایش داده می‌شوند.
          </p>
          {!page.items.length ? (
            <EmptyState
              title="در این بخش داده‌ای ثبت نشده است"
              description="پاسخ منبع موفق بود؛ دادهٔ نمونه اضافه نشده است."
            />
          ) : null}
          {page.items.map((row) => (
            <details
              key={row.externalId}
              className="rounded-xl border border-border p-3"
            >
              <summary className="cursor-pointer font-semibold">
                {String(
                  row.data?.name ??
                    row.data?.title ??
                    row.data?.full_name ??
                    `رکورد ${row.externalId}`,
                )}{' '}
                <span className="text-xs text-muted-foreground">
                  شناسهٔ نیایش: {row.externalId} · نسخه: {row.version}
                  {row.archived ? ' · آرشیوشده' : ''}
                </span>
              </summary>
              <ExternalFields value={row.data} />
            </details>
          ))}
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={busy || !history.length}
              onClick={() => {
                setAfter(history[history.length - 1]!);
                setHistory(history.slice(0, -1));
              }}
            >
              صفحه قبل
            </Button>
            <Button
              disabled={busy || !page.hasMore}
              onClick={() => {
                setHistory([...history, after]);
                setAfter(page.nextId);
              }}
            >
              صفحه بعد
            </Button>
          </div>
        </>
      ) : null}
    </Card>
  );
}
