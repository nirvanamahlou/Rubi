'use client';
import { NativeSearchSelect } from '@/components/ui/native-search-select';

import type {
  LoginResponse,
  PackageTourCostGridV1,
  PackageTourHotelPurchaseBatchV1,
  PackageTourDraftV1,
  PackageTourPublicationV1,
  TourDepartureV1,
  PackageTourPriceFieldV1,
} from '@nora/contracts';
import {
  ArrowRight,
  Banknote,
  ClipboardCheck,
  Hotel,
  Plane,
  RefreshCw,
} from 'lucide-react';
import Link from '@/i18n/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { MoneyInput } from '@/components/ui/money-input';
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
import { TourPriceFields } from './tour-price-fields';
import {
  tourPriceFields,
  tourPriceFieldValues,
  validateTourPriceFields,
} from '@nora/contracts';
import { TourWorkspace } from '@/modules/ticket-catalog/components/tour-workspace';
import { SourcePackageGenerator } from './source-package-generator';
import { packageGeneratorData } from '../model/package-generator-data';
import { packageBannerHref } from '../model/package-banner';
import { PackagePricingBreadcrumbs } from './package-pricing-breadcrumbs';
import {
  buildHotelPackageTable,
  type TourRoomCurrencyAmount,
} from '@nora/contracts';

const displayAmounts = (
  amounts: readonly TourRoomCurrencyAmount[],
  field: 'sale' | 'profit',
) =>
  amounts
    .filter((item) => item[field] !== null && Number(item[field]) !== 0)
    .map((item) => `${item[field]} ${item.currencyCode}`)
    .join(' + ') || '۰';

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
  const [tourPackageId, setTourPackageId] = useState('');
  const [tourId, setTourId] = useState('');
  const [grid, setGrid] = useState<PackageTourCostGridV1 | null>(null);
  const [batchId, setBatchId] = useState('');
  const [adjustments, setAdjustments] = useState<Record<string, Adjustment>>(
    {},
  );
  const [priceFields, setPriceFields] = useState<PackageTourPriceFieldV1[]>(
    () => tourPriceFields(),
  );
  const values = tourPriceFieldValues(priceFields);
  const adultFlight = values.adultFlightSale;
  const adultFlightCurrency = values.adultFlightSaleCurrencyCode;
  const childFlight = values.childFlightSale;
  const childFlightCurrency = values.childFlightSaleCurrencyCode;
  const businessIncrease = values.businessUplift;
  const businessCurrency = values.businessUpliftCurrencyCode;
  const commissionMode = values.commissionMode;
  const commission =
    commissionMode === 'fixed'
      ? values.commissionAmount
      : values.commissionPercent;
  const commissionCurrency = values.commissionCurrencyCode;
  const [selectedHotelRateIds, setSelectedHotelRateIds] = useState<string[]>(
    [],
  );
  const [showGenerator, setShowGenerator] = useState(false);
  const [familyAdults, setFamilyAdults] = useState('2');
  const [familyChildren, setFamilyChildren] = useState('0');
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
      const requested = new URL(globalThis.location.href).searchParams;
      const requestedDepartureId = requested.get('departure');
      const requestedDeparture = result.data.find(
        (item) => item.id === requestedDepartureId,
      );
      if (requestedDeparture) {
        setTourPackageId(requestedDeparture.package.id);
        await selectDeparture(
          requestedDeparture.id,
          currentSession,
          requested.get('batch') ?? undefined,
          requested.get('publication') ?? undefined,
        );
      }
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
    // The initial URL selection is restored once with the same authenticated
    // session used to load tours; later selections use the interactive handler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = globalThis.setTimeout(() => void loadTours(), 0);
    return () => globalThis.clearTimeout(timer);
  }, [loadTours]);

  function applyDraft(value: PackageTourDraftV1 | null) {
    setDraft(value);
    setSelectedHotelRateIds([...(value?.selectedHotelRateIds ?? [])]);
    setShowGenerator(false);
    setAdjustments(
      Object.fromEntries(
        (value?.adjustments ?? []).map((item) => [
          item.hotelRateId,
          { direction: item.direction, mode: item.mode, value: item.value },
        ]),
      ),
    );
    setPriceFields(tourPriceFields(value ?? {}));
    setFamilyAdults(String(value?.familyAdults ?? 2));
    setFamilyChildren(String(value?.familyChildren ?? 0));
  }

  async function loadDraft(
    tourDepartureId: string,
    purchaseBatchId: string,
    activeSession = session,
    requestedPublicationId?: string,
  ) {
    if (!activeSession || !purchaseBatchId) return;
    try {
      const [saved, versions] = await Promise.all([
        packagePricingApi.tourDraft(
          tourDepartureId,
          purchaseBatchId,
          activeSession,
        ),
        packagePricingApi.tourPublications(
          tourDepartureId,
          purchaseBatchId,
          activeSession,
        ),
      ]);
      applyDraft(saved);
      setPublications(versions);
      setPublicationId(
        versions.some((item) => item.id === requestedPublicationId)
          ? requestedPublicationId!
          : (versions[0]?.id ?? ''),
      );
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

  async function selectDeparture(
    id: string,
    activeSession = session,
    requestedBatchId?: string,
    requestedPublicationId?: string,
  ) {
    applyDraft(null);
    setTourId(id);
    setGrid(null);
    setBatchId('');
    setCostError('');
    setAdjustments({});
    setDraft(null);
    setPublications([]);
    setPublicationId('');
    setNotice('');
    if (!id || !activeSession) return;
    setLoadingCosts(true);
    try {
      const result = await packagePricingApi.tourCosts(id, activeSession);
      setGrid(result);
      const selectedBatchId = result.purchaseBatches.some(
        (item) => item.id === requestedBatchId,
      )
        ? requestedBatchId!
        : (result.purchaseBatches[0]?.id ?? '');
      setBatchId(selectedBatchId);
      if (selectedBatchId)
        await loadDraft(
          id,
          selectedBatchId,
          activeSession,
          requestedPublicationId,
        );
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
  const activeRoomColumns = useMemo(() => {
    const columns = new Map<string, string>();
    for (const row of batch?.rows ?? []) {
      if (!Object.values(row.factors).some(Boolean) && row.roomRates.length) {
        for (const room of row.roomRates)
          if (Number(room.factor) > 0)
            columns.set(room.roomTypeId, room.roomTypeName);
      } else {
        for (const [code, title] of roomColumns)
          if (row.factors[code]) columns.set(code, title);
      }
    }
    return [...columns.entries()];
  }, [batch]);
  const tablePrices = (
    row: PackageTourHotelPurchaseBatchV1['rows'][number],
  ) => {
    if (!batch || !grid) return [];
    try {
      return buildHotelPackageTable({
        row,
        checkIn: grid.tour.startsOn,
        checkOut: grid.tour.endsOn,
        currencyCode: batch.currencyCode,
        calculation: {
          extraSaleFields: priceFields.filter(
            (field) => field.kind === 'custom',
          ),
          adjustment: adjustments[row.id] ?? defaultAdjustment(),
          adultFlight: {
            amount: adultFlight || '0',
            currencyCode: adultFlightCurrency,
          },
          childFlight: {
            amount: childFlight || '0',
            currencyCode: childFlightCurrency,
          },
          businessUplift: {
            amount: businessIncrease || '0',
            currencyCode: businessCurrency,
          },
          businessCabin:
            grid.tour.outbound.cabinClassCode === 'BUSINESS' ||
            grid.tour.returning?.cabinClassCode === 'BUSINESS',
          commissionPercent:
            commissionMode === 'percent' ? commission || '0' : '0',
          commissionMode,
          commissionAmount: {
            amount: commissionMode === 'fixed' ? commission || '0' : '0',
            currencyCode: commissionCurrency,
          },
          flightCosts: grid.missingFlightOfferIds.length
            ? undefined
            : grid.flightPurchaseCosts,
        },
      });
    } catch {
      return [];
    }
  };
  const invalidFields = (() => {
    try {
      validateTourPriceFields(priceFields);
      return false;
    } catch {
      return true;
    }
  })();
  const invalidSale =
    invalidFields ||
    selectedHotelRateIds.some(
      (id) => !batch?.rows.some((row) => row.id === id),
    ) ||
    !!batch?.rows
      .filter((row) => selectedHotelRateIds.includes(row.id))
      .some((row) => tablePrices(row).length !== 3);
  const tableColumns = [
    ['single', 'سینگل · هر نفر'],
    ['double', 'دبل · هر نفر'],
    ['doubleChild', 'کودک با تخت'],
  ] as const;
  const publication =
    publications.find((item) => item.id === publicationId) ?? publications[0];
  const generatorData = useMemo(() => {
    if (!grid || !batch || !publication?.selectedHotelRateIds) return null;
    try {
      return packageGeneratorData(grid, batch, publication);
    } catch {
      return null;
    }
  }, [grid, batch, publication]);
  const bannerHref = (() => {
    if (!grid || !batch || !publication) return '';
    return packageBannerHref({
      packageId: grid.tour.id,
      tourPackageId: grid.tour.package.id,
      batchId: batch.id,
      publicationId: publication.id,
    });
  })();
  const unsaved =
    !draft ||
    JSON.stringify([...selectedHotelRateIds].sort()) !==
      JSON.stringify([...(draft.selectedHotelRateIds ?? [])].sort()) ||
    JSON.stringify(priceFields) !== JSON.stringify(tourPriceFields(draft)) ||
    Number(familyAdults) !== draft.familyAdults ||
    Number(familyChildren) !== draft.familyChildren ||
    adultFlight !== draft.adultFlightSale ||
    adultFlightCurrency !== draft.adultFlightSaleCurrencyCode ||
    childFlight !== draft.childFlightSale ||
    childFlightCurrency !== draft.childFlightSaleCurrencyCode ||
    businessIncrease !== draft.businessUplift ||
    businessCurrency !== draft.businessUpliftCurrencyCode ||
    commissionMode !== (draft.commissionMode ?? 'percent') ||
    commission !==
      (commissionMode === 'fixed'
        ? (draft.commissionAmount ?? '0')
        : draft.commissionPercent) ||
    (commissionMode === 'fixed' &&
      commissionCurrency !==
        (draft.commissionCurrencyCode ?? draft.currencyCode)) ||
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
          priceFields,
          selectedHotelRateIds,
          tourDepartureId: grid.tour.id,
          batchId: batch.id,
          currencyCode: batch.currencyCode,
          adultFlightSale: adultFlight || '0',
          adultFlightSaleCurrencyCode: adultFlightCurrency,
          childFlightSale: childFlight || '0',
          childFlightSaleCurrencyCode: childFlightCurrency,
          businessUplift: businessIncrease || '0',
          businessUpliftCurrencyCode: businessCurrency,
          commissionPercent:
            commissionMode === 'percent' ? commission || '0' : '0',
          commissionMode,
          commissionAmount:
            commissionMode === 'fixed' ? commission || '0' : '0',
          commissionCurrencyCode: commissionCurrency,
          familyAdults: Number(familyAdults),
          familyChildren: Number(familyChildren),
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
      applyDraft(saved);
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
      <PackagePricingBreadcrumbs
        currentTitle="مدیریت قیمت"
        pathname="/sales/pricing/management"
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
        eyebrow="فروش و ارتباط با مشتری · ماژول مدیریت قیمت"
        title="مدیریت پکیج تور"
        description="قیمت خرید هتل‌های همان نوبت تور را ببینید، قیمت فروش هر گزینه هتل و پرواز را تنظیم کنید و نسخه قیمت را برای انتشار آماده کنید."
      />
      {notice ? <Alert title="وضعیت قیمت‌گذاری" description={notice} /> : null}
      <TourWorkspace mode="departures" compact />

      <Card className="grid gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black">۱ · انتخاب تور و نوبت</h2>
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
            description="ابتدا تعریف تور و خدمات را در مدیریت بلیت ثبت کنید، سپس نوبت و بلیت‌های آن را در همین صفحه بسازید."
            icon={Plane}
          />
        ) : null}
        {!loadingTours && !error && tours.length > 0 ? (
          <div className="grid max-w-4xl gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold">
              تور
              <NativeSearchSelect
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
              </NativeSearchSelect>
            </label>
            <label className="grid gap-2 text-sm font-bold">
              نوبت تور
              <NativeSearchSelect
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
              </NativeSearchSelect>
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
            title="برای مقصد و تاریخ این سفر نرخ هتل پیدا نشد"
            description="در رزرواسیون، نرخ هتل‌های شهر مقصد را برای بازهٔ اقامت ثبت کنید؛ قیمت پکیج بدون منبع خرید ساخته یا منتشر نمی‌شود."
            icon={Hotel}
          />
        ) : null}
        {grid && batch && grid.purchaseBatches.length > 0 ? (
          <>
            <label className="grid max-w-2xl gap-2 text-sm font-bold">
              ثبت خرید / بازه
              <NativeSearchSelect
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
              </NativeSearchSelect>
            </label>
            <Badge>
              {grid.nights} شب اقامت · {selectedHotelRateIds.length} هتل منتخب
              این نوبت
            </Badge>
            <div className="flex flex-wrap gap-3">
              {batch.rows.map((row) => (
                <label
                  key={row.id}
                  className="flex items-center gap-2 rounded-xl border border-border p-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedHotelRateIds.includes(row.id)}
                    onChange={(event) =>
                      setSelectedHotelRateIds((current) =>
                        event.target.checked
                          ? [...current, row.id]
                          : current.filter((id) => id !== row.id),
                      )
                    }
                  />
                  {row.hotelName} · {row.brokerName}
                </label>
              ))}
            </div>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[800px] text-sm">
                <thead className="bg-muted/80">
                  <tr>
                    <th className="p-3 text-right">هتل / کارگزار</th>
                    {tableColumns.map(([code, title]) => (
                      <th className="p-3 text-right" key={code}>
                        {title}
                      </th>
                    ))}
                    <th className="p-3 text-right">تغییر قیمت هتل</th>
                  </tr>
                </thead>
                <tbody>
                  {batch.rows
                    .filter((row) => selectedHotelRateIds.includes(row.id))
                    .map((row) => {
                      const adjustment =
                        adjustments[row.id] ?? defaultAdjustment();
                      const prices = tablePrices(row);
                      return (
                        <tr key={row.id} className="border-t border-border">
                          <td className="p-3">
                            <strong className="block">{row.hotelName}</strong>
                            <span className="text-xs text-muted-foreground">
                              {row.brokerName}
                            </span>
                          </td>
                          {tableColumns.map(([code]) => {
                            const price = prices.find(
                              (item) => item.roomCode === code,
                            );
                            return (
                              <td className="p-3" key={code}>
                                {price ? (
                                  <>
                                    <strong className="block text-primary">
                                      {displayAmounts(
                                        price.currencyAmounts,
                                        'sale',
                                      )}
                                    </strong>
                                    <span className="block text-xs text-muted-foreground">
                                      {price.roomTypeName} · {price.board}
                                    </span>
                                    {price.childAgeMin === undefined ? null : (
                                      <span className="text-xs">
                                        {price.childAgeMin}–
                                        {price.childAgeMaxExclusive} سال
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-muted-foreground">
                                    تعرفه کامل موجود نیست
                                  </span>
                                )}
                              </td>
                            );
                          })}
                          <td className="min-w-64 p-3">
                            <div className="flex gap-1">
                              <NativeSearchSelect
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
                              </NativeSearchSelect>
                              <NativeSearchSelect
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
                                  {row.currencyCode ?? batch.currencyCode}
                                </option>
                              </NativeSearchSelect>
                              {adjustment.mode === 'fixed' ? (
                                <MoneyInput
                                  aria-label={
                                    'مقدار تغییر قیمت ' + row.hotelName
                                  }
                                  className="h-9 min-w-20"
                                  onValueChange={(value) =>
                                    setAdjustments((current) => ({
                                      ...current,
                                      [row.id]: { ...adjustment, value },
                                    }))
                                  }
                                  value={adjustment.value}
                                />
                              ) : (
                                <Input
                                  aria-label={
                                    'درصد تغییر قیمت ' + row.hotelName
                                  }
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
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            {invalidSale && !invalidFields ? (
              <Alert title="قیمت فروش معتبر نیست." />
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
          <h2 className="text-lg font-black">قیمت فروش و انتشار</h2>
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
        <TourPriceFields
          value={priceFields}
          onChange={setPriceFields}
          disabled={saving}
        />
        {invalidFields ? <Alert title="ردیف‌های قیمت معتبر نیستند." /> : null}
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
              invalidSale ||
              !selectedHotelRateIds.length ||
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-black">قیمت‌های منتشرشدهٔ همین بازه</h2>
            {publication?.selectedHotelRateIds ? null : bannerHref &&
              session?.user.permissions.includes('package_pricing.read') &&
              session.user.permissions.includes('package_pricing.render') ? (
              <Link
                className="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground"
                href={bannerHref}
              >
                ساخت بنر
              </Link>
            ) : (
              <Button disabled type="button">
                ساخت بنر · بدون مجوز
              </Button>
            )}
          </div>
          <label className="grid max-w-xl gap-2 text-sm font-bold">
            نسخهٔ قیمت
            <NativeSearchSelect
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
            </NativeSearchSelect>
          </label>
          {publication ? (
            <>
              <div className="flex flex-wrap gap-2 text-xs">
                {tourPriceFields(publication).map((field) => (
                  <Badge key={field.id}>
                    {field.title} {field.amount}{' '}
                    {field.mode === 'percent' ? '٪' : field.currencyCode}
                  </Badge>
                ))}
              </div>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="min-w-[900px] w-full text-sm">
                  <thead className="bg-muted/80 text-xs">
                    <tr>
                      <th className="p-3 text-right">گزینهٔ هتل</th>
                      {(publication.selectedHotelRateIds
                        ? tableColumns
                        : activeRoomColumns
                      ).map(([code, title]) => (
                        <th key={code} className="p-3 text-right">
                          {title}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {batch.rows
                      .filter(
                        (row) =>
                          !publication.selectedHotelRateIds ||
                          publication.selectedHotelRateIds.includes(row.id),
                      )
                      .map((row) => (
                        <tr key={row.id} className="border-t border-border">
                          <td className="p-3 font-bold">
                            {row.hotelName} · {row.brokerName}
                          </td>
                          {(publication.selectedHotelRateIds
                            ? tableColumns
                            : activeRoomColumns
                          ).map(([code]) => {
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
                                      {price.currencyAmounts
                                        ? displayAmounts(
                                            price.currencyAmounts,
                                            'sale',
                                          )
                                        : `${price.packageSale ?? price.hotelSale} ${price.currencyCode}`}
                                    </strong>
                                    <span className="block text-xs text-muted-foreground">
                                      {publication.selectedHotelRateIds
                                        ? `${price.roomTypeName ?? ''} · ${price.board ?? ''}`
                                        : price.currencyAmounts ||
                                            price.packageSale
                                          ? 'پکیج کامل'
                                          : 'فقط اقامت؛ ترکیب خانواده نامعلوم'}
                                    </span>
                                    {price.currencyAmounts ||
                                    price.netProfit ? (
                                      <span className="block text-xs text-muted-foreground">
                                        سود پس از کمیسیون:{' '}
                                        {price.currencyAmounts
                                          ? displayAmounts(
                                              price.currencyAmounts,
                                              'profit',
                                            )
                                          : price.netProfit}
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
              {publication.selectedHotelRateIds &&
              grid &&
              session?.user.permissions.includes('package_pricing.render') ? (
                <>
                  <Button
                    disabled={!generatorData}
                    type="button"
                    variant="outline"
                    onClick={() => setShowGenerator((current) => !current)}
                  >
                    خروجی با پک‌جنریتور
                  </Button>
                  {showGenerator && generatorData ? (
                    <SourcePackageGenerator importData={generatorData} />
                  ) : null}
                </>
              ) : null}
            </>
          ) : null}
        </Card>
      ) : null}
    </main>
  );
}
