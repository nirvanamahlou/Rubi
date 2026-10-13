'use client';
import { useEffect, useState } from 'react';
import { moneyUnits, type HotelPurchaseSavingsV1 } from '@nora/contracts';
import { formatSalesMoney } from '@/components/ui/money-input';
import { travelRequest } from './travel-workflow-form';

export function hotelSavingsDifference(
  reference: string,
  actual: string,
): string {
  const value = moneyUnits(reference) - moneyUnits(actual);
  const abs = value < 0n ? -value : value;
  return `${value < 0n ? '-' : ''}${abs / 10000n}.${(abs % 10000n).toString().padStart(4, '0')}`;
}
export function HotelPurchaseSavings({
  value,
  actualAmount,
}: {
  value?: HotelPurchaseSavingsV1 | undefined;
  actualAmount?: string | undefined;
}) {
  let savings = value?.savingsAmount ?? null;
  if (value?.referenceAmount && actualAmount) {
    try {
      savings = hotelSavingsDifference(value.referenceAmount, actualAmount);
    } catch {
      savings = null;
    }
  }
  return (
    <section className="w-full space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
      <strong>سودآوری رزرواسیون هتل</strong>
      {value?.reason === 'CURRENT_REFERENCE' && (
        <p className="text-xs text-muted-foreground">
          نرخ مرجع فعلی؛ نرخ زمان خرید ذخیره نشده است.
        </p>
      )}
      {value?.status !== 'AVAILABLE' && value?.actualAmount != null && (
        <p>
          <span>خرید واقعی رزرواسیون</span>:{' '}
          <bdi>
            {formatSalesMoney(value.actualAmount)} {value.currencyCode}
          </bdi>
        </p>
      )}
      {value?.status === 'AVAILABLE' ? (
        <>
          <p>
            <span>کمترین نرخ خرید مرجع هتل</span>:{' '}
            <bdi>
              {formatSalesMoney(value.referenceAmount!)} {value.currencyCode}
            </bdi>
          </p>
          <p>
            <span>خرید واقعی رزرواسیون</span>:{' '}
            <bdi>
              {actualAmount || value.actualAmount
                ? formatSalesMoney(actualAmount || value.actualAmount!)
                : '—'}{' '}
              {value.currencyCode}
            </bdi>
          </p>
          <p
            className={
              savings?.startsWith('-')
                ? 'font-bold text-red-700'
                : 'font-bold text-emerald-700'
            }
          >
            <span>اختلاف با نرخ خرید مرجع</span>:{' '}
            <bdi dir="ltr">
              {savings === null ? '—' : formatSalesMoney(savings)}{' '}
              {value.currencyCode}
            </bdi>
          </p>
          <p className="text-xs text-muted-foreground">
            <span>منبع نرخ مرجع</span>: {value.sourceBrokerName ?? '—'} ·{' '}
            <bdi>
              {value.checkIn} — {value.checkOut}
            </bdi>
          </p>
        </>
      ) : (
        <p>
          <span>
            مقایسه قابل محاسبه نیست؛ نرخ دقیق هم‌ارز و هم‌ترکیب یا سابقهٔ نرخ
            مرجع موجود نیست.
          </span>
        </p>
      )}
    </section>
  );
}
export function HotelPurchaseSavingsPreview({
  intakeId,
  currencyCode,
  actualAmount,
}: {
  intakeId: string;
  currencyCode: string;
  actualAmount: string;
}) {
  const [state, setState] = useState<{
    key: string;
    data?: HotelPurchaseSavingsV1;
    error?: string;
  } | null>(null);
  const key = `${intakeId}:${currencyCode}`;
  useEffect(() => {
    let live = true;
    if (!currencyCode) return;
    void travelRequest<{ data: HotelPurchaseSavingsV1 }>(
      `reservations/hotel-savings/${encodeURIComponent(intakeId)}?currency=${encodeURIComponent(currencyCode)}`,
    )
      .then((result) => {
        if (live) setState({ key, data: result.data });
      })
      .catch((error: unknown) => {
        if (live)
          setState({
            key,
            error:
              error instanceof Error
                ? error.message
                : 'دریافت نرخ مرجع ناموفق بود.',
          });
      });
    return () => {
      live = false;
    };
  }, [intakeId, currencyCode, key]);
  if (!currencyCode) return null;
  if (state?.key !== key)
    return <p role="status">در حال دریافت نرخ مرجع هتل…</p>;
  if (state.error) return <p role="alert">{state.error}</p>;
  return (
    <HotelPurchaseSavings value={state.data} actualAmount={actualAmount} />
  );
}
type Summary = {
  comparedCount: number;
  unavailableCount: number;
  totals: { amount: string; currencyCode: string }[];
};
export function HotelSavingsDashboard({
  from,
  to,
  dateBasis,
}: {
  from: string;
  to: string;
  dateBasis: string;
}) {
  const key = new URLSearchParams({ from, to, dateBasis }).toString();
  const [result, setResult] = useState<{
    key: string;
    data?: Summary;
    error?: string;
  } | null>(null);
  useEffect(() => {
    let live = true;
    const load = () => {
      void travelRequest<{ data: Summary }>(
        `reservations/hotel-savings/summary?${key}`,
      )
        .then((r) => {
          if (live) setResult({ key, data: r.data });
        })
        .catch((e: unknown) => {
          if (live)
            setResult({
              key,
              error:
                e instanceof Error ? e.message : 'دریافت سودآوری ناموفق بود.',
            });
        });
    };
    load();
    const timer = setInterval(load, 30000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [key]);
  return (
    <section className="space-y-3 rounded-xl border border-primary/20 bg-surface p-4">
      <h2 className="font-bold">سودآوری رزرواسیون هتل</h2>
      <p className="text-xs text-muted-foreground">
        نرخ خرید مرجع ثبت‌شده منهای خرید واقعی؛ تفکیک‌شده بر اساس ارز
      </p>
      {result?.key !== key ? (
        <p role="status">در حال دریافت…</p>
      ) : result.error ? (
        <p role="alert">{result.error}</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-4">
            {result.data?.totals.map((total) => (
              <bdi key={total.currencyCode} className="text-xl font-bold">
                {formatSalesMoney(total.amount)} {total.currencyCode}
              </bdi>
            ))}
          </div>
          <p>
            <span>خریدهای قابل مقایسه</span>: {result.data?.comparedCount} ·{' '}
            <span>خریدهای بدون مقایسه</span>: {result.data?.unavailableCount}
          </p>
        </>
      )}
    </section>
  );
}
