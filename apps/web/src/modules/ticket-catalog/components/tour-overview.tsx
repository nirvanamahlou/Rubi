import type { TourDepartureV1, TourPackageV1 } from '@nora/contracts';
import {
  CalendarDays,
  MapPin,
  Pencil,
  Plane,
  Layers,
  ArrowLeft,
  Search,
} from 'lucide-react';
import { useState } from 'react';
import { Button, Card, Input } from '@/components/ui';

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
    available: upcoming.filter((item) => item.remainingCapacity > 0).length,
  };
}
export function TourOverview({
  packages,
  departures,
  cities,
  loading,
  busy,
  onEdit,
  onSelect,
  onRepeat,
  definitionMode = false,
}: {
  definitionMode?: boolean;
  packages: TourPackageV1[];
  departures: TourDepartureV1[];
  cities: { id: string; name: string }[];
  loading: boolean;
  busy: boolean;
  onEdit: (item: TourPackageV1) => void;
  onSelect: (item: TourPackageV1) => void;
  onRepeat: (item: TourDepartureV1) => void;
}) {
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'all' | 'current' | 'upcoming'>('all');
  const today = tourDay();
  const metrics = tourMetrics(departures, today);
  const city = (id: string) =>
    cities.find((item) => item.id === id)?.name ?? 'شهر ثبت‌شده';
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
  return (
    <div className="space-y-5" aria-busy={loading}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'تورهای تعریف‌شده',
            value: packages.length,
            icon: Layers,
            hint: 'بسته‌های خدمات در دسترس',
            color: 'text-blue-700 bg-blue-50',
          },
          {
            label: 'تورهای در حال برگزاری',
            value: metrics.current,
            icon: MapPin,
            hint: 'بر اساس بازه برگزاری امروز',
            color: 'text-emerald-700 bg-emerald-50',
          },
          {
            label: 'نوبت‌های پیش‌رو',
            value: metrics.upcoming,
            icon: CalendarDays,
            hint: 'سفرهای بعد از امروز',
            color: 'text-violet-700 bg-violet-50',
          },
          {
            label: 'نوبت‌های دارای ظرفیت',
            value: metrics.available,
            icon: Plane,
            hint: 'نوبت‌های آینده با صندلی باقی‌مانده',
            color: 'text-amber-700 bg-amber-50',
          },
        ].map(({ label, value, icon: Icon, hint, color }) => (
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
            <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
          </Card>
        ))}
      </div>
      <Card className="space-y-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold">تورهای جاری و پیش‌رو</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              برنامه سفر و ظرفیت باقی‌مانده هر نوبت
            </p>
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
        <div className="grid gap-4 lg:grid-cols-2">
          {visible.map((item) => {
            const ongoing = item.startsOn <= today;
            const capacity = Math.min(
              item.outbound.totalCapacity,
              item.returning?.totalCapacity ?? item.outbound.totalCapacity,
            );
            const remaining = Math.max(
              0,
              Math.min(capacity, item.remainingCapacity),
            );
            return (
              <article
                key={item.id}
                className="rounded-2xl border bg-gradient-to-bl from-primary/5 to-background p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h4 className="font-bold">{item.package.name}</h4>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${ongoing ? 'bg-emerald-50 text-emerald-700' : remaining ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}
                  >
                    {ongoing
                      ? 'در حال برگزاری'
                      : remaining
                        ? 'پیش‌رو'
                        : 'بدون ظرفیت فروش'}
                  </span>
                </div>
                <p className="mt-3 flex items-center gap-2 text-sm">
                  <MapPin aria-hidden size={16} />
                  {city(item.package.originId)}
                  <ArrowLeft aria-hidden size={14} />
                  {city(item.package.destinationId)}
                </p>
                <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarDays aria-hidden size={16} />
                  {tourDate(item.startsOn)} تا {tourDate(item.endsOn)}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  {item.outbound.carrierName} · {item.outbound.serviceNumber}
                  {item.returning ? ` / ${item.returning.serviceNumber}` : ''}
                </p>
                <div className="mt-4 border-t pt-4">
                  <div className="flex justify-between gap-2 text-sm">
                    <span>ظرفیت باقی‌مانده</span>
                    <b>
                      {number(remaining)} از {number(capacity)} صندلی
                    </b>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={`ظرفیت باقی‌مانده ${item.package.name}`}
                    aria-valuemin={0}
                    aria-valuemax={capacity || 1}
                    aria-valuenow={remaining}
                    className="mt-2 h-2 overflow-hidden rounded-full bg-primary/10"
                  >
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${capacity ? (remaining / capacity) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  {ongoing && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      فروش بلیت رفت پس از حرکت بسته است.
                    </p>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => onEdit(item.package)}
                  >
                    <Pencil aria-hidden size={15} />
                    ویرایش تور
                  </Button>
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
                </div>
              </article>
            );
          })}
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
      <Card className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">تورهای تعریف‌شده</h3>
          <span className="text-xs text-muted-foreground">
            {loading ? '—' : `${number(packages.length)} تور`}
          </span>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {packages.filter(matches).map((item) => (
            <article
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4"
            >
              <div>
                <h4 className="font-semibold">{item.name}</h4>
                <p className="mt-2 text-sm text-muted-foreground">
                  {city(item.originId)} ← {city(item.destinationId)}
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
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => onEdit(item)}
                >
                  <Pencil aria-hidden size={15} />
                  ویرایش
                </Button>
                <Button disabled={busy} onClick={() => onSelect(item)}>
                  {definitionMode ? 'مدیریت نوبت' : 'ثبت نوبت'}
                </Button>
              </div>
            </article>
          ))}
        </div>
        {!loading && !packages.filter(matches).length && (
          <p className="py-5 text-center text-sm text-muted-foreground">
            {search
              ? 'تور تعریف‌شده‌ای مطابق جست‌وجو یافت نشد.'
              : 'برای شروع، اولین تور خود را تعریف کنید.'}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          شاخص‌ها مربوط به تورهای قابل مشاهده حساب شما هستند؛ ظرفیت هر نوبت از
          موجودی مشترک بلیت‌ها خوانده می‌شود.
        </p>
      </Card>
    </div>
  );
}
