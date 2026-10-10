'use client';
import { ReservationInsurancePurchase } from './reservation-insurance-purchase';

import { useEffect, useRef, useState } from 'react';
import {
  hotelNights,
  moneyDecimal,
  moneyUnits,
  reservationServicePurchaseTotal,
  type ReservationIntakeV1,
  type SalesPassengerAgeCategory,
  type TravelWorkflowStateV1,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-controls';
import { MoneyInput, formatSalesMoney } from '@/components/ui/money-input';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import {
  Lookup,
  type Option,
} from '@/modules/reservations/hotel-rates/controls';
import { travelRequest } from './travel-workflow-form';

type PurchaseRequest = ReservationIntakeV1 & {
  workflow?: TravelWorkflowStateV1 | null;
};
type PurchasableService =
  ReservationIntakeV1['snapshot']['serviceSelections'][number];
type Passenger = { id: string; name: string; age: SalesPassengerAgeCategory };

export const reservationPurchaseServices = (
  snapshot: ReservationIntakeV1['snapshot'],
): PurchasableService[] => {
  const services = snapshot.serviceSelections.filter(
    (service) => service.kind === 'HOTEL' || service.kind === 'TRANSFER',
  );
  const hotel = snapshot.hotelSelection;
  return !hotel ||
    services.some((service) => service.clientKey === hotel.serviceClientKey)
    ? services
    : [
        ...services,
        {
          clientKey: hotel.serviceClientKey,
          kind: 'HOTEL',
          titleSnapshot: hotel.hotelNameSnapshot,
        },
      ];
};

export const reservationHotelPassengers = (
  snapshot: ReservationIntakeV1['snapshot'],
  serviceClientKey: string,
): Passenger[] =>
  snapshot.passengerAssignments?.length
    ? snapshot.passengerAssignments
        .filter((passenger) =>
          passenger.serviceClientKeys.includes(serviceClientKey),
        )
        .map((passenger) => ({
          id: passenger.customerId,
          name: passenger.displayNameSnapshot || passenger.customerId,
          age: passenger.ageCategory,
        }))
    : snapshot.passengerIds.map((id) => ({ id, name: id, age: 'ADT' }));

export const reservationTransferPassengers = (
  snapshot: ReservationIntakeV1['snapshot'],
  serviceKeys: readonly string[],
): Passenger[] =>
  snapshot.passengerAssignments?.length
    ? snapshot.passengerAssignments
        .filter((passenger) =>
          passenger.serviceClientKeys.some((key) => serviceKeys.includes(key)),
        )
        .map((passenger) => ({
          id: passenger.customerId,
          name: passenger.displayNameSnapshot || passenger.customerId,
          age: passenger.ageCategory,
        }))
    : snapshot.passengerIds.map((id) => ({ id, name: id, age: 'ADT' }));

export function transferPurchaseTotal(price: string, count: string) {
  if (
    !/^\d+$/.test(count) ||
    !Number.isSafeInteger(Number(count)) ||
    Number(count) <= 0
  )
    throw new Error('تعداد نفرات باید عدد صحیح مثبت باشد.');
  return reservationServicePurchaseTotal(price, count, 1);
}

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
      <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        هنوز نسخه‌ای از فرم رزواسیون برای کارگزار ارسال نشده است؛ مبلغ خرید را
        پس از ارسال فرم ثبت کنید.
      </p>
    );
  const selected = settings.passengers.filter(
    (passenger) => passenger.selected,
  );
  return (
    <section className="grid gap-2 rounded-xl border border-primary/25 bg-primary/5 p-3 text-sm">
      <strong>مشخصات آخرین فرم ارسال‌شده به کارگزار</strong>
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

function totalOf(amounts: readonly string[]) {
  try {
    return moneyDecimal(
      amounts.reduce((sum, amount) => sum + moneyUnits(amount), 0n),
    );
  } catch {
    return '';
  }
}

export function latestTransferPurchase(
  request: PurchaseRequest,
  keys: readonly string[],
) {
  const purchases = [...(request.servicePurchases ?? [])].sort(
    (a, b) => b.version - a.version,
  );
  const covers = (
    purchase: NonNullable<PurchaseRequest['servicePurchases']>[number],
  ) =>
    purchase.coveredServiceClientKeys?.length
      ? purchase.coveredServiceClientKeys
      : [purchase.serviceClientKey];
  const latest = keys.map((key) =>
    purchases.find((purchase) => covers(purchase).includes(key)),
  );
  const purchase = latest[0];
  return purchase &&
    latest.every((p) => p === purchase) &&
    covers(purchase).length === keys.length
    ? purchase
    : undefined;
}
export function ReservationHotelPurchase({
  request,
  onSaved,
}: {
  request: PurchaseRequest;
  onSaved: () => void;
}) {
  const services = reservationPurchaseServices(request.snapshot);
  const hotel = services.find((service) => service.kind === 'HOTEL');
  const transfers = services.filter((service) => service.kind === 'TRANSFER');
  const transferKeys = transfers.map((service) => service.clientKey);
  const hotelPurchase = request.servicePurchases?.find(
    (purchase) => purchase.serviceClientKey === hotel?.clientKey,
  );
  const [hotelSupplier, setHotelSupplier] = useState<Option | null>(
    hotelPurchase
      ? {
          id: hotelPurchase.supplierOrganizationId,
          name: hotelPurchase.supplierName,
        }
      : null,
  );
  const [hotelCurrency, setHotelCurrency] = useState<Option | null>(
    hotelPurchase
      ? { id: hotelPurchase.currencyCode, name: hotelPurchase.currencyCode }
      : null,
  );
  const [hotelBase, setHotelBase] = useState(
    hotelPurchase?.pricingCalculation?.baseAmount ?? '',
  );
  const [hotelFactor, setHotelFactor] = useState(
    hotelPurchase?.pricingCalculation?.factor ?? '1',
  );
  type TransferDraft = {
    supplier: Option | null;
    currency: Option | null;
    price: string;
    count: string;
  };
  const latestTransfer = (keys: string[]) =>
    latestTransferPurchase(request, keys);
  const initialTransfer = (keys: string[]): TransferDraft => {
    const purchase = latestTransfer(keys);
    return {
      supplier: purchase
        ? { id: purchase.supplierOrganizationId, name: purchase.supplierName }
        : null,
      currency: purchase
        ? { id: purchase.currencyCode, name: purchase.currencyCode }
        : null,
      price: purchase?.pricingCalculation?.baseAmount ?? '',
      count: String(
        purchase?.pricingCalculation?.chargeablePassengerCount ??
          reservationTransferPassengers(request.snapshot, keys).length,
      ),
    };
  };
  const [splitTransfers, setSplitTransfers] = useState(
    transfers.length > 1 &&
      !latestTransfer(transferKeys) &&
      transfers.every((service) =>
        Boolean(latestTransfer([service.clientKey])),
      ),
  );
  const [combinedTransfer, setCombinedTransfer] = useState(() =>
    initialTransfer(transferKeys),
  );
  const [separateTransfers, setSeparateTransfers] = useState(() =>
    transfers.map((service) => initialTransfer([service.clientKey])),
  );
  const transferRows = splitTransfers
    ? transfers.map((service, index) => ({
        keys: [service.clientKey],
        title: service.titleSnapshot,
        draft: separateTransfers[index]!,
      }))
    : [
        {
          keys: transferKeys,
          title:
            transfers.length > 1
              ? 'ترانسفر رفت‌وبرگشت'
              : (transfers[0]?.titleSnapshot ?? 'ترانسفر'),
          draft: combinedTransfer,
        },
      ];
  const changeTransfer = (index: number, patch: Partial<TransferDraft>) => {
    if (splitTransfers)
      setSeparateTransfers((rows) =>
        rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
      );
    else setCombinedTransfer((row) => ({ ...row, ...patch }));
  };
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  const checkIn = request.snapshot.hotelSelection?.checkInDate || '';
  const checkOut = request.snapshot.hotelSelection?.checkOutDate || '';
  let nights = 0;
  try {
    nights = hotelNights(checkIn, checkOut);
  } catch {
    /* Display invalid dates in form. */
  }
  let hotelTotal = '';

  try {
    hotelTotal = reservationServicePurchaseTotal(
      hotelBase,
      hotelFactor,
      nights,
    );
  } catch {
    /* Validated on save. */
  }
  const transferTotals = transferRows.map(({ draft }) => {
    try {
      return transferPurchaseTotal(draft.price, draft.count);
    } catch {
      return '';
    }
  });
  const totals = new Map<string, string[]>();
  if (hotel && hotelCurrency && hotelTotal)
    totals.set(hotelCurrency.id, [
      ...(totals.get(hotelCurrency.id) ?? []),
      hotelTotal,
    ]);
  if (transfers.length)
    transferRows.forEach(({ draft }, index) => {
      const total = transferTotals[index];
      if (draft.currency && total)
        totals.set(draft.currency.id, [
          ...(totals.get(draft.currency.id) ?? []),
          total,
        ]);
    });

  async function save() {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const purchases = [];
      if (hotel) {
        if (!hotelSupplier || !hotelCurrency || !nights || !hotelTotal)
          throw new Error(
            'کارگزار، ارز، قیمت پایه، ضریب و تاریخ اقامت قرارداد را تکمیل کنید.',
          );
        purchases.push({
          serviceClientKey: hotel.clientKey,
          coveredServiceClientKeys: [hotel.clientKey],
          supplierOrganizationId: hotelSupplier.id,
          amount: hotelTotal,
          currencyCode: hotelCurrency.id,
          pricingCalculation: { baseAmount: hotelBase, factor: hotelFactor },
        });
      }
      if (transfers.length) {
        transferRows.forEach(({ keys, draft }, index) => {
          const supplier =
            draft.supplier ?? (!splitTransfers ? hotelSupplier : null);
          if (!supplier)
            throw new Error('کارگزار هر مسیر ترانسفر را انتخاب کنید.');
          if (!draft.currency || !transferTotals[index])
            throw new Error(
              'ارز، قیمت هر نفر و تعداد نفرات محاسبه‌شونده ترانسفر را تکمیل کنید.',
            );
          purchases.push({
            serviceClientKey: keys[0]!,
            coveredServiceClientKeys: keys,
            supplierOrganizationId: supplier.id,
            amount: transferTotals[index]!,
            currencyCode: draft.currency.id,
            pricingCalculation: {
              baseAmount: draft.price,
              factor: draft.count,
              chargeablePassengerCount: Number(draft.count),
            },
          });
        });
      }
      if (
        !purchases.length ||
        purchases.some((purchase) => moneyUnits(purchase.amount) <= 0n)
      )
        throw new Error('مبلغ خرید باید مثبت باشد.');
      const base = getPublicApiBaseUrl();
      if (!base) throw new Error('نشانی سرور تنظیم نشده است.');
      const payload = JSON.stringify({
        version: 1,
        expectedVersion: request.purchaseVersion ?? 0,
        purchases,
      });
      if (attempt.current?.payload !== payload)
        attempt.current = { payload, key: crypto.randomUUID() };
      const send = () =>
        fetch(
          `${base}/reservations/requests/${encodeURIComponent(request.id)}/purchase-batches`,
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
        throw new Error(
          body?.message ?? 'ثبت درخواست خرید قرارداد ناموفق بود.',
        );
      }
      setMessage('درخواست خرید قرارداد همراه همهٔ ردیف‌ها به مالی ارسال شد.');
      onSaved();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ثبت ناموفق بود.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-4 rounded-xl border bg-muted/20 p-4">
      <div>
        <h3 className="font-bold">
          درخواست خرید قرارداد {request.snapshot.contractNumber}
        </h3>
        <p className="text-xs text-muted-foreground">
          هتل و ترانسفرهای این قرارداد با یک ثبت به مالی ارسال می‌شوند.
        </p>
      </div>
      {request.snapshot.serviceSelections
        .filter((service) => service.kind === 'INSURANCE')
        .map((service) => (
          <ReservationInsurancePurchase
            key={service.clientKey}
            request={request}
            serviceClientKey={service.clientKey}
            onSaved={onSaved}
          />
        ))}
      <SupplierFormPurchaseContext request={request} />
      {hotel ? (
        <section className="space-y-4 rounded-xl border border-border bg-surface p-4">
          <h4 className="font-bold">
            هتل:{' '}
            {request.snapshot.hotelSelection?.hotelNameSnapshot ||
              hotel.titleSnapshot}
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="کارگزار هتل">
              <Lookup
                kind="brokers"
                label="کارگزار هتل"
                value={hotelSupplier}
                onChange={setHotelSupplier}
              />
            </FormField>
            <FormField label="ارز خرید هتل">
              <Lookup
                kind="currencies"
                label="ارز خرید هتل"
                value={hotelCurrency}
                onChange={setHotelCurrency}
              />
            </FormField>
          </div>
          <p className="text-sm">
            تعداد شب اقامت: {nights || 'تاریخ اقامت معتبر نیست'}
          </p>
          <p className="text-xs text-muted-foreground">
            اقامت قرارداد: {checkIn || '—'} تا {checkOut || '—'}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="قیمت پایه هتل">
              <MoneyInput
                aria-label="قیمت پایه هتل"
                value={hotelBase}
                onValueChange={setHotelBase}
              />
            </FormField>
            <FormField label="ضریب هتل">
              <MoneyInput
                aria-label="ضریب هتل"
                value={hotelFactor}
                onValueChange={setHotelFactor}
              />
            </FormField>
          </div>
          <p className="text-sm text-muted-foreground">
            قیمت پایه × ضریب × {nights || '—'} شب قرارداد
          </p>
          {hotelPurchase && (
            <p className="text-sm">
              آخرین خرید: {formatSalesMoney(hotelPurchase.amount)}{' '}
              {hotelPurchase.currencyCode}
            </p>
          )}
          <p className="font-bold">
            جمع خرید هتل: {hotelTotal ? formatSalesMoney(hotelTotal) : '—'}{' '}
            {hotelCurrency?.id ?? ''}
          </p>
        </section>
      ) : null}
      {transfers.length ? (
        <section className="space-y-4 rounded-xl border border-border bg-surface p-4">
          {transfers.length > 1 && (
            <label className="flex items-center gap-2 text-sm font-bold">
              <input
                type="checkbox"
                checked={splitTransfers}
                onChange={(event) => {
                  const split = event.target.checked;
                  if (split) {
                    const supplier = combinedTransfer.supplier ?? hotelSupplier;
                    setSeparateTransfers((rows) =>
                      rows.map((row) => ({
                        ...row,
                        supplier: row.supplier ?? supplier,
                        currency: row.currency ?? combinedTransfer.currency,
                      })),
                    );
                  }
                  setSplitTransfers(split);
                }}
              />
              کارگزار جدا برای ترانسفر رفت و برگشت
            </label>
          )}
          {transferRows.map(({ keys, title, draft }, index) => (
            <div
              key={keys.join('|')}
              className="space-y-3 rounded-lg border p-3"
            >
              <h4 className="font-bold">{title}</h4>
              {latestTransfer(keys) && (
                <p className="text-xs text-muted-foreground">
                  آخرین خرید ثبت‌شده:{' '}
                  {formatSalesMoney(latestTransfer(keys)!.amount)}{' '}
                  {latestTransfer(keys)!.currencyCode}
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="کارگزار ترانسفر">
                  <Lookup
                    kind="brokers"
                    label={title + ' · کارگزار ترانسفر'}
                    value={
                      draft.supplier ?? (!splitTransfers ? hotelSupplier : null)
                    }
                    onChange={(supplier) => changeTransfer(index, { supplier })}
                  />
                </FormField>
                <FormField label="ارز خرید ترانسفر">
                  <Lookup
                    kind="currencies"
                    label={title + ' · ارز خرید ترانسفر'}
                    value={draft.currency}
                    onChange={(currency) => changeTransfer(index, { currency })}
                  />
                </FormField>
                <FormField label="قیمت ترانسفر هر نفر">
                  <MoneyInput
                    aria-label={title + ' · قیمت ترانسفر هر نفر'}
                    value={draft.price}
                    onValueChange={(price) => changeTransfer(index, { price })}
                  />
                </FormField>
                <FormField label="تعداد نفرات محاسبه‌شونده">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    className="h-10 w-full rounded-lg border bg-background px-3"
                    aria-label={title + ' · تعداد نفرات محاسبه‌شونده'}
                    value={draft.count}
                    onChange={(event) =>
                      changeTransfer(index, { count: event.target.value })
                    }
                  />
                </FormField>
              </div>
              <p className="text-sm text-muted-foreground">
                قیمت هر نفر × تعداد نفرات محاسبه‌شونده
              </p>
              <p className="font-bold">
                جمع ترانسفر:{' '}
                {transferTotals[index]
                  ? formatSalesMoney(transferTotals[index]!)
                  : '—'}{' '}
                {draft.currency?.id ?? ''}
              </p>
            </div>
          ))}
        </section>
      ) : null}
      {services.length ? (
        <div className="space-y-3">
          {[...totals].map(([code, amounts]) => (
            <p key={code} className="font-bold">
              جمع درخواست خرید: {formatSalesMoney(totalOf(amounts))} {code}
            </p>
          ))}
          <Button
            type="button"
            disabled={
              busy ||
              Boolean(hotel && !nights) ||
              Boolean(hotel && !hotelTotal) ||
              Boolean(
                transfers.length && transferTotals.some((total) => !total),
              )
            }
            onClick={() => void save()}
          >
            {busy ? 'در حال ارسال…' : 'ثبت درخواست خرید و ارسال به مالی'}
          </Button>
          <p role="status" className="text-sm">
            {message}
          </p>
        </div>
      ) : (
        <p>در این قرارداد هتل یا ترانسفر ثبت نشده است.</p>
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

export function ReservationPurchaseDialog({
  id,
  category = 'ALL',
  serviceClientKey,
  readOnly = false,
  onSaved,
}: {
  id: string;
  category?: 'ALL' | 'HOTEL' | 'FLIGHT' | 'TRANSFER' | 'INSURANCE';
  serviceClientKey?: string | undefined;
  readOnly?: boolean;
  onSaved?: (() => void) | undefined;
}) {
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
      .catch((reason: Error) => {
        if (live) setError(reason.message);
      });
    return () => {
      live = false;
    };
  }, [id, refresh]);
  if (error) return <p role="alert">{error}</p>;
  return request ? (
    <>
      {readOnly ? (
        <p>مجوز ثبت یا اصلاح خرید خدمات وجود ندارد.</p>
      ) : category === 'INSURANCE' ? (
        <ReservationInsurancePurchase
          key={request.purchaseVersion}
          request={request}
          serviceClientKey={serviceClientKey}
          onSaved={() => {
            setRefresh((value) => value + 1);
            onSaved?.();
          }}
        />
      ) : (
        <ReservationHotelPurchase
          key={request.purchaseVersion}
          request={request}
          onSaved={() => {
            setRefresh((value) => value + 1);
            onSaved?.();
          }}
        />
      )}
    </>
  ) : (
    <p>در حال دریافت اطلاعات خرید…</p>
  );
}
