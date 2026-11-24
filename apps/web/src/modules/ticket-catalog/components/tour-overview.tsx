'use client';
import { tourDestinationIds } from '@nora/contracts';
import type { TourDepartureV1, TourPackageV1 } from '@nora/contracts';
import {
  CalendarDays,
  ChevronDown,
  MapPin,
  Pencil,
  Plane,
  Layers,
  Search,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Card, Input } from '@/components/ui';
import { toursApi } from '../api/tours';
import { SiteDeleteDialog } from './site-delete-dialog';
import {
  InlineDeparturePrices,
  InlineFloatingTourPrices,
} from './tour-inline-prices';

export const tourDay = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
export const tourDate = (day: string) =>
  new Intl.DateTimeFormat('fa-IR', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${day}T12:00:00Z`));
export function tourMetrics(departures: TourDepartureV1[], today: string) {
  const current = departures.filter(
    (item) => item.startsOn <= today && item.endsOn >= today,
  );
  const upcoming = departures.filter((item) => item.startsOn > today);
  return {
    current: current.length,
    upcoming: upcoming.length,
    available: upcoming.filter(
      (item) =>
        item.remainingCapacity > 0 &&
        item.isActive !== false &&
        !item.isDeleted,
    ).length,
  };
}
export function TourOverview({
  packages,
  departures,
  cities,
  branches = [],
  loading,
  busy,
  onEdit,
  onDelete,
  onSelect,
  onRepeat,
  onPeriodStatus,
  definitionMode = false,
}: {
  onPeriodStatus?:
    | ((
        item: TourDepartureV1,
        status: 'ACTIVE' | 'PAUSED' | 'DELETED',
        sites?: string[],
      ) => void)
    | undefined;
  definitionMode?: boolean;
  packages: TourPackageV1[];
  departures: TourDepartureV1[];
  cities: { id: string; name: string }[];
  branches?: { id: string; name: string }[];
  loading: boolean;
  busy: boolean;
  onEdit: (item: TourPackageV1) => void;
  onDelete?:
    | ((item: TourPackageV1, sites?: string[]) => void | Promise<void>)
    | undefined;
  onSelect: (item: TourPackageV1) => void;
  onRepeat: (item: TourDepartureV1) => void;
}) {
  const [search, setSearch] = useState('');
  const [definitionSearch, setDefinitionSearch] = useState('');
  const [definitionStatus, setDefinitionStatus] = useState('');
  const [expanded, setExpanded] = useState('');
  const [pricedDeparture, setPricedDeparture] = useState('');
  const toggle = (id: string) => {
    setExpanded((current) => (current === id ? '' : id));
    setPricedDeparture(
      departures.find(
        (departure) => departure.packageId === id && !departure.isDeleted,
      )?.id ?? '',
    );
  };
  const [view, setView] = useState<'all' | 'current' | 'upcoming'>('all');
  const today = tourDay();
  const metrics = tourMetrics(departures, today);
  const city = (id: string) =>
    id ? (cities.find((item) => item.id === id)?.name ?? 'شهر ثبت‌شده') : '—';
  const route = (item: TourPackageV1) =>
    [city(item.originId), ...tourDestinationIds(item).map(city)].join(' ← ');
  const branch = (id: string) =>
    branches.find((item) => item.id === id)?.name ?? '';
  const shownPackages = packages.filter((item) => {
    const status = item.publicationStatus ?? 'PUBLISHED';
    const query = definitionSearch.trim().toLocaleLowerCase('fa-IR');
    return (
      (!definitionStatus || status === definitionStatus) &&
      `${item.name} ${route(item)} ${branch(item.branchId)}`
        .toLocaleLowerCase('fa-IR')
        .includes(query)
    );
  });
  const matches = (item: TourPackageV1) =>
    `${item.name} ${city(item.originId)} ${city(item.destinationId)}`.includes(
      search.trim(),
    );
  const visible = departures.filter(
    (item) =>
      matches(item.package) &&
      item.endsOn >= today &&
      (view === 'all' ||
        (view === 'current' ? item.startsOn <= today : item.startsOn > today)),
  );
  const number = (value: number) => value.toLocaleString('fa-IR');
  const definitions = (
    <Card className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-bold">تورهای تعریف‌شده</h3>
        <span className="text-xs text-muted-foreground">
          {loading ? '—' : `${number(shownPackages.length)} تور`}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Input
          aria-label="جست‌وجوی تور"
          className="flex-1 sm:max-w-sm"
          placeholder="نام تور، مبدأ یا مقصد…"
          value={definitionSearch}
          onChange={(event) => setDefinitionSearch(event.target.value)}
        />
        <select
          aria-label="وضعیت انتشار"
          className="h-10 rounded-lg border bg-background px-3 text-sm"
          value={definitionStatus}
          onChange={(event) => setDefinitionStatus(event.target.value)}
        >
          <option value="">همه وضعیت‌ها</option>
          <option value="PUBLISHED">منتشرشده</option>
          <option value="DRAFT">پیش‌نویس</option>
        </select>
      </div>
      <div className="divide-y rounded-xl border empty:hidden">
        {shownPackages.map((item) => (
          <article
            key={item.id}
            className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="min-w-0 font-semibold">
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-start hover:text-primary"
                    aria-expanded={expanded === item.id}
                    onClick={() => toggle(item.id)}
                  >
                    <ChevronDown
                      aria-hidden
                      size={16}
                      className={expanded === item.id ? 'rotate-180' : ''}
                    />
                    {item.name}
                  </button>
                </h4>
                <Badge
                  className={
                    item.publicationStatus === 'DRAFT'
                      ? 'bg-muted text-muted-foreground'
                      : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  }
                >
                  {item.publicationStatus === 'DRAFT' ? 'پیش‌نویس' : 'منتشرشده'}
                </Badge>
                {item.details?.isFloating && <Badge>شناور</Badge>}
                {item.details?.isCombined && <Badge>تور ترکیبی</Badge>}
              </div>
              <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin aria-hidden size={15} />
                {route(item)}
                {branch(item.branchId) && (
                  <span>· {branch(item.branchId)}</span>
                )}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {item.hotelIds.length
                  ? `${number(item.hotelIds.length)} هتل`
                  : 'خدمات تور'}
                {item.visa ? ' · ویزا' : ''}
                {item.insuranceId ? ' · بیمه' : ''}
                {item.transferOutbound || item.transferReturn
                  ? ' · ترانسفر'
                  : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                disabled={busy}
                onClick={() =>
                  definitionMode ? toggle(item.id) : onSelect(item)
                }
              >
                <CalendarDays aria-hidden size={15} />
                {definitionMode ? 'مدیریت نوبت' : 'ثبت نوبت'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => onEdit(item)}
              >
                <Pencil aria-hidden size={15} />
                ویرایش
              </Button>
              {definitionMode && onDelete && (
                <SiteDeleteDialog
                  trigger={
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      disabled={busy}
                    >
                      <Trash2 aria-hidden size={15} />
                      حذف تور
                    </Button>
                  }
                  title={`حذف تور «${item.name}»`}
                  description="ابتدا نوبت‌های باقی‌مانده را حذف کنید. سوابق سفر حفظ می‌شوند."
                  loadSites={() =>
                    toursApi.deletionSites(
                      'floating-tour',
                      item.id,
                      item.branchId,
                    )
                  }
                  onConfirm={(sites) => onDelete(item, sites)}
                />
              )}
            </div>
            {expanded === item.id && (
              <div className="min-w-0 space-y-3 border-t pt-3 lg:col-span-2">
                {departures
                  .filter(
                    (departure) =>
                      departure.packageId === item.id && !departure.isDeleted,
                  )
                  .map((departure) => (
                    <section
                      key={departure.id}
                      className="rounded-lg border bg-muted/20 p-3"
                    >
                      <button
                        type="button"
                        aria-expanded={pricedDeparture === departure.id}
                        onClick={() =>
                          setPricedDeparture((current) =>
                            current === departure.id ? '' : departure.id,
                          )
                        }
                        className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 text-start text-sm"
                      >
                        <ChevronDown
                          aria-hidden
                          size={16}
                          className={
                            pricedDeparture === departure.id ? 'rotate-180' : ''
                          }
                        />
                        <strong>
                          {tourDate(departure.startsOn)} تا{' '}
                          {tourDate(departure.endsOn)}
                        </strong>
                        <span>
                          {departure.outbound.carrierName} ·{' '}
                          <bdi>{departure.outbound.serviceNumber}</bdi>
                          {departure.returning && (
                            <>
                              {' '}
                              / <bdi>{departure.returning.serviceNumber}</bdi>
                            </>
                          )}
                        </span>
                        <span>ظرفیت {number(departure.remainingCapacity)}</span>
                        {departure.isActive === false && (
                          <Badge>فروش بازه متوقف است</Badge>
                        )}
                      </button>
                      {pricedDeparture === departure.id && (
                        <div className="mt-3">
                          <InlineDeparturePrices departure={departure} />
                        </div>
                      )}
                    </section>
                  ))}
                {item.details?.isFloating ? (
                  <InlineFloatingTourPrices tourId={item.id} />
                ) : (
                  !departures.some(
                    (departure) =>
                      departure.packageId === item.id && !departure.isDeleted,
                  ) && (
                    <p className="text-sm text-muted-foreground">
                      هنوز نوبتی ثبت نشده است.
                    </p>
                  )
                )}
                {definitionMode && !item.details?.isFloating && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => onSelect(item)}
                  >
                    مدیریت نوبت و قیمت
                  </Button>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
      {!loading && !shownPackages.length && (
        <p className="py-5 text-center text-sm text-muted-foreground">
          {definitionSearch || definitionStatus
            ? 'تور تعریف‌شده‌ای مطابق جست‌وجو یافت نشد.'
            : 'برای شروع، اولین تور خود را تعریف کنید.'}
        </p>
      )}
    </Card>
  );
  return (
    <div className="space-y-5" aria-busy={loading}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'تورهای تعریف‌شده',
            value: packages.length,
            icon: Layers,
            color: 'text-blue-700 bg-blue-50',
          },
          {
            label: 'تورهای در حال برگزاری',
            value: metrics.current,
            icon: MapPin,
            color: 'text-emerald-700 bg-emerald-50',
          },
          {
            label: 'نوبت‌های پیش‌رو',
            value: metrics.upcoming,
            icon: CalendarDays,
            color: 'text-violet-700 bg-violet-50',
          },
          {
            label: 'نوبت‌های دارای ظرفیت',
            value: metrics.available,
            icon: Plane,
            color: 'text-amber-700 bg-amber-50',
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">{label}</span>
              <span className={`rounded-xl p-2.5 ${color}`}>
                <Icon aria-hidden size={20} />
              </span>
            </div>
            <p className="mt-3 text-3xl font-bold">
              {loading ? '—' : number(value)}
            </p>
          </Card>
        ))}
      </div>
      {definitionMode && definitions}
      <Card className="space-y-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold">تورهای جاری و پیش‌رو</h3>
          </div>
          <div className="relative w-full sm:w-72">
            <Search
              aria-hidden
              size={17}
              className="absolute right-3 top-3 text-muted-foreground"
            />
            <Input
              aria-label="جست‌وجوی تور"
              className="pr-9"
              placeholder="نام تور، مبدأ یا مقصد…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="فیلتر وضعیت تور">
          {(
            [
              ['all', 'همه نوبت‌ها'],
              ['current', 'در حال برگزاری'],
              ['upcoming', 'پیش‌رو'],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              variant={view === key ? 'primary' : 'outline'}
              aria-pressed={view === key}
              onClick={() => setView(key)}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="space-y-3">
          {[...new Set(visible.map((item) => item.packageId))].map(
            (packageId) => {
              const periods = visible.filter(
                (item) => item.packageId === packageId,
              );
              const pack = periods[0]!.package;
              return (
                <section
                  key={packageId}
                  className="overflow-hidden rounded-xl border"
                >
                  <header className="flex flex-wrap items-center justify-between gap-2 bg-primary/5 px-4 py-3">
                    <div>
                      <h4 className="font-bold">{pack.name}</h4>
                      <span>
                        {pack.publicationStatus === 'DRAFT'
                          ? 'پیش‌نویس'
                          : 'منتشرشده'}
                      </span>
                      <p className="text-xs text-muted-foreground">
                        {city(pack.originId)} ←{' '}
                        {tourDestinationIds(pack).map(city).join(' ← ')}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => onEdit(pack)}
                    >
                      ویرایش تور
                    </Button>
                  </header>
                  <div className="divide-y">
                    {periods.map((item) => {
                      const capacity = Math.min(
                        item.outbound.totalCapacity,
                        item.returning?.totalCapacity ??
                          item.outbound.totalCapacity,
                      );
                      const remaining = Math.max(
                        0,
                        Math.min(capacity, item.remainingCapacity),
                      );
                      return (
                        <article
                          key={item.id}
                          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                        >
                          <div className="min-w-56 space-y-1">
                            <p>
                              {tourDate(item.startsOn)} تا{' '}
                              {tourDate(item.endsOn)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {item.outbound.carrierName} ·{' '}
                              {item.outbound.serviceNumber}
                              {item.returning
                                ? ` / ${item.returning.serviceNumber}`
                                : ''}
                            </p>
                          </div>
                          <div className="min-w-32 text-xs">
                            <p>
                              {item.isActive === false
                                ? 'متوقف'
                                : item.startsOn <= today
                                  ? 'در حال برگزاری'
                                  : remaining
                                    ? 'پیش‌رو'
                                    : 'بدون ظرفیت فروش'}
                            </p>
                            <p>
                              {number(remaining)} از {number(capacity)} صندلی
                            </p>
                            <div
                              role="progressbar"
                              aria-label={`ظرفیت باقی‌مانده ${pack.name}`}
                              aria-valuemin={0}
                              aria-valuemax={capacity || 1}
                              aria-valuenow={remaining}
                              className="mt-1 h-1 overflow-hidden rounded bg-primary/10"
                            >
                              <div
                                className="h-full bg-primary"
                                style={{
                                  width: `${capacity ? (remaining / capacity) * 100 : 0}%`,
                                }}
                              />
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {onPeriodStatus ? (
                              <Button asChild variant="outline">
                                <a href="/integrations">
                                  مدیریت انتشار در سایت
                                </a>
                              </Button>
                            ) : null}
                            <Button
                              variant="outline"
                              disabled={busy}
                              onClick={() => onRepeat(item)}
                            >
                              {definitionMode
                                ? 'مدیریت نوبت و قیمت'
                                : 'تکرار برای هفته بعد'}
                            </Button>
                            <Button asChild variant="outline">
                              <a
                                href={`/reservations/hotel-rates?tourDepartureId=${encodeURIComponent(item.id)}`}
                              >
                                هتل‌های این بازه
                              </a>
                            </Button>
                            {onPeriodStatus && (
                              <>
                                <Button
                                  variant="outline"
                                  disabled={busy}
                                  onClick={() =>
                                    onPeriodStatus(
                                      item,
                                      item.isActive === false
                                        ? 'ACTIVE'
                                        : 'PAUSED',
                                    )
                                  }
                                >
                                  {item.isActive === false
                                    ? 'فعال‌سازی بازه'
                                    : 'توقف بازه'}
                                </Button>
                                <SiteDeleteDialog
                                  trigger={
                                    <Button
                                      variant="destructive"
                                      disabled={busy}
                                    >
                                      حذف بازه
                                    </Button>
                                  }
                                  title="حذف بازه"
                                  description="این بازه از انتخاب‌های جدید حذف می‌شود؛ سوابق قراردادها و قیمت‌های قبلی حفظ می‌شوند."
                                  loadSites={() =>
                                    toursApi.deletionSites(
                                      'tour',
                                      item.id,
                                      item.branchId,
                                    )
                                  }
                                  onConfirm={(sites) =>
                                    onPeriodStatus(item, 'DELETED', sites)
                                  }
                                />
                              </>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            },
          )}
        </div>
        {loading && (
          <p
            role="status"
            className="py-8 text-center text-sm text-muted-foreground"
          >
            در حال دریافت تورها…
          </p>
        )}
        {!loading && !visible.length && (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            {search || view !== 'all'
              ? 'توری مطابق جست‌وجو و فیلتر یافت نشد.'
              : 'هنوز نوبت جاری یا پیش‌رو ثبت نشده است؛ از فهرست زیر نوبت جدید بسازید.'}
          </p>
        )}
      </Card>
      {!definitionMode && definitions}
    </div>
  );
}
