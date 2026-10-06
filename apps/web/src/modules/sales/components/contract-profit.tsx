'use client';
import { useEffect, useState } from 'react';
import type { SalesContractProfitV1 } from '@nora/contracts';
import { salesApi } from '../api/client';
import { Button } from '@/components/ui/button';
import { formatSalesMoney } from '@/components/ui/money-input';

export function ContractProfit({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<SalesContractProfitV1 | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!open) return;
    let live = true;
    salesApi
      .profit(id)
      .then(({ data }) => {
        if (live) setValue(data);
      })
      .catch((reason: unknown) => {
        if (live)
          setError(
            reason instanceof Error ? reason.message : 'دریافت سود ناموفق بود.',
          );
      });
    return () => {
      live = false;
    };
  }, [id, open, retry]);
  return (
    <section className="space-y-3 rounded-xl border p-3">
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setValue(null);
          setError('');
          setOpen((v) => !v);
        }}
      >
        هزینه خرید و سود قرارداد
      </Button>
      {open && (
        <>
          {error ? (
            <p role="alert">
              {error}{' '}
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setValue(null);
                  setError('');
                  setRetry((v) => v + 1);
                }}
              >
                تلاش دوباره
              </Button>
            </p>
          ) : !value ? (
            <p role="status">در حال دریافت هزینه‌ها…</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                فروش منهای هزینه خرید ثبت‌شده؛ سود هر ارز جداست و تبدیل ارز
                انجام نمی‌شود.
              </p>
              {!value.complete && (
                <p role="status" className="text-amber-700">
                  سود هنوز کامل نیست؛ هزینه این خدمات ثبت نشده:{' '}
                  {value.missingServiceTitles.join('، ')}
                </p>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th>ارز</th>
                      <th>فروش</th>
                      <th>خرید ثبت‌شده</th>
                      <th>سود</th>
                    </tr>
                  </thead>
                  <tbody>
                    {value.totals.map((r) => (
                      <tr key={r.currencyCode}>
                        <td>{r.currencyCode}</td>
                        <td>{formatSalesMoney(r.salesAmount)}</td>
                        <td>{formatSalesMoney(r.purchaseAmount)}</td>
                        <td>
                          {r.profitAmount === null
                            ? 'در انتظار تکمیل هزینه‌ها'
                            : formatSalesMoney(r.profitAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="text-xs">
                {value.costs.map((c, i) => (
                  <li key={c.referenceId + ':' + i}>
                    {c.serviceTitles.join('، ')}: {formatSalesMoney(c.amount)}{' '}
                    {c.currencyCode} ·{' '}
                    {c.source === 'FINANCE_TICKET'
                      ? 'خرید بلیت ثبت‌شده در مالی'
                      : 'خرید رزرواسیون'}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}
