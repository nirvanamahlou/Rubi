'use client';
import { useRef, useState } from 'react';
import {
  CONTRACT_TOTAL_PURCHASE_KEY,
  moneyUnits,
  moneyDecimal,
  type ReservationIntakeV1,
  type ReservationServicePurchaseInputV1,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { MoneyInput } from '@/components/ui/money-input';
import { currencySymbol } from '@/lib/currency-symbol';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { purchaseApiRoot } from './purchase-api-root';
import { ReservationPurchaseBrokerLookup } from './reservation-purchase-broker-lookup';
import {
  useReservationCurrencies,
  ReservationCurrencySelect,
} from './reservation-currencies';
import type { Option } from '../hotel-rates/controls';
type Row = NonNullable<
  ReservationServicePurchaseInputV1['totalPassengerPrices']
>[number];
export function passengerPurchaseTotals(rows: readonly Row[]) {
  const totals = new Map<string, bigint>();
  if (rows.some((row) => row.currencyCode === 'IRR'))
    throw new Error('ارز خرید ارزی باید غیر ریال باشد.');
  for (const row of rows)
    for (const [code, amount] of [
      ['IRR', row.rialAmount],
      [row.currencyCode, row.foreignAmount],
    ] as const) {
      const units = moneyUnits(amount || '0');
      if (
        units < 0n ||
        (units > 0n &&
          (!code ||
            (code === 'IRR' &&
              amount === row.foreignAmount &&
              row.currencyCode === 'IRR')))
      )
        throw new Error('ارز و مبلغ خرید را بررسی کنید.');
      if (units) totals.set(code!, (totals.get(code!) ?? 0n) + units);
    }
  return [...totals].map(([currencyCode, units]) => ({
    currencyCode,
    amount: moneyDecimal(units),
  }));
}
export function FloatingPassengerPurchase({
  request,
  purchaseRoot,
  onSaved,
  onStage,
}: {
  request: ReservationIntakeV1;
  purchaseRoot: string;
  onSaved: () => void;
  onStage?: (
    body: ReservationServicePurchaseInputV1,
    details?: { supplierName: string },
  ) => void;
}) {
  const saved =
    request.servicePurchases?.filter(
      (p) => p.serviceClientKey === CONTRACT_TOTAL_PURCHASE_KEY,
    ) ?? [];
  const latest = saved[0];
  const current = latest?.batchId
    ? saved.filter((p) => p.batchId === latest.batchId)
    : saved.slice(0, 1);
  const passengers = request.snapshot.passengerAssignments?.length
    ? request.snapshot.passengerAssignments
    : request.snapshot.passengerIds.map((customerId) => ({
        customerId,
        displayNameSnapshot: customerId,
        ageCategory: 'ADT' as const,
        childAgeBand: undefined,
      }));
  const [supplier, setSupplier] = useState<Option | null>(
    latest
      ? { id: latest.supplierOrganizationId, name: latest.supplierName }
      : null,
  );
  const [rows, setRows] = useState<Row[]>(() =>
    passengers.map((p) => {
      const rial = current
        .find((c) => c.currencyCode === 'IRR')
        ?.passengerPrices.find((r) => r.customerId === p.customerId);
      const foreign = current.find(
        (c) =>
          c.currencyCode !== 'IRR' &&
          c.passengerPrices.some((r) => r.customerId === p.customerId),
      );
      const staged = latest?.totalPassengerPrices?.find(
        (r) => r.customerId === p.customerId,
      );
      if (staged) return { ...staged };
      return {
        customerId: p.customerId,
        rialAmount: rial?.totalAmount ?? '',
        foreignAmount:
          foreign?.passengerPrices.find((r) => r.customerId === p.customerId)
            ?.totalAmount ?? '',
        ...(foreign ? { currencyCode: foreign.currencyCode } : {}),
      };
    }),
  );
  const currencies = useReservationCurrencies(request.id, purchaseRoot);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  let totals: ReturnType<typeof passengerPurchaseTotals> = [];
  let invalid = '';
  try {
    totals = passengerPurchaseTotals(rows);
  } catch (e) {
    invalid = (e as Error).message;
  }
  function update(index: number, patch: Partial<Row>) {
    setRows((old) => old.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }
  async function save() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const totals = passengerPurchaseTotals(rows);
      const base = getPublicApiBaseUrl();
      if (!supplier || !totals.length || !rows.length || !base)
        throw new Error('آژانس و مبلغ خرید مسافران را وارد کنید.');
      const body: ReservationServicePurchaseInputV1 = {
        version: 1,
        expectedVersion: request.purchaseVersion ?? 0,
        serviceClientKey: CONTRACT_TOTAL_PURCHASE_KEY,
        supplierOrganizationId: supplier.id,
        amount: totals[0]!.amount,
        currencyCode: totals[0]!.currencyCode,
        totalPassengerPrices: rows.map((r) => ({
          ...r,
          rialAmount: r.rialAmount || '0',
          foreignAmount: r.foreignAmount || '0',
        })),
      };
      if (onStage) {
        onStage(body, { supplierName: supplier.name });
        onSaved();
        return;
      }
      const payload = JSON.stringify(body);
      if (attempt.current?.payload !== payload)
        attempt.current = { payload, key: crypto.randomUUID() };
      const send = () =>
        fetch(
          `${base}/${purchaseApiRoot(request.id, purchaseRoot)}/service-purchases`,
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
      const result = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          result?.error?.message ?? result?.message ?? 'ثبت خرید ناموفق بود.',
        );
      window.dispatchEvent(new Event('floating-purchases-changed'));
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4 rounded-xl border p-4">
      <h3 className="font-bold">خرید کل قرارداد به تفکیک مسافر</h3>
      <ReservationPurchaseBrokerLookup
        purchaseRoot={purchaseRoot}
        requestId={request.id}
        label="آژانس خرید"
        value={supplier}
        onChange={setSupplier}
      />
      {latest && !current.some((p) => p.passengerPrices.length) && (
        <p role="status">
          خرید قبلی به صورت کلی ثبت شده است؛ برای خرید جدید قیمت هر مسافر را
          وارد کنید.
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[650px] text-sm">
          <thead>
            <tr className="bg-primary/5">
              <th>مسافر</th>
              <th>رده سنی</th>
              <th>خرید ریالی</th>
              <th>ارز خرید</th>
              <th>خرید ارزی</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const p = passengers[index]!;
              return (
                <tr key={row.customerId} className="border-b">
                  <td>{p.displayNameSnapshot || `مسافر ${index + 1}`}</td>
                  <td>
                    {p.ageCategory === 'INF'
                      ? 'نوزاد'
                      : p.ageCategory === 'CHD'
                        ? p.childAgeBand === 'AGE_2_6'
                          ? 'کودک ۲ تا ۶ سال'
                          : p.childAgeBand === 'AGE_6_12'
                            ? 'کودک ۶ تا ۱۲ سال'
                            : 'کودک — سن ثبت نشده'
                        : 'بزرگسال'}
                  </td>
                  <td>
                    <MoneyInput
                      aria-label={`خرید ریالی مسافر ${index + 1}`}
                      value={row.rialAmount}
                      onValueChange={(v) => update(index, { rialAmount: v })}
                    />
                  </td>
                  <td>
                    <ReservationCurrencySelect
                      label={`ارز خرید مسافر ${index + 1}`}
                      currencies={currencies.currencies.filter(
                        (c) => c.code !== 'IRR',
                      )}
                      disabled={currencies.loading}
                      value={row.currencyCode ?? ''}
                      onChange={(currencyCode) =>
                        update(index, { currencyCode })
                      }
                    />
                  </td>
                  <td>
                    <MoneyInput
                      aria-label={`خرید ارزی مسافر ${index + 1}`}
                      value={row.foreignAmount}
                      onValueChange={(v) => update(index, { foreignAmount: v })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div aria-live="polite" className="rounded-lg bg-primary/5 p-3 font-bold">
        جمع کل خرید:{' '}
        {totals
          .map((t) => `${t.amount} ${currencySymbol(t.currencyCode)}`)
          .join(' + ') || '۰'}
      </div>
      {(error || invalid || currencies.error) && (
        <p role="alert">{error || invalid || currencies.error}</p>
      )}
      <Button
        type="button"
        disabled={busy || !!invalid || !rows.length}
        onClick={() => void save()}
      >
        ثبت خرید مسافران
      </Button>
    </section>
  );
}
