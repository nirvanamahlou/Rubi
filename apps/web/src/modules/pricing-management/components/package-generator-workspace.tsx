'use client';

import type { LoginResponse, TourDepartureV1 } from '@nora/contracts';
import {
  ArrowLeft,
  ArrowRight,
  Image,
  PackageOpen,
  Sticker,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { buttonVariants } from '@/components/ui/button';
import {
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
  PageHeader,
  Skeleton,
} from '@/components/ui/surfaces';
import { packagePricingApi, PackagePricingApiError } from '../api/client';
import { canViewPackageBanner } from '../model/package-banner';
import { PackageBannerWorkspace } from './package-banner-workspace';
import { PackagePricingBreadcrumbs } from './package-pricing-breadcrumbs';
import { PackageStickerWorkspace } from './package-sticker-workspace';

type GeneratorSection = 'package' | 'banner' | 'sticker';

export const packageGeneratorSectionLabels: Record<GeneratorSection, string> = {
  package: 'تولید پکیج',
  banner: 'بنر',
  sticker: 'استیکر',
};

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

function currentSelection(): {
  packageId: string;
  departureId: string;
  section: GeneratorSection;
} {
  if (typeof globalThis.location === 'undefined')
    return { packageId: '', departureId: '', section: 'package' as const };
  const query = new URL(globalThis.location.href).searchParams;
  const section = query.get('section');
  return {
    packageId: query.get('package') ?? '',
    departureId: query.get('departure') ?? '',
    section:
      section === 'banner' || section === 'sticker' ? section : 'package',
  };
}

function replaceSelection(
  packageId: string,
  departureId: string,
  section: GeneratorSection,
) {
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
  url.searchParams.set('section', section);
  globalThis.history.replaceState(null, '', `${url.pathname}${url.search}`);
}

export function PackageGeneratorWorkspace() {
  const [session, setSession] = useState<LoginResponse | null>(null);
  const [tours, setTours] = useState<readonly TourDepartureV1[]>([]);
  const [packageId, setPackageId] = useState('');
  const [departureId, setDepartureId] = useState('');
  const [section, setSection] = useState<GeneratorSection>('package');
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
      setSection(requested.section);
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
  const selectedTour = tours.find((item) => item.id === departureId) ?? null;
  const returnTo = `/sales/pricing/generator?${new URLSearchParams({
    package: packageId,
    departure: departureId,
    section,
  }).toString()}`;

  function selectPackage(value: string) {
    setPackageId(value);
    setDepartureId('');
    replaceSelection(value, '', section);
  }

  function selectDeparture(value: string) {
    setDepartureId(value);
    replaceSelection(packageId, value, section);
  }

  function selectSection(value: string) {
    const next = value as GeneratorSection;
    setSection(next);
    replaceSelection(packageId, departureId, next);
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

      {!loading && !error ? (
        <>
          {tours.length > 0 ? (
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
          ) : null}

          <Tabs dir="rtl" onValueChange={selectSection} value={section}>
            <TabsList
              aria-label="بخش‌های پک جنریتور"
              className="grid h-auto w-full grid-cols-3 gap-2 rounded-2xl p-2"
            >
              <TabsTrigger
                className="min-h-14 gap-2 font-black"
                value="package"
              >
                <PackageOpen className="size-5" />
                {packageGeneratorSectionLabels.package}
              </TabsTrigger>
              <TabsTrigger className="min-h-14 gap-2 font-black" value="banner">
                <Image className="size-5" />
                {packageGeneratorSectionLabels.banner}
              </TabsTrigger>
              <TabsTrigger
                className="min-h-14 gap-2 font-black"
                value="sticker"
              >
                <Sticker className="size-5" />
                {packageGeneratorSectionLabels.sticker}
              </TabsTrigger>
            </TabsList>

            <TabsContent className="mt-5 outline-none" value="package">
              {selectedTour ? (
                <Card className="overflow-hidden p-0">
                  <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:p-8">
                    <div>
                      <Badge>پکیج انتخاب‌شده</Badge>
                      <h2 className="mt-4 text-2xl font-black">
                        {selectedTour.package.name}
                      </h2>
                      <p className="mt-2 text-sm leading-7 text-muted-foreground">
                        نسخه{' '}
                        {selectedTour.package.version.toLocaleString('fa-IR')} ·
                        ظرفیت باقی‌مانده{' '}
                        {selectedTour.remainingCapacity.toLocaleString('fa-IR')}{' '}
                        نفر
                      </p>
                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl bg-muted p-4">
                          <p className="text-xs text-muted-foreground">
                            بازه سفر
                          </p>
                          <p className="mt-2 font-black">
                            {new Date(selectedTour.startsOn).toLocaleDateString(
                              'fa-IR',
                            )}{' '}
                            تا{' '}
                            {new Date(selectedTour.endsOn).toLocaleDateString(
                              'fa-IR',
                            )}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-muted p-4">
                          <p className="text-xs text-muted-foreground">
                            پرواز رفت
                          </p>
                          <p className="mt-2 font-black">
                            {selectedTour.outbound.carrierName} ·{' '}
                            {selectedTour.outbound.serviceNumber}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="grid content-center gap-3 rounded-2xl border border-border bg-surface p-5">
                      <p className="text-sm font-black">مرحله بعد</p>
                      <p className="text-xs leading-6 text-muted-foreground">
                        برای طراحی محتوای تبلیغاتی همین پکیج، وارد بنر یا استیکر
                        شوید.
                      </p>
                      <button
                        className={buttonVariants({ variant: 'primary' })}
                        onClick={() => selectSection('banner')}
                        type="button"
                      >
                        ساخت بنر <ArrowLeft className="size-4" />
                      </button>
                      <button
                        className={buttonVariants({ variant: 'outline' })}
                        onClick={() => selectSection('sticker')}
                        type="button"
                      >
                        ساخت استیکر <Sticker className="size-4" />
                      </button>
                    </div>
                  </div>
                </Card>
              ) : (
                <EmptyState
                  description={
                    tours.length === 0
                      ? 'پس از تعریف نوبت تور و انتشار قیمت، پکیج قابل انتخاب در این بخش ظاهر می‌شود.'
                      : 'برای شروع تولید محتوا، پکیج و نوبت سفر را از بالای صفحه انتخاب کنید.'
                  }
                  icon={PackageOpen}
                  title={
                    tours.length === 0
                      ? 'پکیج قابل‌نمایشی وجود ندارد'
                      : 'یک نوبت سفر انتخاب کنید'
                  }
                />
              )}
            </TabsContent>

            <TabsContent className="mt-5 outline-none" value="banner">
              {departureId && session ? (
                <PackageBannerWorkspace
                  embedded
                  key={departureId}
                  packageId={departureId}
                  returnTo={returnTo}
                />
              ) : (
                <EmptyState
                  description="پس از انتخاب نوبت، قالب‌ها و کنترل‌های بنر نمایش داده می‌شوند."
                  icon={Image}
                  title="برای ساخت بنر، یک نوبت سفر انتخاب کنید"
                />
              )}
            </TabsContent>

            <TabsContent className="mt-5 outline-none" value="sticker">
              {selectedTour ? (
                <PackageStickerWorkspace
                  key={selectedTour.id}
                  tour={selectedTour}
                />
              ) : (
                <EmptyState
                  description="استیکر از اطلاعات واقعی همان پکیج و نوبت سفر ساخته می‌شود."
                  icon={Sticker}
                  title="برای ساخت استیکر، یک نوبت سفر انتخاب کنید"
                />
              )}
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </main>
  );
}
