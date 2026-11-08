'use client';
import { useEffect, useState } from 'react';
import type { SalesBalance } from '@nora/contracts';
import { salesApi } from '@/modules/sales/api/client';
import { formatSalesMoney } from '@/components/ui/money-input';
import { currencySymbol } from '@/lib/currency-symbol';
export function ContractFinancialSummary({ id }: { id: string }) {
  const [result, setResult] = useState<{
    id: string;
    balances?: SalesBalance[];
    error?: string;
  } | null>(null);
  useEffect(() => {
    let active = true;
    void salesApi
      .financeSummary(id)
      .then((r) => {
        if (active) setResult({ id, balances: r.data.balances });
      })
      .catch((e) => {
        if (active)
          setResult({
            id,
            error: e instanceof Error ? e.message : 'دریافت اطلاعات انجام نشد.',
          });
      });
    return () => {
      active = false;
    };
  }, [id]);
  if (result?.id === id && result.error)
    return <p role="alert">{result.error}</p>;
  if (result?.id !== id || !result.balances)
    return <p role="status">در حال دریافت پرداخت‌ها…</p>;
  return <ContractFinancialSummaryValues balances={result.balances} />;
}
export function ContractFinancialSummaryValues({
  balances,
}: {
  balances: SalesBalance[];
}) {
  return (
    <section aria-label="خلاصه مالی قرارداد" className="space-y-3">
      {balances.map((b) => (
        <div key={b.currencyCode} className="grid gap-3 sm:grid-cols-3">
          {[
            ['مبلغ کل', b.amount],
            ['پرداخت‌شده', b.confirmedPaid],
            ['مانده', b.outstanding],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-border bg-primary/5 p-4"
            >
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-2 text-lg font-bold">
                <bdi>{formatSalesMoney(value!)}</bdi>{' '}
                {currencySymbol(b.currencyCode)}
              </p>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
