'use client';
import { useEffect, useRef, useState } from 'react';
import {
  moneyUnits,
  type ReservationIntakeV1,
  type ReservationServicePurchaseV1,
  type TravelWorkflowStateV1,
} from '@rubi/contracts';
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
  request: ReservationIntakeV1;
  service: ReservationIntakeV1['snapshot']['serviceSelections'][number];
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
  const [code, setCode] = useState(
    purchase?.currencyCode ?? service.pricing?.[0]?.currencyCode ?? 'IRR',
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  async function save() {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      if (!supplier) throw new Error('کارگزار این خدمت را انتخاب کنید.');
      if (moneyUnits(amount) <= 0n)
        throw new Error('مبلغ خرید باید مثبت باشد.');
      const base = getPublicApiBaseUrl();
      if (!base) throw new Error('نشانی سرور تنظیم نشده است.');
      const payload = JSON.stringify({
        version: 1,
        expectedVersion: request.purchaseVersion ?? 0,
        serviceClientKey: service.clientKey,
        supplierOrganizationId: supplier.id,
        amount,
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
      <fieldset disabled={busy} className="grid gap-3 md:grid-cols-4">
        <FormField label="کارگزار خدمت">
          <Lookup
            kind="organizations"
            label="کارگزار"
            value={supplier}
            onChange={setSupplier}
          />
        </FormField>
        <FormField label="مبلغ خرید">
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
        <Button
          type="button"
          className="self-end"
          disabled={busy || !supplier || !amount}
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
  return (
    <div className="mt-4 space-y-4 rounded-xl border bg-muted/20 p-4">
      <div>
        <h3 className="font-bold">خرید خدمات و ارسال به مالی</h3>
        <p className="text-xs text-muted-foreground">
          برای هر خدمت، کارگزار و مبلغ خرید را جدا ثبت کنید. اصلاح خرید یک نسخه
          تازه می‌سازد و تا پرداخت نسخه تازه، تحویل مدارک به فروش بسته می‌ماند.
        </p>
      </div>
      <SupplierFormPurchaseContext request={request} />
      {request.snapshot.serviceSelections.map((service) => (
        <ServicePurchaseCard
          key={service.clientKey}
          request={request}
          service={service}
          purchase={request.servicePurchases?.find(
            (item) => item.serviceClientKey === service.clientKey,
          )}
          onSaved={onSaved}
        />
      ))}
      {!request.snapshot.serviceSelections.length && (
        <p>برای این قرارداد خدمتی ثبت نشده است.</p>
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
