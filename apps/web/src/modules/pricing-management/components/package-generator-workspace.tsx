'use client';

import type { LoginResponse, TourDepartureV1 } from '@nora/contracts';
import { ArrowRight, PanelsTopLeft } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { buttonVariants } from '@/components/ui/button';
import {
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
} from '@/components/ui/surfaces';
import { packagePricingApi, PackagePricingApiError } from '../api/client';
import { canViewPackageBanner } from '../model/package-banner';
import { PackageBannerWorkspace } from './package-banner-workspace';
import { PackagePricingBreadcrumbs } from './package-pricing-breadcrumbs';

type GeneratorApi = Pick<typeof packagePricingApi, 'session' | 'tours'>;

export async function loadPackageGeneratorTours(
  api: GeneratorApi = packagePricingApi,
) {
  const session = await api.session();
  if (!canViewPackageBanner(session))
    throw new PackagePricingApiError(
      'برای ورود به پک جنریتور، هر دو مجوز مشاهده قیمت و ساخت بنر لازم است.',
      403,
      'PACKAGE_GENERATOR_FORBIDDEN',
    );
  const result = await api.tours(session);
  return { session, tours: result.data };
}

function currentSelection() {
  if (typeof globalThis.location === 'undefined')
    return { packageId: '', departureId: '' };
  const query = new URL(globalThis.location.href).searchParams;
  return {
    packageId: query.get('package') ?? '',
    departureId: query.get('departure') ?? '',
  };
}

function replaceSelection(packageId: string, departureId: string) {
  if (
    typeof globalThis.location === 'undefined' ||
    typeof globalThis.history === 'undefined'
  )
    return;
  const url = new URL(globalThis.location.href);
  if (packageId) url.searchParams.set('package', packageId);
  else url.searchParams.delete('package');
  if (departureId) url.searchParams.set('departure', departureId);
  else url.searchParams.delete('departure');
  globalThis.history.replaceState(null, '', `${url.pathname}${url.search}`);
}

export function PackageGeneratorWorkspace() {
  const [session, setSession] = useState<LoginResponse | null>(null);
  const [tours, setTours] = useState<readonly TourDepartureV1[]>([]);
  const [packageId, setPackageId] = useState('');
  const [departureId, setDepartureId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await loadPackageGeneratorTours();
      const requested = currentSelection();
      const selectedDeparture = loaded.tours.find(
        (item) => item.id === requested.departureId,
      );
      const requestedPackageExists = loaded.tours.some(
        (item) => item.package.id === requested.packageId,
      );
      setSession(loaded.session);
      setTours(loaded.tours);
      setPackageId(
        selectedDeparture?.package.id ??
          (requestedPackageExists ? requested.packageId : ''),
      );
      setDepartureId(selectedDeparture?.id ?? '');
    } catch (cause) {
      setSession(null);
      setTours([]);
      setError(cause);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = globalThis.setTimeout(() => void load(), 0);
    return () => globalThis.clearTimeout(timer);
  }, [load]);

  const packages = useMemo(
    () =>
      Array.from(
        new Map(tours.map((item) => [item.package.id, item.package])).values(),
      ),
    [tours],
  );
  const departures = tours.filter((item) => item.package.id === packageId);
  const returnTo = `/sales/pricing/generator?${new URLSearchParams({
    package: packageId,
    departure: departureId,
  }).toString()}`;

  function selectPackage(value: string) {
    setPackageId(value);
    setDepartureId('');
    replaceSelection(value, '');
  }

  function selectDeparture(value: string) {
    setDepartureId(value);
    replaceSelection(packageId, value);
  }

  return (
    <main className="mx-auto grid w-full max-w-7xl gap-5">
      <PackagePricingBreadcrumbs
        currentTitle="پک جنریتور"
        pathname="/sales/pricing/generator"
      />
      <PageHeader
        actions={
          <Link
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
            href="/sales/pricing"
          >
            <ArrowRight className="size-4" /> بازگشت به بخش‌ها
          </Link>
        }
        description="پنل طراحی پکیج با داده منتشرشده Rubi؛ ساختار کنترل و پیش‌نمایش از ابزار مرجع Package Generator اقتباس شده است."
        eyebrow="مدیریت قیمت و پکیج‌ها"
        title="پک جنریتور"
      />

      {loading ? (
        <div className="grid gap-4">
          <Skeleton className="h-36" />
          <div className="grid gap-4 lg:grid-cols-[21rem_minmax(0,1fr)]">
            <Skeleton className="h-[34rem]" />
            <Skeleton className="h-[34rem]" />
          </div>
        </div>
      ) : null}

      {!loading && error ? (
        <ErrorState
          action={
            <button
              className={buttonVariants({ variant: 'primary' })}
              onClick={() => void load()}
              type="button"
            >
              تلاش دوباره
            </button>
          }
          description={
            error instanceof Error
              ? error.message
              : 'خطای پیش‌بینی‌نشده در دریافت پکیج‌ها رخ داد.'
          }
          title={
            error instanceof PackagePricingApiError && error.status === 403
              ? 'دسترسی به پک جنریتور مجاز نیست'
              : 'پک جنریتور در دسترس نیست'
          }
        />
      ) : null}

      {!loading && !error && tours.length === 0 ? (
        <EmptyState
          description="پس از تعریف نوبت تور و انتشار قیمت، پکیج قابل انتخاب در این بخش ظاهر می‌شود."
          icon={PanelsTopLeft}
          title="پکیج قابل‌نمایشی وجود ندارد"
        />
      ) : null}

      {!loading && !error && tours.length > 0 ? (
        <>
          <Card className="grid gap-4 p-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <h2 className="font-black">منبع اطلاعات طرح</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                یک پکیج و نوبت سفر را انتخاب کنید. فقط نسخه قیمت منتشرشده و
                اتاق‌های قابل‌فروش وارد پیش‌نمایش می‌شوند.
              </p>
            </div>
            <label className="grid gap-2 text-sm font-bold">
              پکیج
              <select
                className="h-11 rounded-xl border border-input bg-surface px-3"
                onChange={(event) => selectPackage(event.target.value)}
                value={packageId}
              >
                <option value="">انتخاب پکیج</option>
                {packages.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold">
              نوبت سفر
              <select
                className="h-11 rounded-xl border border-input bg-surface px-3 disabled:opacity-60"
                disabled={!packageId}
                onChange={(event) => selectDeparture(event.target.value)}
                value={departureId}
              >
                <option value="">انتخاب نوبت</option>
                {departures.map((item) => (
                  <option key={item.id} value={item.id}>
                    {new Date(item.startsOn).toLocaleDateString('fa-IR')} تا{' '}
                    {new Date(item.endsOn).toLocaleDateString('fa-IR')}
                  </option>
                ))}
              </select>
            </label>
          </Card>

          {departureId && session ? (
            <PackageBannerWorkspace
              embedded
              key={departureId}
              packageId={departureId}
              returnTo={returnTo}
            />
          ) : (
            <EmptyState
              description="پس از انتخاب نوبت، قالب‌ها و کنترل‌های مجاز در کنار پیش‌نمایش واقعی نمایش داده می‌شوند."
              icon={PanelsTopLeft}
              title="یک نوبت سفر انتخاب کنید"
            />
          )}
        </>
      ) : null}
    </main>
  );
}
