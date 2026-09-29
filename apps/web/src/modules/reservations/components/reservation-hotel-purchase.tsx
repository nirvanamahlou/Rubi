'use client';
import { useEffect, useRef, useState } from 'react';
import {
  hotelNights,
  moneyDecimal,
  moneyUnits,
  type ReservationIntakeV1,
  type ReservationServicePurchaseV1,
  type TravelWorkflowStateV1,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { FormField, Input } from '@/components/ui/form-controls';
import { MoneyInput, formatSalesMoney } from '@/components/ui/money-input';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import {
  Lookup,
  type Option,
} from '@/modules/reservations/hotel-rates/controls';
import { travelRequest } from './travel-workflow-form';

const financeLabel = (purchase?: ReservationServicePurchaseV1) => {
  if (!purchase) return 'خرید ثبت نشده';
  if (purchase.finance.status === 'PAID') return 'پرداخت مالی انجام شده';
  if (purchase.finance.status === 'REJECTED') return 'برگشت‌خورده از مالی';
  return 'ارسال‌شده به مالی؛ در انتظار پرداخت';
};

type PurchaseRequest = ReservationIntakeV1 & {
  workflow?: TravelWorkflowStateV1 | null;
};

type PurchasableService =
  ReservationIntakeV1['snapshot']['serviceSelections'][number];

export const reservationPurchaseServices = (
  snapshot: ReservationIntakeV1['snapshot'],
): PurchasableService[] => {
  const services = snapshot.serviceSelections.filter(
    (service) => service.kind === 'HOTEL' || service.kind === 'TRANSFER',
  );
  const hotel = snapshot.hotelSelection;
  if (
    !hotel ||
    services.some((service) => service.clientKey === hotel.serviceClientKey)
  )
    return services;
  return [
    ...services,
    {
      clientKey: hotel.serviceClientKey,
      kind: 'HOTEL',
      titleSnapshot: hotel.hotelNameSnapshot,
    },
  ];
};
export function hotelPurchaseTotal(
  amount: string,
  basis: 'NIGHT' | 'TOTAL',
  checkIn: string,
  checkOut: string,
) {
  if (basis === 'TOTAL') return moneyDecimal(moneyUnits(amount));
  const total = moneyDecimal(
    moneyUnits(amount) * BigInt(hotelNights(checkIn, checkOut)),
  );
  moneyUnits(total);
  return total;
}

export function SupplierFormPurchaseContext({
  request,
}: {
  request: PurchaseRequest;
}) {
  const settings = request.workflow?.sentSupplierFormSettings;
  if (!settings)
    return (
      <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
        هنوز نسخه‌ای از فرم رزواسیون برای کارگزار ارسال نشده است؛ مبلغ خرید را
        پس از ارسال فرم ثبت کنید.
      </p>
    );
  const selected = settings.passengers.filter(
    (passenger) => passenger.selected,
  );
  return (
    <section className="grid gap-2 rounded-xl border border-primary/25 bg-primary/5 p-3 text-sm">
      <strong>مبنای قیمت خرید: آخرین فرم ارسال‌شده به کارگزار</strong>
      <p>
        اقامت: {settings.text.checkIn || '—'} تا {settings.text.checkOut || '—'}{' '}
        · نوع اتاق: {settings.text.roomType || '—'}
      </p>
      <p>
        SGL: {settings.numbers.singleRooms} · DBL:{' '}
        {settings.numbers.doubleRooms} · EXT: {settings.numbers.extraBeds} ·
        CUSTOM: {settings.numbers.customRooms}
      </p>
      <p>
        مسافران: {selected.length} · ADL:{' '}
        {selected.filter((passenger) => passenger.age === 'ADL').length} · CHD:{' '}
        {selected.filter((passenger) => passenger.age === 'CHD').length} · INF:{' '}
        {selected.filter((passenger) => passenger.age === 'INF').length}
      </p>
      <span className="text-xs text-muted-foreground">
        نسخهٔ ارسال‌شده {request.workflow?.sentSupplierFormVersion ?? '—'}؛ مبلغ
        خرید را طبق پاسخ همان کارگزار وارد کنید.
      </span>
    </section>
  );
}

function ServicePurchaseCard({
  request,
  service,
  purchase,
  onSaved,
}: {
  request: PurchaseRequest;
  service: PurchasableService;
  purchase: ReservationServicePurchaseV1 | undefined;
  onSaved: () => void;
}) {
  const [supplier, setSupplier] = useState<Option | null>(
    purchase
      ? {
          id: purchase.supplierOrganizationId,
          name: purchase.supplierName,
        }
      : null,
  );
  const [amount, setAmount] = useState(purchase?.amount ?? '');
  const [basis, setBasis] = useState<'NIGHT' | 'TOTAL'>('TOTAL');
  const [code, setCode] = useState(
    purchase?.currencyCode ?? service.pricing?.[0]?.currencyCode ?? 'IRR',
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  const hotel = service.kind === 'HOTEL';
  const checkIn =
    request.workflow?.sentSupplierFormSettings?.text.checkIn ||
    request.snapshot.hotelSelection?.checkInDate ||
    '';
  const checkOut =
    request.workflow?.sentSupplierFormSettings?.text.checkOut ||
    request.snapshot.hotelSelection?.checkOutDate ||
    '';
  let nights: number | null = null;
  try {
    if (hotel) nights = hotelNights(checkIn, checkOut);
  } catch {
    // A total can still be recorded when the stay dates are incomplete.
  }
  let totalPreview = '';
  try {
    if (hotel && amount && (basis === 'TOTAL' || nights))
      totalPreview = hotelPurchaseTotal(amount, basis, checkIn, checkOut);
  } catch {
    // The save action reports invalid amount or dates.
  }
  async function save() {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      if (!supplier) throw new Error('کارگزار این خدمت را انتخاب کنید.');
      const total = hotel
        ? hotelPurchaseTotal(amount, basis, checkIn, checkOut)
        : amount;
      if (moneyUnits(total) <= 0n) throw new Error('مبلغ خرید باید مثبت باشد.');
      const base = getPublicApiBaseUrl();
      if (!base) throw new Error('نشانی سرور تنظیم نشده است.');
      const payload = JSON.stringify({
        version: 1,
        expectedVersion: request.purchaseVersion ?? 0,
        serviceClientKey: service.clientKey,
        supplierOrganizationId: supplier.id,
        amount: total,
        currencyCode: code,
      });
      if (attempt.current?.payload !== payload)
        attempt.current = { payload, key: crypto.randomUUID() };
      const send = () =>
        fetch(
          `${base}/reservations/requests/${encodeURIComponent(request.id)}/service-purchases`,
          {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'Idempotency-Key': attempt.current!.key,
            },
            body: payload,
          },
        );
      let response = await send();
      if (response.status === 401 && (await refreshAuthenticatedSession(base)))
        response = await send();
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message ?? 'ثبت خرید خدمت ناموفق بود.');
      }
      setMessage('خرید این خدمت ثبت و برای پرداخت به مالی ارسال شد.');
      onSaved();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ثبت ناموفق بود.');
    } finally {
      setBusy(false);
    }
  }
  const statusClass =
    purchase?.finance.status === 'PAID'
      ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100'
      : purchase?.finance.status === 'REJECTED'
        ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-100'
        : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100';
  return (
    <article className="grid gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="font-bold">{service.titleSnapshot}</h4>
          <p className="text-xs text-muted-foreground">{service.kind}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass}`}
        >
          {financeLabel(purchase)}
        </span>
      </div>
      {purchase && (
        <p className="text-sm">
          آخرین خرید: {purchase.supplierName} ·{' '}
          {formatSalesMoney(purchase.amount)} {purchase.currencyCode}
        </p>
      )}
      <fieldset disabled={busy} className="grid min-w-0 gap-4">
        <FormField label="کارگزار خدمت">
          <Lookup
            kind="organizations"
            label="کارگزار"
            value={supplier}
            onChange={setSupplier}
          />
        </FormField>
        {hotel && (
          <fieldset className="flex flex-wrap gap-4 rounded-xl border border-border p-3">
            <legend className="px-1 text-sm font-semibold">
              روش ورود قیمت هتل
            </legend>
            {(['TOTAL', 'NIGHT'] as const).map((choice) => (
              <label key={choice} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={`hotel-price-${service.clientKey}`}
                  checked={basis === choice}
                  disabled={choice === 'NIGHT' && !nights}
                  onChange={() => {
                    setBasis(choice);
                    setAmount('');
                  }}
                />
                {choice === 'NIGHT' ? 'قیمت هر شب' : 'جمع کل اقامت'}
              </label>
            ))}
          </fieldset>
        )}
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <FormField
            label={hotel && basis === 'NIGHT' ? 'قیمت هر شب' : 'مبلغ خرید'}
          >
            <MoneyInput
              aria-label={`مبلغ خرید ${service.titleSnapshot}`}
              value={amount}
              onValueChange={setAmount}
            />
          </FormField>
          <FormField label="ارز خرید">
            <Input
              aria-label={`ارز خرید ${service.titleSnapshot}`}
              dir="ltr"
              maxLength={3}
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
            />
          </FormField>
        </div>
        {hotel && basis === 'NIGHT' && (
          <p className="text-sm text-muted-foreground">
            {nights
              ? `${nights} شب · جمع خرید: ${totalPreview ? formatSalesMoney(totalPreview) : 'مبلغ هر شب را وارد کنید'} ${code}`
              : 'تاریخ ورود و خروج هتل را تکمیل کنید.'}
          </p>
        )}
        <Button
          type="button"
          className="w-full sm:w-auto sm:justify-self-end"
          disabled={
            busy ||
            !supplier ||
            !amount ||
            (hotel && basis === 'NIGHT' && !nights)
          }
          onClick={() => void save()}
        >
          {busy
            ? 'در حال ارسال…'
            : purchase
              ? 'ثبت اصلاح و ارسال به مالی'
              : 'ثبت و ارسال به مالی'}
        </Button>
      </fieldset>
      <p role="status" className="text-sm">
        {message}
      </p>
    </article>
  );
}

export function ReservationHotelPurchase({
  request,
  onSaved,
}: {
  request: PurchaseRequest;
  onSaved: () => void;
}) {
  const services = reservationPurchaseServices(request.snapshot);
  const [selectedServiceKey, setSelectedServiceKey] = useState(
    services[0]?.clientKey ?? '',
  );
  const selectedService =
    services.find((service) => service.clientKey === selectedServiceKey) ??
    services[0];

  return (
    <div className="mt-4 space-y-4 rounded-xl border bg-muted/20 p-4">
      <div>
        <h3 className="font-bold">خرید خدمات و ارسال به مالی</h3>
        <p className="text-xs text-muted-foreground">
          ابتدا خدمت هتل یا ترانسفر را انتخاب کنید؛ سپس کارگزار، مبلغ و ارز خرید
          را ثبت کنید. هر ثبت، نسخهٔ خریدِ قابل پرداخت را به کارتابل مالی
          می‌فرستد.
        </p>
      </div>
      <SupplierFormPurchaseContext request={request} />
      {services.length ? (
        <>
          <FormField label="خدمت مورد خرید">
            <select
              className="h-11 w-full rounded-xl border border-input bg-surface px-3 text-sm"
              value={selectedService?.clientKey ?? ''}
              onChange={(event) => setSelectedServiceKey(event.target.value)}
            >
              {services.map((service) => (
                <option key={service.clientKey} value={service.clientKey}>
                  {service.kind === 'HOTEL' ? 'هتل' : 'ترانسفر'} ·{' '}
                  {service.titleSnapshot}
                </option>
              ))}
            </select>
          </FormField>
          {selectedService ? (
            <ServicePurchaseCard
              key={`${selectedService.clientKey}:${request.purchaseVersion ?? 0}`}
              request={request}
              service={selectedService}
              purchase={request.servicePurchases?.find(
                (item) => item.serviceClientKey === selectedService.clientKey,
              )}
              onSaved={onSaved}
            />
          ) : null}
        </>
      ) : (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
          در این قرارداد هتل یا ترانسفر ثبت نشده است. ابتدا خدمت را در قرارداد
          اضافه کنید؛ قیمت خرید بلیط هنگام تعریف بلیط برای مالی ثبت می‌شود.
        </p>
      )}
      {!!request.hotelPurchases?.length && (
        <details className="text-xs text-muted-foreground">
          <summary>سوابق قدیمی هزینه هتل</summary>
          {request.hotelPurchases.map((cost) => (
            <p key={cost.id}>
              {formatSalesMoney(cost.amount)} {cost.currencyCode} · نسخه{' '}
              {cost.version}
            </p>
          ))}
        </details>
      )}
    </div>
  );
}
export function ReservationPurchaseDialog({ id }: { id: string }) {
  const [request, setRequest] = useState<PurchaseRequest>();
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let live = true;
    void travelRequest<{ data: PurchaseRequest }>(
      `reservations/requests/${id}/purchase-context`,
    )
      .then((response) => {
        if (live) setRequest(response.data);
      })
      .catch((error: Error) => {
        if (live) setError(error.message);
      });
    return () => {
      live = false;
    };
  }, [id, refresh]);
  if (error) return <p role="alert">{error}</p>;
  return request ? (
    <ReservationHotelPurchase
      key={request.purchaseVersion}
      request={request}
      onSaved={() => setRefresh((value) => value + 1)}
    />
  ) : (
    <p>در حال دریافت اطلاعات خرید…</p>
  );
}
