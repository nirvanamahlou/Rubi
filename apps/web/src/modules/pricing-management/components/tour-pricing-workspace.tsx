'use client';

import type {
  LoginResponse,
  PackageTourCostGridV1,
  PackageTourHotelPurchaseBatchV1,
  PackageTourDraftV1,
  PackageTourPublicationV1,
  TourDepartureV1,
} from '@nora/contracts';
import {
  Banknote,
  ClipboardCheck,
  Hotel,
  Plane,
  RefreshCw,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
const currencyOptions = ['IRR', 'USD', 'EUR', 'AED', 'TRY'] as const;

export function TourPricingWorkspace() {
  const [session, setSession] = useState<LoginResponse | null>(null);
  const [tours, setTours] = useState<readonly TourDepartureV1[]>([]);
  const [tourPackageId, setTourPackageId] = useState('');
  const [tourId, setTourId] = useState('');
  const [grid, setGrid] = useState<PackageTourCostGridV1 | null>(null);
  const [batchId, setBatchId] = useState('');
  const [adjustments, setAdjustments] = useState<Record<string, Adjustment>>(
    {},
  );
  const [adultFlight, setAdultFlight] = useState('');
  const [adultFlightCurrency, setAdultFlightCurrency] = useState('IRR');
  const [childFlight, setChildFlight] = useState('');
  const [childFlightCurrency, setChildFlightCurrency] = useState('IRR');
  const [businessIncrease, setBusinessIncrease] = useState('');
  const [businessCurrency, setBusinessCurrency] = useState('IRR');
  const [commission, setCommission] = useState('');
  const [draft, setDraft] = useState<PackageTourDraftV1 | null>(null);
  const [publications, setPublications] = useState<
    readonly PackageTourPublicationV1[]
  >([]);
  const [publicationId, setPublicationId] = useState('');
  const [publishReason, setPublishReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
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

  function applyDraft(value: PackageTourDraftV1 | null) {
    setDraft(value);
    setAdjustments(
      Object.fromEntries(
        (value?.adjustments ?? []).map((item) => [
          item.hotelRateId,
          { direction: item.direction, mode: item.mode, value: item.value },
        ]),
      ),
    );
    setAdultFlight(value?.adultFlightSale ?? '');
    setAdultFlightCurrency(value?.adultFlightSaleCurrencyCode ?? 'IRR');
    setChildFlight(value?.childFlightSale ?? '');
    setChildFlightCurrency(value?.childFlightSaleCurrencyCode ?? 'IRR');
    setBusinessIncrease(value?.businessUplift ?? '');
    setBusinessCurrency(value?.businessUpliftCurrencyCode ?? 'IRR');
    setCommission(value?.commissionPercent ?? '');
  }

  async function loadDraft(tourDepartureId: string, purchaseBatchId: string) {
    if (!session || !purchaseBatchId) return;
    try {
      const [saved, versions] = await Promise.all([
        packagePricingApi.tourDraft(tourDepartureId, purchaseBatchId, session),
        packagePricingApi.tourPublications(
          tourDepartureId,
          purchaseBatchId,
          session,
        ),
      ]);
      applyDraft(saved);
      setPublications(versions);
      setPublicationId(versions[0]?.id ?? '');
      setNotice(
        saved
          ? 'پیش‌نویس قبلی این بازه بارگذاری شد.'
          : 'برای این بازه هنوز پیش‌نویسی ذخیره نشده است.',
      );
    } catch (cause) {
      setCostError(
        cause instanceof Error ? cause.message : 'بازیابی پیش‌نویس ناموفق بود.',
      );
    }
  }

  function selectTourPackage(id: string) {
    setTourPackageId(id);
    void selectDeparture('');
  }

  async function selectDeparture(id: string) {
    setTourId(id);
    setGrid(null);
    setBatchId('');
    setCostError('');
    setAdjustments({});
    setDraft(null);
    setPublications([]);
    setPublicationId('');
    setNotice('');
    if (!id || !session) return;
    setLoadingCosts(true);
    try {
      const result = await packagePricingApi.tourCosts(id, session);
      setGrid(result);
      const firstBatchId = result.purchaseBatches[0]?.id ?? '';
      setBatchId(firstBatchId);
      if (firstBatchId) await loadDraft(id, firstBatchId);
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

  const tourPackages = useMemo(
    () =>
      Array.from(
        new Map(tours.map((item) => [item.package.id, item.package])).values(),
      ),
    [tours],
  );
  const departuresForPackage = tours.filter(
    (item) => item.package.id === tourPackageId,
  );

  const batch: PackageTourHotelPurchaseBatchV1 | undefined =
    grid?.purchaseBatches.find((item) => item.id === batchId);
  const missingForBatch =
    grid?.tour.package.hotelIds.filter(
      (hotelId) => !batch?.rows.some((row) => row.hotelId === hotelId),
    ) ?? [];
  const invalidSale =
    batch?.rows.some((row) =>
      roomColumns.some(
        ([key]) =>
          !previewHotelRoomSale(
            row.basePerNight,
            row.factors[key] ?? '',
            grid?.nights ?? 0,
            batch.currencyCode,
            adjustments[row.id] ?? defaultAdjustment(),
          ),
      ),
    ) ?? false;
  const publication =
    publications.find((item) => item.id === publicationId) ?? publications[0];
  const unsaved =
    !draft ||
    adultFlight !== draft.adultFlightSale ||
    adultFlightCurrency !== draft.adultFlightSaleCurrencyCode ||
    childFlight !== draft.childFlightSale ||
    childFlightCurrency !== draft.childFlightSaleCurrencyCode ||
    businessIncrease !== draft.businessUplift ||
    businessCurrency !== draft.businessUpliftCurrencyCode ||
    commission !== draft.commissionPercent ||
    JSON.stringify(
      Object.entries(adjustments).sort(([a], [b]) => a.localeCompare(b)),
    ) !==
      JSON.stringify(
        draft.adjustments
          .map((item) => [
            item.hotelRateId,
            {
              direction: item.direction,
              mode: item.mode,
              value: item.value,
            },
          ])
          .sort(([a], [b]) => String(a).localeCompare(String(b))),
      );

  async function saveDraft() {
    if (!session || !grid || !batch || saving || invalidSale) return;
    setSaving(true);
    setCostError('');
    try {
      const saved = await packagePricingApi.saveTourDraft(
        {
          version: 1,
          expectedVersion: draft?.draftVersion ?? 0,
          tourDepartureId: grid.tour.id,
          batchId: batch.id,
          currencyCode: batch.currencyCode,
          adultFlightSale: adultFlight || '0',
          adultFlightSaleCurrencyCode: adultFlightCurrency,
          childFlightSale: childFlight || '0',
          childFlightSaleCurrencyCode: childFlightCurrency,
          businessUplift: businessIncrease || '0',
          businessUpliftCurrencyCode: businessCurrency,
          commissionPercent: commission || '0',
          adjustments: batch.rows
            .filter((row) => adjustments[row.id])
            .map((row) => {
              const value = adjustments[row.id]!;
              return {
                hotelRateId: row.id,
                direction: value.direction,
                mode: value.mode,
                value: value.value,
              };
            }),
        },
        session,
      );
      setDraft(saved);
      setNotice(
        'پیش‌نویس این بازه ذخیره شد؛ هر زمان می‌توانید دوباره ویرایش کنید.',
      );
    } catch (cause) {
      setCostError(
        cause instanceof Error ? cause.message : 'ذخیره پیش‌نویس ناموفق بود.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function publishDraft() {
    if (!session || !draft || saving || !publishReason.trim()) return;
    setSaving(true);
    setCostError('');
    try {
      const published = await packagePricingApi.publishTourDraft(
        draft.id,
        {
          version: 1,
          expectedDraftVersion: draft.draftVersion,
          reason: publishReason.trim(),
        },
        session,
      );
      setPublications((current) => [published, ...current]);
      setPublicationId(published.id);
      setPublishReason('');
      setNotice('نسخهٔ ' + published.priceVersion + ' قیمت پکیج منتشر شد.');
    } catch (cause) {
      setCostError(
        cause instanceof Error ? cause.message : 'انتشار قیمت پکیج ناموفق بود.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto grid w-full max-w-7xl gap-6">
      <PageHeader
        eyebrow="فروش و ارتباط با مشتری · ماژول مدیریت قیمت"
        title="مدیریت قیمت و پکیج تور"
        description="قیمت خرید هتل‌های همان نوبت تور را ببینید، قیمت فروش هر گزینه هتل و پرواز را تنظیم کنید و نسخه قیمت را برای انتشار آماده کنید."
      />
      {notice ? <Alert title="وضعیت قیمت‌گذاری" description={notice} /> : null}
      <div className="grid gap-3 md:grid-cols-4">
        {[
          ['۱', 'تور', 'ابتدا تور موردنظر را انتخاب کنید'],
          ['۲', 'نوبت تور', 'تاریخ سفر و ظرفیت از تعریف بلیت'],
          ['۳', 'جدول خرید هتل', 'نرخ هر اتاق/شب و کارگزار از رزرواسیون'],
          ['۴', 'قیمت فروش و انتشار', 'افزایش/کاهش، پرواز، بیزینس و کمیسیون'],
        ].map(([number, title, description]) => (
          <Card className="flex items-start gap-3 p-4" key={number}>
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-sm font-black text-primary">
              {number}
            </span>
            <div>
              <h2 className="text-sm font-black">{title}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {description}
              </p>
            </div>
          </Card>
        ))}
      </div>

      <Card className="grid gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black">۱ · انتخاب تور و نوبت</h2>
            <p className="text-sm text-muted-foreground">
              ابتدا تور را انتخاب کنید؛ سپس فقط نوبت‌های همان تور نمایش داده
              می‌شوند.
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
          <div className="grid max-w-4xl gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold">
              تور
              <select
                aria-label="انتخاب تور برای قیمت‌گذاری"
                className="h-11 rounded-xl border border-input bg-surface px-3 text-sm"
                onChange={(event) => selectTourPackage(event.target.value)}
                value={tourPackageId}
              >
                <option value="">انتخاب تور</option>
                {tourPackages.map((tourPackage) => (
                  <option key={tourPackage.id} value={tourPackage.id}>
                    {tourPackage.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold">
              نوبت تور
              <select
                aria-label="انتخاب نوبت تور برای قیمت‌گذاری"
                className="h-11 rounded-xl border border-input bg-surface px-3 text-sm"
                disabled={!tourPackageId}
                onChange={(event) => void selectDeparture(event.target.value)}
                value={tourId}
              >
                <option value="">
                  {tourPackageId
                    ? 'انتخاب نوبت تور'
                    : 'ابتدا تور را انتخاب کنید'}
                </option>
                {departuresForPackage.map((tour) => (
                  <option key={tour.id} value={tour.id}>
                    {tour.startsOn} تا {tour.endsOn} · ظرفیت{' '}
                    {tour.remainingCapacity}
                  </option>
                ))}
              </select>
            </label>
          </div>
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
          <h2 className="text-lg font-black">۳ · قیمت خرید هتل‌های تور</h2>
        </div>
        {!tourId ? (
          <p className="text-sm text-muted-foreground">
            نوبت تور را انتخاب کنید تا جدول خرید هتل‌های همان تور و بازه نمایش
            داده شود.
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
                  const id = event.target.value;
                  setBatchId(id);
                  applyDraft(null);
                  setPublications([]);
                  setPublicationId('');
                  setNotice('');
                  void loadDraft(tourId, id);
                }}
                value={batchId}
              >
                {grid.purchaseBatches.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.checkIn} تا {item.checkOut} · {item.currencyCode} ·{' '}
                    {item.rows.length} هتل
                  </option>
                ))}
              </select>
            </label>
            {missingForBatch.length > 0 ? (
              <Alert
                title="نرخ خرید برخی هتل‌های تور در این ثبت موجود نیست"
                description={
                  missingForBatch.length +
                  ' هتل بدون نرخ خرید است؛ برای آن گزینه قیمت منتشر نمی‌شود.'
                }
              />
            ) : null}
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="min-w-[1120px] w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 text-xs text-muted-foreground">
                  <tr>
                    <th className="sticky right-0 bg-muted/95 p-3 text-right">
                      هتل / کارگزار
                    </th>
                    <th className="p-3 text-right">خرید پایه / شب</th>
                    {roomColumns.map(([key, title]) => (
                      <th className="p-3 text-right" key={key}>
                        {title}
                        <span className="block font-normal">
                          خرید ← فروش / کل اقامت
                        </span>
                      </th>
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
                          <span className="text-xs text-muted-foreground">
                            {row.brokerName}
                          </span>
                        </td>
                        <td className="p-3 font-bold">
                          {row.basePerNight} {batch.currencyCode}
                        </td>
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
                              <span className="block text-xs text-muted-foreground">
                                × {row.factors[key] ?? '—'}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {preview?.purchase ?? '—'}
                              </span>
                              <strong className="block text-primary">
                                {preview?.sale ?? '—'}
                              </strong>
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
                                    direction: event.target
                                      .value as Adjustment['direction'],
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
                                    mode: event.target
                                      .value as Adjustment['mode'],
                                  },
                                }))
                              }
                              value={adjustment.mode}
                            >
                              <option value="percent">٪</option>
                              <option value="fixed">
                                {batch.currencyCode}
                              </option>
                            </select>
                            <Input
                              aria-label={'مقدار تغییر قیمت ' + row.hotelName}
                              className="h-9 min-w-20"
                              inputMode="decimal"
                              onChange={(event) =>
                                setAdjustments((current) => ({
                                  ...current,
                                  [row.id]: {
                                    ...adjustment,
                                    value: event.target.value,
                                  },
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
              قیمت خرید و ضرایب فقط‌خواندنی‌اند؛ پیش‌نمایش فروش هر اتاق برای کل{' '}
              {grid.nights} شب، با گردکردن نرخ هر شب و یک تغییر روی کل اقامت
              محاسبه می‌شود. گزینه‌های هتل مستقل‌اند و هزینه آن‌ها با هم جمع
              نمی‌شود.
            </p>
            {invalidSale ? (
              <Alert
                title="مقدار تغییر معتبر نیست"
                description="عدد نامعتبر یا کاهش بیشتر از قیمت خرید، قیمت فروش این ردیف را نامعتبر می‌کند."
              />
            ) : null}
            {draft ? (
              <Badge>پیش‌نویس ذخیره‌شده · نسخه {draft.draftVersion}</Badge>
            ) : null}
          </>
        ) : null}
      </Card>

      <Card className="grid gap-4 p-5">
        <div className="flex items-center gap-2">
          <Banknote className="size-5 text-primary" />
          <h2 className="text-lg font-black">
            ۴ · پرواز، بیزینس، کمیسیون و انتشار
          </h2>
        </div>
        {grid ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [grid.tour.outbound, grid.tour.returning].filter(
                Boolean,
              ) as (typeof grid.tour.outbound)[]
            ).map((offer) => {
              const cost = grid.flightPurchaseCosts.find(
                (item) =>
                  item.offerId === offer.id &&
                  item.offerVersion === offer.version,
              );
              return (
                <div
                  className="rounded-xl border border-border p-3 text-sm"
                  key={offer.id}
                >
                  <strong className="block">
                    {offer.carrierName} · {offer.serviceNumber}
                  </strong>
                  {cost ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      خرید پرداخت‌شده: بزرگسال {cost.adultUnitCost} · کودک{' '}
                      {cost.childUnitCost} {cost.currencyCode}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-destructive">
                      قیمت خرید و پرداخت این پرواز هنوز در مالی کامل نشده است.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-2 text-sm font-bold">
            قیمت فروش پرواز بزرگسال
            <div className="flex gap-2">
              <Input
                className="min-w-0 flex-1"
                inputMode="decimal"
                onChange={(event) => setAdultFlight(event.target.value)}
                placeholder="0"
                value={adultFlight}
              />
              <select
                aria-label="ارز قیمت فروش پرواز بزرگسال"
                className="h-11 rounded-xl border border-input bg-surface px-3"
                value={adultFlightCurrency}
                onChange={(event) => setAdultFlightCurrency(event.target.value)}
              >
                {currencyOptions.map((code) => (
                  <option key={code}>{code}</option>
                ))}
              </select>
            </div>
          </label>
          <label className="grid gap-2 text-sm font-bold">
            قیمت فروش پرواز کودک
            <div className="flex gap-2">
              <Input
                className="min-w-0 flex-1"
                inputMode="decimal"
                onChange={(event) => setChildFlight(event.target.value)}
                placeholder="0"
                value={childFlight}
              />
              <select
                aria-label="ارز قیمت فروش پرواز کودک"
                className="h-11 rounded-xl border border-input bg-surface px-3"
                value={childFlightCurrency}
                onChange={(event) => setChildFlightCurrency(event.target.value)}
              >
                {currencyOptions.map((code) => (
                  <option key={code}>{code}</option>
                ))}
              </select>
            </div>
          </label>
          <label className="grid gap-2 text-sm font-bold">
            افزایش نرخ بیزینس
            <div className="flex gap-2">
              <Input
                className="min-w-0 flex-1"
                inputMode="decimal"
                onChange={(event) => setBusinessIncrease(event.target.value)}
                placeholder="0"
                value={businessIncrease}
              />
              <select
                aria-label="ارز افزایش نرخ بیزینس"
                className="h-11 rounded-xl border border-input bg-surface px-3"
                value={businessCurrency}
                onChange={(event) => setBusinessCurrency(event.target.value)}
              >
                {currencyOptions.map((code) => (
                  <option key={code}>{code}</option>
                ))}
              </select>
            </div>
          </label>
          <label className="grid gap-2 text-sm font-bold">
            کمیسیون (٪)
            <Input
              inputMode="decimal"
              onChange={(event) => setCommission(event.target.value)}
              placeholder="0"
              value={commission}
            />
          </label>
        </div>
        <Alert
          title="مبنای انتشار قیمت پکیج"
          description="قیمت‌های پرواز این صفحه قیمت فروش‌اند. فقط نرخ خرید پرداخت‌شدهٔ همان پرواز در مالی مبنای سود است؛ ارز خرید هتل و پرواز باید یکسان باشد. کمیسیون از سود کسر می‌شود و قیمت فروش را تغییر نمی‌دهد. ابتدا پیش‌نویس را ذخیره کنید؛ انتشار با کاربر دیگری که مجوز انتشار دارد انجام می‌شود."
        />
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!batch || !grid || invalidSale || saving}
            onClick={() => void saveDraft()}
            type="button"
          >
            <ClipboardCheck className="size-4" />
            {saving
              ? 'در حال ثبت…'
              : draft
                ? 'ذخیره تغییرات پیش‌نویس'
                : 'ذخیره پیش‌نویس این بازه'}
          </Button>
          <Button
            disabled={
              saving ||
              unsaved ||
              !draft ||
              !publishReason.trim() ||
              draft.lastEditorUserId === session?.user.id ||
              !!grid?.missingFlightOfferIds.length ||
              missingForBatch.length > 0 ||
              !grid?.tour.remainingCapacity
            }
            onClick={() => void publishDraft()}
            type="button"
            variant="outline"
          >
            انتشار نسخهٔ قیمت پکیج
          </Button>
        </div>
        {draft && session && draft.lastEditorUserId === session.user.id ? (
          <p className="text-xs text-muted-foreground">
            این پیش‌نویس را شما ویرایش کرده‌اید؛ تأییدکنندهٔ دیگری با مجوز
            انتشار باید نسخهٔ قیمت را منتشر کند.
          </p>
        ) : null}
        {draft ? (
          <label className="grid max-w-2xl gap-2 text-sm font-bold">
            دلیل انتشار نسخهٔ قیمت
            <Input
              maxLength={500}
              value={publishReason}
              onChange={(event) => setPublishReason(event.target.value)}
            />
          </label>
        ) : null}
      </Card>
      {publications.length > 0 && batch ? (
        <Card className="grid gap-4 p-5">
          <h2 className="text-lg font-black">قیمت‌های منتشرشدهٔ همین بازه</h2>
          <label className="grid max-w-xl gap-2 text-sm font-bold">
            نسخهٔ قیمت
            <select
              className="h-11 rounded-xl border border-input bg-surface px-3"
              value={publication?.id ?? ''}
              onChange={(event) => setPublicationId(event.target.value)}
            >
              {publications.map((item) => (
                <option key={item.id} value={item.id}>
                  نسخه {item.priceVersion} ·{' '}
                  {new Date(item.publishedAt).toLocaleString('fa-IR')}
                </option>
              ))}
            </select>
          </label>
          {publication ? (
            <>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge>
                  پرواز بزرگسال {publication.adultFlightSale}{' '}
                  {publication.adultFlightSaleCurrencyCode}
                </Badge>
                <Badge>
                  پرواز کودک {publication.childFlightSale}{' '}
                  {publication.childFlightSaleCurrencyCode}
                </Badge>
                <Badge>
                  افزایش بیزینس {publication.businessUplift}{' '}
                  {publication.businessUpliftCurrencyCode}
                </Badge>
                <Badge>
                  کمیسیون هزینهٔ سود {publication.commissionPercent}٪
                </Badge>
              </div>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="min-w-[900px] w-full text-sm">
                  <thead className="bg-muted/80 text-xs">
                    <tr>
                      <th className="p-3 text-right">گزینهٔ هتل</th>
                      {roomColumns.map(([code, title]) => (
                        <th key={code} className="p-3 text-right">
                          {title}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {batch.rows.map((row) => (
                      <tr key={row.id} className="border-t border-border">
                        <td className="p-3 font-bold">
                          {row.hotelName} · {row.brokerName}
                        </td>
                        {roomColumns.map(([code]) => {
                          const price = publication.roomPrices.find(
                            (item) =>
                              item.hotelRateId === row.id &&
                              item.roomCode === code,
                          );
                          return (
                            <td
                              key={code}
                              className="p-3 tabular-nums text-primary"
                            >
                              {price ? (
                                <>
                                  <strong className="block">
                                    {price.packageSale ?? price.hotelSale}{' '}
                                    {price.currencyCode}
                                  </strong>
                                  <span className="block text-xs text-muted-foreground">
                                    {price.packageSale
                                      ? 'پکیج کامل'
                                      : 'فقط اقامت؛ ترکیب خانواده نامعلوم'}
                                  </span>
                                  {price.netProfit ? (
                                    <span className="block text-xs text-muted-foreground">
                                      سود خالص پس از کمیسیون: {price.netProfit}
                                    </span>
                                  ) : null}
                                </>
                              ) : (
                                '—'
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                قیمت پکیج برای اتاق یک‌تخته، دوتخته، سه‌تخته و گزینه‌های کودک با
                تعداد مسافران متناظر محاسبه شده است. افزایش بیزینس برای هر
                بزرگسال فقط در نوبت پرواز بیزینس اعمال می‌شود. ترکیب مسافر اتاق
                خانوادگی مشخص نیست، پس آن ستون فقط قیمت اقامت را نشان می‌دهد.
                کمیسیون از سود کسر شده و قیمت فروش را تغییر نمی‌دهد؛ هتل‌ها با
                هم جمع نمی‌شوند.
              </p>
            </>
          ) : null}
        </Card>
      ) : null}
    </main>
  );
}
