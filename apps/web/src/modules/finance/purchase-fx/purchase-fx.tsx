'use client';
import { localizedFetch } from '@/i18n/localized-fetch';
import { groupPurchaseFx } from './summary';
import { purchaseFxPaymentPreview } from './payment-preview';
import { useEffect, useState } from 'react';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { MoneyInput, formatSalesMoney } from '@/components/ui/money-input';
import { Button } from '@/components/ui/button';
import type { FinancePurchaseFxV1 } from '@nora/contracts';

async function fxRequest(path: string, body?: unknown) {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('ارتباط با سامانه برقرار نیست.');
  const send = () =>
    localizedFetch(base + '/finance/' + path, {
      method: body ? 'POST' : 'GET',
      credentials: 'include',
      cache: 'no-store',
      ...(body
        ? {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }
        : {}),
    });
  let response = await send();
  if (response.status === 401 && (await refreshAuthenticatedSession(base)))
    response = await send();
  const result = await response.json();
  if (!response.ok)
    throw new Error(result?.message || 'ثبت نرخ ارز انجام نشد.');
  return result.data;
}
export function PurchaseFxRate({
  currencyCode,
  value,
  onChange,
}: {
  currencyCode: string;
  value: string;
  onChange: (currency: string, value: string) => void;
}) {
  const [error, setError] = useState('');
  useEffect(() => {
    if (!currencyCode || currencyCode === 'IRR' || value) return;
    let active = true;
    void fxRequest(
      'purchase-fx-quote?currency=' + encodeURIComponent(currencyCode),
    )
      .then((data) => {
        if (active && data) onChange(currencyCode, data.rateToIrr);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : 'نرخ ارز در دسترس نیست.',
          );
      });
    return () => {
      active = false;
    };
  }, [currencyCode, value, onChange]);
  if (!currencyCode || currencyCode === 'IRR') return null;
  return (
    <label className="grid gap-1 text-xs">
      نرخ مبنای خرید · ریال برای هر {currencyCode}
      <MoneyInput
        aria-label="نرخ مبنای خرید"
        value={value}
        onValueChange={(rate) => onChange(currencyCode, rate)}
      />
      {error && <span role="status">{error}</span>}
    </label>
  );
}
const rial = (value: string | null) =>
  value === null ? '—' : `${formatSalesMoney(value)} ریال`;
export function PurchaseFxSummary({
  entries,
}: {
  entries?: readonly FinancePurchaseFxV1[] | undefined;
}) {
  if (!entries?.length) return null;
  return (
    <div className="grid gap-1 text-xs">
      {groupPurchaseFx(entries).map((entry) => (
        <div key={entry.referenceId} className="flex flex-wrap gap-x-3 gap-y-1">
          <b>{entry.currencyCode}</b>
          <span>
            معادل ریالی مبنا: <b>{rial(entry.baselineEquivalent)}</b>
          </span>
          <span>
            پرداخت واقعی: <b>{rial(entry.actualPaidEquivalent)}</b>
          </span>
          <span
            className={
              entry.realizedGainLoss?.startsWith('-')
                ? 'text-rose-600 dark:text-rose-300'
                : 'text-emerald-700 dark:text-emerald-300'
            }
          >
            سود / زیان ارز: <b>{rial(entry.realizedGainLoss)}</b>
          </span>
          {entry.gainLossPerUnit !== undefined && (
            <span>
              اختلاف هر {entry.currencyCode}:{' '}
              <b>{rial(entry.gainLossPerUnit ?? null)}</b>
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
export function PurchaseFxCapture({
  entry,
  onSaved,
}: {
  entry: FinancePurchaseFxV1;
  onSaved: () => void;
}) {
  const [rate, setRate] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  if (entry.rateToIrr) return null;
  return (
    <div className="grid gap-2 rounded-lg border p-3">
      <label className="text-sm">
        نرخ روز ثبت خرید · {entry.currencyCode}
        <MoneyInput value={rate} onValueChange={setRate} />
      </label>
      <Button
        type="button"
        disabled={busy || !rate}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            await fxRequest(
              'purchase-fx/' + encodeURIComponent(entry.referenceId),
              { rateToIrr: rate },
            );
            onSaved();
          } catch (cause) {
            setError(
              cause instanceof Error ? cause.message : 'ثبت نرخ ارز انجام نشد.',
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        ثبت نرخ ثابت خرید
      </Button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

export function PurchaseFxPaymentPreview({
  amount,
  baselineRate,
  actualRate,
}: {
  amount: string;
  baselineRate: string | null;
  actualRate: string;
}) {
  const preview = purchaseFxPaymentPreview(amount, baselineRate, actualRate);
  if (!preview) return null;
  return (
    <div className="grid gap-1 rounded-lg border bg-primary/5 p-3 text-sm">
      <span>معادل مبنای این پرداخت: {rial(preview.baseline)}</span>
      <span>هزینه واقعی این پرداخت: {rial(preview.actual)}</span>
      <strong
        className={
          preview.gainLoss.startsWith('-')
            ? 'text-rose-600 dark:text-rose-300'
            : 'text-emerald-700 dark:text-emerald-300'
        }
      >
        سود / زیان این پرداخت: {rial(preview.gainLoss)}
      </strong>
    </div>
  );
}
