'use client';

import type { TourDepartureV1 } from '@nora/contracts';
import { FileDown } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { Alert, Card } from '@/components/ui/surfaces';
import { cn } from '@/lib/utils';

type StickerBrand = 'jahan' | 'niayesh';

function persianDate(value: string) {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

function dateDetails(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return {
    weekday: new Intl.DateTimeFormat('fa-IR', {
      weekday: 'long',
      timeZone: 'UTC',
    }).format(date),
    gregorian: new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(date),
  };
}

export function PackageStickerWorkspace({ tour }: { tour: TourDepartureV1 }) {
  const [brand, setBrand] = useState<StickerBrand>('jahan');
  const [startDate, setStartDate] = useState(tour.startsOn.slice(0, 10));
  const [range, setRange] = useState(false);
  const [endDate, setEndDate] = useState(tour.endsOn.slice(0, 10));
  const detail = useMemo(() => dateDetails(startDate), [startDate]);
  const isJahan = brand === 'jahan';

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[21rem_minmax(0,1fr)]">
      <Card className="space-y-5 p-5 lg:sticky lg:top-4">
        <div>
          <h2 className="text-lg font-black">استیکر تاریخ روز</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            برند و تاریخ را انتخاب کنید؛ روز هفته و تاریخ میلادی خودکار محاسبه
            می‌شوند.
          </p>
        </div>

        <label className="grid gap-2 text-sm font-bold">
          برند
          <select
            className="h-11 rounded-xl border border-input bg-surface px-3"
            onChange={(event) => setBrand(event.target.value as StickerBrand)}
            value={brand}
          >
            <option value="jahan">جهان باستان</option>
            <option value="niayesh">نیایش سیر</option>
          </select>
        </label>

        <label className="grid gap-2 text-sm font-bold">
          تاریخ شمسی یا شروع بازه
          <Input
            dir="ltr"
            onChange={(event) => setStartDate(event.target.value)}
            type="date"
            value={startDate}
          />
        </label>

        <label className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 p-3 text-sm font-bold">
          تولید استیکر برای بازه تاریخ
          <input
            checked={range}
            className="size-4 accent-primary"
            onChange={(event) => setRange(event.target.checked)}
            type="checkbox"
          />
        </label>

        {range ? (
          <label className="grid gap-2 text-sm font-bold">
            تاریخ پایان بازه
            <Input
              dir="ltr"
              min={startDate}
              onChange={(event) => setEndDate(event.target.value)}
              type="date"
              value={endDate}
            />
          </label>
        ) : null}

        <div className="grid gap-2 rounded-xl border border-border p-3 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">تاریخ شمسی</span>
            <strong>{persianDate(startDate)}</strong>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">روز هفته</span>
            <strong>{detail.weekday}</strong>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">تاریخ میلادی</span>
            <strong dir="ltr">{detail.gregorian}</strong>
          </div>
          {range ? (
            <div className="flex justify-between gap-3 border-t pt-2">
              <span className="text-muted-foreground">پایان بازه</span>
              <strong>{persianDate(endDate)}</strong>
            </div>
          ) : null}
        </div>

        <Button className="w-full" disabled type="button">
          <FileDown className="size-4" /> دانلود PNG شفاف
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          در انتظار سرویس خروجی اسناد
        </p>
      </Card>

      <section>
        <Card className="mb-4 p-4">
          <h2 className="font-black">پیش‌نمایش استیکر</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            پیش‌نمایش مربوط به اولین روز است · PNG شفاف · ۲۵۰۸ × ۲۵۰۸ پیکسل
          </p>
        </Card>
        <Card className="grid min-h-[42rem] place-items-center overflow-hidden bg-[linear-gradient(45deg,#d9e1ea_25%,transparent_25%),linear-gradient(-45deg,#d9e1ea_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#d9e1ea_75%),linear-gradient(-45deg,transparent_75%,#d9e1ea_75%)] bg-[length:28px_28px] bg-[position:0_0,0_14px,14px_-14px,-14px_0] p-7">
          <article
            aria-label="پیش‌نمایش واقعی استیکر تاریخ"
            className={cn(
              'relative grid aspect-square w-full max-w-lg place-items-center overflow-hidden p-12 text-center text-white shadow-2xl',
              isJahan
                ? 'rounded-[18%] bg-gradient-to-br from-[#071b51] via-[#0a347c] to-[#dfb74e]'
                : 'rounded-full border-[14px] border-white bg-gradient-to-br from-[#7d123b] via-[#b31956] to-[#f3bdce]',
            )}
            dir="rtl"
          >
            <span className="absolute -start-20 -top-20 size-64 rounded-full bg-white/15 blur-2xl" />
            <span className="absolute -bottom-20 -end-16 size-72 rounded-full bg-black/20 blur-2xl" />
            <div className="relative">
              <div className="mx-auto grid size-24 place-items-center rounded-full border-4 border-white/80 text-lg font-black">
                {isJahan ? 'جهان باستان' : 'نیایش سیر'}
              </div>
              <p className="mt-7 text-2xl font-black">{detail.weekday}</p>
              <p className="mt-2 text-6xl font-black tracking-tight">
                {persianDate(startDate)}
              </p>
              <p
                className="mt-4 text-lg font-bold uppercase tracking-wider text-white/80"
                dir="ltr"
              >
                {detail.gregorian}
              </p>
              {range ? (
                <p className="mt-5 rounded-full bg-white/15 px-5 py-2 text-sm font-bold">
                  تا {persianDate(endDate)}
                </p>
              ) : null}
            </div>
          </article>
        </Card>
        <Alert
          className="mt-4"
          description="طرح شطرنجی فقط نمایش شفافیت است و داخل خروجی نخواهد بود. در این Phase خروجی ساختگی تولید نمی‌شود."
          title="پیش‌نمایش شفاف"
        />
      </section>
    </div>
  );
}
