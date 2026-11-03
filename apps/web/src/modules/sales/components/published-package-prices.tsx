'use client';
import { useState } from 'react';
import { moneyDecimal, moneyUnits, type SalesMoney } from '@nora/contracts';
import { MoneyInput } from '@/components/ui/money-input';
import { currencySymbol } from '@/lib/currency-symbol';
import type { SalesFormState } from '../model/sales-form';

/** Package tariffs are immutable here; only a same-currency sales discount is entered. */
export function PublishedPackagePrices({
  state,
  onChange,
}: {
  state: SalesFormState;
  onChange: (prices: SalesMoney[]) => void;
}) {
  const prices = state.packageSaleQuote?.prices ?? [];
  const [discounts, setDiscounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      prices.map((p) => {
        const net = state.contractPrices?.find(
          (n) => n.currencyCode === p.currencyCode,
        );
        const difference =
          moneyUnits(p.amount) - moneyUnits(net?.amount || p.amount);
        return [
          p.currencyCode,
          moneyDecimal(difference > 0n ? difference : 0n),
        ];
      }),
    ),
  );
  const [error, setError] = useState('');
  return (
    <section className="space-y-3 rounded-xl border p-4">
      <h3 className="font-bold">قیمت منتشرشده پکیج</h3>
      {!prices.length && (
        <p role="status">برای ترکیب انتخاب‌شده قیمت منتشرشده موجود نیست.</p>
      )}
      {prices.map((price) => (
        <div key={price.currencyCode} className="grid gap-3 sm:grid-cols-3">
          <div>
            <span>قیمت منتشرشده پکیج</span>
            <p>
              <bdi>
                {price.amount} {currencySymbol(price.currencyCode)}
              </bdi>
            </p>
          </div>
          <label>
            تخفیف فروشنده
            <MoneyInput
              aria-label={`تخفیف فروشنده ${price.currencyCode}`}
              value={discounts[price.currencyCode] ?? '0'}
              onValueChange={(value) => {
                setDiscounts((previous) => ({
                  ...previous,
                  [price.currencyCode]: value,
                }));
                try {
                  const amount =
                    moneyUnits(price.amount) - moneyUnits(value || '0');
                  if (amount < 0n)
                    throw Error('تخفیف نمی‌تواند از قیمت پکیج بیشتر باشد.');
                  setError('');
                  onChange(
                    prices.map((p) =>
                      p.currencyCode === price.currencyCode
                        ? { ...p, amount: moneyDecimal(amount) }
                        : (state.contractPrices?.find(
                            (n) => n.currencyCode === p.currencyCode,
                          ) ?? p),
                    ),
                  );
                } catch {
                  setError('تخفیف نمی‌تواند از قیمت پکیج بیشتر باشد.');
                  onChange(
                    prices.map((p) =>
                      p.currencyCode === price.currencyCode
                        ? { ...p, amount: '' }
                        : (state.contractPrices?.find(
                            (n) => n.currencyCode === p.currencyCode,
                          ) ?? p),
                    ),
                  );
                }
              }}
            />
          </label>
          <div>
            <span>مبلغ کل قرارداد</span>
            <p>
              <bdi>
                {state.contractPrices?.find(
                  (p) => p.currencyCode === price.currencyCode,
                )?.amount ?? price.amount}{' '}
                {currencySymbol(price.currencyCode)}
              </bdi>
            </p>
          </div>
        </div>
      ))}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
