'use client';

import type { TourDepartureV1 } from '@nora/contracts';
import { CalendarDays, FileDown, Plane, Sticker } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { Alert, Badge, Card } from '@/components/ui/surfaces';
import { cn } from '@/lib/utils';

const themes = [
  { id: 'violet', title: 'بنفش', className: 'from-violet-700 to-fuchsia-500' },
  { id: 'blue', title: 'آبی', className: 'from-blue-700 to-cyan-500' },
  { id: 'orange', title: 'نارنجی', className: 'from-orange-600 to-amber-400' },
] as const;

function faDate(value: string) {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

function route(tour: TourDepartureV1) {
  const locations = (tour.package.details?.itinerary ?? [])
    .map((item) => item.location?.trim())
    .filter((item): item is string => Boolean(item));
  const origin =
    locations[0] ??
    tour.package.details?.originAirportCode ??
    tour.outbound.originId;
  const destination = locations.at(-1) ?? tour.package.name;
  return `${origin} ← ${destination}`;
}

export function PackageStickerWorkspace({ tour }: { tour: TourDepartureV1 }) {
  const [label, setLabel] = useState('پیشنهاد ویژه');
  const [themeId, setThemeId] = useState<(typeof themes)[number]['id']>(
    'violet',
  );
  const [showDate, setShowDate] = useState(true);
  const [showFlight, setShowFlight] = useState(true);
  const theme = useMemo(
    () => themes.find((item) => item.id === themeId) ?? themes[0],
    [themeId],
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <Card className="h-fit space-y-5 p-5">
        <div>
          <h2 className="font-black">تنظیمات استیکر</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            متن و ظاهر استیکر را تنظیم کنید؛ اطلاعات سفر از پکیج انتخاب‌شده
            خوانده می‌شود.
          </p>
        </div>

        <label className="grid gap-2 text-sm font-bold">
          متن استیکر
          <Input
            maxLength={32}
            onChange={(event) => setLabel(event.target.value)}
            value={label}
          />
        </label>

        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-bold">رنگ‌بندی</legend>
          <div className="grid grid-cols-3 gap-2">
            {themes.map((item) => (
              <button
                aria-pressed={themeId === item.id}
                className={cn(
                  'rounded-xl border p-2 text-xs font-bold outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  themeId === item.id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground',
                )}
                key={item.id}
                onClick={() => setThemeId(item.id)}
                type="button"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'mx-auto mb-2 block h-5 rounded-md bg-gradient-to-l',
                    item.className,
                  )}
                />
                {item.title}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="flex items-center justify-between gap-3 text-sm font-bold">
          نمایش تاریخ
          <input
            checked={showDate}
            className="size-4 accent-primary"
            onChange={(event) => setShowDate(event.target.checked)}
            type="checkbox"
          />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm font-bold">
          نمایش پرواز
          <input
            checked={showFlight}
            className="size-4 accent-primary"
            onChange={(event) => setShowFlight(event.target.checked)}
            type="checkbox"
          />
        </label>

        <Button className="w-full" disabled type="button">
          <FileDown className="size-4" /> خروجی استیکر
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          در انتظار سرویس خروجی اسناد
        </p>
      </Card>

      <Card className="grid min-h-[32rem] place-items-center overflow-hidden bg-muted/40 p-6">
        <div className="w-full max-w-xl text-center">
          <Badge className="mb-4">پیش‌نمایش زنده</Badge>
          <article
            aria-label="پیش‌نمایش واقعی استیکر پکیج"
            className={cn(
              'relative isolate mx-auto grid aspect-square w-full max-w-md place-items-center overflow-hidden rounded-[4rem] bg-gradient-to-br p-10 text-white shadow-2xl',
              theme.className,
            )}
            dir="rtl"
          >
            <span className="absolute -start-16 -top-16 -z-10 size-56 rounded-full bg-white/20 blur-2xl" />
            <span className="absolute -bottom-20 -end-12 -z-10 size-64 rounded-full bg-slate-950/20 blur-2xl" />
            <div>
              <Sticker className="mx-auto size-12 text-white/80" />
              <p className="mt-5 text-sm font-bold text-white/75">
                {route(tour)}
              </p>
              <h3 className="mt-3 text-4xl font-black leading-tight">
                {label || tour.package.name}
              </h3>
              <p className="mt-3 text-xl font-black">{tour.package.name}</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs font-bold">
                {showDate ? (
                  <span className="rounded-full bg-white/15 px-3 py-2 backdrop-blur-sm">
                    <CalendarDays className="ms-1 inline size-4" />
                    {faDate(tour.startsOn)} تا {faDate(tour.endsOn)}
                  </span>
                ) : null}
                {showFlight ? (
                  <span className="rounded-full bg-white/15 px-3 py-2 backdrop-blur-sm">
                    <Plane className="ms-1 inline size-4" />
                    {tour.outbound.carrierName} · {tour.outbound.serviceNumber}
                  </span>
                ) : null}
              </div>
            </div>
          </article>
          <Alert
            className="mt-5 text-start"
            description="این پیش‌نمایش HTML/CSS است و خروجی تصویر ساختگی تولید نمی‌شود."
            title="پیش‌نمایش امن"
          />
        </div>
      </Card>
    </div>
  );
}
