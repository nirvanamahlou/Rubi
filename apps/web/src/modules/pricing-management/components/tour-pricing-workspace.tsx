'use client';

import type {
  LoginResponse,
  PackageTourCostGridV1,
  PackageTourHotelPurchaseBatchV1,
  TourDepartureV1,
} from '@nora/contracts';
import { Banknote, ClipboardCheck, Hotel, Plane, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
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
import { packagePricingApi } from '../api/client';
import { previewHotelRoomSale } from './tour-price-math';

const roomColumns = [
  ['double', 'دوتخته'],
  ['single', 'یک‌تخته'],
  ['triple', 'سه‌تخته'],
  ['doubleChild', 'دوتخته + کودک'],
  ['doubleTwoChildren', 'دوتخته + دو کودک'],
  ['family', 'خانوادگی'],
] as const;

type Adjustment = {
  direction: 'increase' | 'decrease';
  mode: 'percent' | 'fixed';
  value: string;
};
const defaultAdjustment = (): Adjustment => ({
  direction: 'increase',
  mode: 'percent',
  value: '0',
});

export function TourPricingWorkspace() {
  const [session, setSession] = useState<LoginResponse | null>(null);
  const [tours, setTours] = useState<readonly TourDepartureV1[]>([]);
  const [tourId, setTourId] = useState('');
  const [grid, setGrid] = useState<PackageTourCostGridV1 | null>(null);
  const [batchId, setBatchId] = useState('');
  const [adjustments, setAdjustments] = useState<Record<string, Adjustment>>({});
  const [adultFlight, setAdultFlight] = useState('');
  const [childFlight, setChildFlight] = useState('');
  const [businessIncrease, setBusinessIncrease] = useState('');
  const [commission, setCommission] = useState('');
  const [loadingTours, setLoadingTours] = useState(true);
  const [loadingCosts, setLoadingCosts] = useState(false);
  const [error, setError] = useState('');
  const [costError, setCostError] = useState('');

  const loadTours = useCallback(async () => {
    setLoadingTours(true);
    setError('');
    try {
      const currentSession = await packagePricingApi.session();
      const result = await packagePricingApi.tours(currentSession);
      setSession(currentSession);
      setTours(result.data);
    } catch (cause) {
      setSession(null);
      setTours([]);
      setError(
        cause instanceof Error
          ? cause.message
          : 'دریافت نوبت‌های تور ناموفق بود.',
      );
    } finally {
      setLoadingTours(false);
    }
  }, []);

  useEffect(() => {
    const timer = globalThis.setTimeout(() => void loadTours(), 0);
    return () => globalThis.clearTimeout(timer);
  }, [loadTours]);

  async function selectTour(id: string) {
    setTourId(id);
    setGrid(null);
    setBatchId('');
    setCostError('');
    setAdjustments({});
    if (!id || !session) return;
    setLoadingCosts(true);
    try {
      const result = await packagePricingApi.tourCosts(id, session);
      setGrid(result);
      setBatchId(result.purchaseBatches[0]?.id ?? '');
    } catch (cause) {
      setCostError(
        cause instanceof Error
          ? cause.message
          : 'دریافت قیمت خرید هتل‌های تور ناموفق بود.',
      );
    } finally {
      setLoadingCosts(false);
    }
  }

  const batch: PackageTourHotelPurchaseBatchV1 | undefined =
    grid?.purchaseBatches.find((item) => item.id === batchId);
  const missingForBatch =
    grid?.tour.package.hotelIds.filter(
      (hotelId) => !batch?.rows.some((row) => row.hotelId === hotelId),
    ) ?? [];
  const invalidSale = batch?.rows.some((row) =>
    roomColumns.some(([key]) =>
      !previewHotelRoomSale(
        row.basePerNight,
        row.factors[key] ?? '',
        grid?.nights ?? 0,
        batch.currencyCode,
        adjustments[row.id] ?? defaultAdjustment(),
      ),
    ),
  ) ?? false;

  return (
    <main className="mx-auto grid w-full max-w-7xl gap-6">
      <PageHeader
        eyebrow="فروش و ارتباط با مشتری · ماژول مدیریت قیمت"
        title="مدیریت قیمت و پکیج تور"
        description="قیمت خرید هتل‌های همان نوبت تور را ببینید، قیمت فروش هر گزینه هتل و پرواز را تنظیم کنید و نسخه قیمت را برای انتشار آماده کنید."
      />
      <div className="grid gap-3 md:grid-cols-3">
        {[
          ['۱', 'نوبت تور', 'هتل‌ها، تاریخ سفر و ظرفیت از تعریف بلیت'],
          ['۲', 'جدول خرید هتل', 'نرخ هر اتاق/شب و کارگزار از رزرواسیون'],
          ['۳', 'قیمت فروش و انتشار', 'افزایش/کاهش، پرواز، بیزینس و کمیسیون'],
        ].map(([number, title, description]) => (
          <Card className="flex items-start gap-3 p-4" key={number}>
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-sm font-black text-primary">
              {number}
            </span>
            <div>
              <h2 className="text-sm font-black">{title}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{description}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card className="grid gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black">۱ · نوبت تور</h2>
            <p className="text-sm text-muted-foreground">
              فقط نوبت‌های تور شعبه‌های مجاز شما نمایش داده می‌شوند.
            </p>
          </div>
          <Button
            aria-label="به‌روزرسانی نوبت‌های تور"
            disabled={loadingTours}
            onClick={() => void loadTours()}
            size="sm"
            variant="outline"
          >
            <RefreshCw className="size-4" />
            به‌روزرسانی
          </Button>
        </div>
        {loadingTours ? <Skeleton className="h-12" /> : null}
        {!loadingTours && error ? (
          <ErrorState title="نوبت‌های تور در دسترس نیست" description={error} />
        ) : null}
        {!loadingTours && !error && tours.length === 0 ? (
          <EmptyState
            title="نوبت توری برای قیمت‌گذاری پیدا نشد"
            description="ابتدا تور، هتل‌ها و نوبت پرواز را در مدیریت بلیت تعریف کنید."
            icon={Plane}
          />
        ) : null}
        {!loadingTours && !error && tours.length > 0 ? (
          <label className="grid max-w-2xl gap-2 text-sm font-bold">
            نوبت تور
            <select
              className="h-11 rounded-xl border border-input bg-surface px-3 text-sm"
              onChange={(event) => void selectTour(event.target.value)}
              value={tourId}
            >
              <option value="">انتخاب نوبت تور</option>
              {tours.map((tour) => (
                <option key={tour.id} value={tour.id}>
                  {tour.package.name} · {tour.startsOn} تا {tour.endsOn} · ظرفیت {tour.remainingCapacity}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {grid ? (
          <div className="flex flex-wrap gap-2">
            <Badge>{grid.tour.package.name}</Badge>
            <Badge>{grid.nights} شب</Badge>
            <Badge>{grid.tour.package.hotelIds.length} هتل تعریف‌شده</Badge>
            <Badge>ظرفیت {grid.tour.remainingCapacity}</Badge>
          </div>
        ) : null}
      </Card>

      <Card className="grid gap-4 p-5">
        <div className="flex items-center gap-2">
          <Hotel className="size-5 text-primary" />
          <h2 className="text-lg font-black">۲ · قیمت خرید هتل‌های تور</h2>
        </div>
        {!tourId ? (
          <p className="text-sm text-muted-foreground">
            نوبت تور را انتخاب کنید تا جدول خرید هتل‌های همان تور و بازه نمایش داده شود.
          </p>
        ) : null}
        {loadingCosts ? <Skeleton className="h-40" /> : null}
        {costError ? (
          <ErrorState title="جدول خرید در دسترس نیست" description={costError} />
        ) : null}
        {grid && grid.purchaseBatches.length === 0 ? (
          <EmptyState
            title="برای این تور نرخ خرید هتل ثبت نشده است"
            description="در رزرواسیون، نرخ خرید هتل‌های این تور را برای بازه اقامت ثبت کنید؛ قیمت پکیج بدون منبع خرید ساخته یا منتشر نمی‌شود."
            icon={Hotel}
          />
        ) : null}
        {grid && grid.purchaseBatches.length > 0 ? (
          <>
            <label className="grid max-w-2xl gap-2 text-sm font-bold">
              ثبت خرید / بازه
              <select
                className="h-11 rounded-xl border border-input bg-surface px-3 text-sm"
                onChange={(event) => {
                  setBatchId(event.target.value);
                  setAdjustments({});
                }}
                value={batchId}
              >
                {grid.purchaseBatches.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.checkIn} تا {item.checkOut} · {item.currencyCode} · {item.rows.length} هتل
                  </option>
                ))}
              </select>
            </label>
            {missingForBatch.length > 0 ? (
              <Alert
                title="نرخ خرید برخی هتل‌های تور در این ثبت موجود نیست"
                description={missingForBatch.length + ' هتل بدون نرخ خرید است؛ برای آن گزینه قیمت منتشر نمی‌شود.'}
              />
            ) : null}
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="min-w-[1120px] w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 text-xs text-muted-foreground">
                  <tr>
                    <th className="sticky right-0 bg-muted/95 p-3 text-right">هتل / کارگزار</th>
                    <th className="p-3 text-right">خرید پایه / شب</th>
                    {roomColumns.map(([key, title]) => (
                      <th className="p-3 text-right" key={key}>{title}<span className="block font-normal">خرید ← فروش / کل اقامت</span></th>
                    ))}
                    <th className="p-3 text-right">تغییر قیمت فروش</th>
                  </tr>
                </thead>
                <tbody>
                  {batch?.rows.map((row) => {
                    const adjustment =
                      adjustments[row.id] ?? defaultAdjustment();
                    return (
                      <tr className="border-t border-border" key={row.id}>
                        <td className="sticky right-0 bg-surface p-3">
                          <strong className="block">{row.hotelName}</strong>
                          <span className="text-xs text-muted-foreground">{row.brokerName}</span>
                        </td>
                        <td className="p-3 font-bold">{row.basePerNight} {batch.currencyCode}</td>
                        {roomColumns.map(([key]) => {
                          const preview = previewHotelRoomSale(
                            row.basePerNight,
                            row.factors[key] ?? '',
                            grid.nights,
                            batch.currencyCode,
                            adjustment,
                          );
                          return (
                            <td className="min-w-32 p-3 tabular-nums" key={key}>
                              <span className="block text-xs text-muted-foreground">× {row.factors[key] ?? '—'}</span>
                              <span className="block text-xs text-muted-foreground">{preview?.purchase ?? '—'}</span>
                              <strong className="block text-primary">{preview?.sale ?? '—'}</strong>
                            </td>
                          );
                        })}
                        <td className="min-w-64 p-3">
                          <div className="flex gap-1">
                            <select
                              aria-label={'جهت تغییر قیمت ' + row.hotelName}
                              className="h-9 rounded-lg border border-input bg-surface px-1"
                              onChange={(event) =>
                                setAdjustments((current) => ({
                                  ...current,
                                  [row.id]: {
                                    ...adjustment,
                                    direction: event.target.value as Adjustment['direction'],
                                  },
                                }))
                              }
                              value={adjustment.direction}
                            >
                              <option value="increase">افزایش</option>
                              <option value="decrease">کاهش</option>
                            </select>
                            <select
                              aria-label={'نوع تغییر قیمت ' + row.hotelName}
                              className="h-9 rounded-lg border border-input bg-surface px-1"
                              onChange={(event) =>
                                setAdjustments((current) => ({
                                  ...current,
                                  [row.id]: {
                                    ...adjustment,
                                    mode: event.target.value as Adjustment['mode'],
                                  },
                                }))
                              }
                              value={adjustment.mode}
                            >
                              <option value="percent">٪</option>
                              <option value="fixed">{batch.currencyCode}</option>
                            </select>
                            <Input
                              aria-label={'مقدار تغییر قیمت ' + row.hotelName}
                              className="h-9 min-w-20"
                              inputMode="decimal"
                              onChange={(event) =>
                                setAdjustments((current) => ({
                                  ...current,
                                  [row.id]: { ...adjustment, value: event.target.value },
                                }))
                              }
                              value={adjustment.value}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              قیمت خرید و ضرایب فقط‌خواندنی‌اند؛ پیش‌نمایش فروش هر اتاق برای کل {grid.nights} شب، با گردکردن نرخ هر شب و یک تغییر روی کل اقامت محاسبه می‌شود.
              گزینه‌های هتل مستقل‌اند و هزینه آن‌ها با هم جمع نمی‌شود.
            </p>
            {invalidSale ? (
              <Alert title="مقدار تغییر معتبر نیست" description="عدد نامعتبر یا کاهش بیشتر از قیمت خرید، قیمت فروش این ردیف را نامعتبر می‌کند." />
            ) : null}
          </>
        ) : null}
      </Card>

      <Card className="grid gap-4 p-5">
        <div className="flex items-center gap-2">
          <Banknote className="size-5 text-primary" />
          <h2 className="text-lg font-black">۳ · پرواز، بیزینس، کمیسیون و انتشار</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['قیمت فروش پرواز بزرگسال (' + (batch?.currencyCode ?? 'ارز پکیج') + ')', adultFlight, setAdultFlight],
            ['قیمت فروش پرواز کودک (' + (batch?.currencyCode ?? 'ارز پکیج') + ')', childFlight, setChildFlight],
            ['افزایش نرخ بیزینس (' + (batch?.currencyCode ?? 'ارز پکیج') + ')', businessIncrease, setBusinessIncrease],
            ['کمیسیون (٪)', commission, setCommission],
          ].map(([title, value, update]) => (
            <label className="grid gap-2 text-sm font-bold" key={title as string}>
              {title as string}
              <Input
                inputMode="decimal"
                onChange={(event) =>
                  (update as (value: string) => void)(event.target.value)
                }
                placeholder="0"
                value={value as string}
              />
            </label>
          ))}
        </div>
        <Alert
          title="نرخ خرید پرواز را مالی تأیید می‌کند"
          description="قیمت‌های پرواز این صفحه، قیمت فروش و در ارز انتخابی هتل‌اند؛ ارز متفاوت بدون نرخ تبدیل تأییدشده جمع نمی‌شود. نرخ خرید باید از درخواست بلیت و تأیید/پرداخت مالی برسد؛ تا آن اتصال موجود نباشد سود کل معتبر و انتشار قابل انجام نیست. کمیسیون درصدی از فروش به‌عنوان هزینه از سود کسر می‌شود و قیمت فروش را بالا نمی‌برد."
        />
        <Button disabled title="منتظر قرارداد عمومی نرخ خرید و پرداخت پرواز از مالی" type="button">
          <ClipboardCheck className="size-4" />
          انتشار پس از دریافت نرخ خرید تأییدشده از مالی
        </Button>
      </Card>
    </main>
  );
}
