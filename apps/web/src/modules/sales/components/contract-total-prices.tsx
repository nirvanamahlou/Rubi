'use client';
import type { SalesMoney } from '@nora/contracts';
import { MoneyInput } from '@/components/ui/money-input';
import { Button } from '@/components/ui/button';
import { currencySymbol } from '@/lib/currency-symbol';
import {
  SalesCurrencySelect,
  type SalesCurrency,
} from './sales-currency-select';
import type { SalesFormState } from '../model/sales-form';

export function ContractTotalPrices({
  state,
  currencies,
  onChange,
}: {
  state: SalesFormState;
  currencies: readonly SalesCurrency[];
  onChange: (prices: SalesMoney[]) => void;
}) {
  const rows = state.contractPrices ?? [{ currencyCode: 'IRR', amount: '' }];
  const update = (index: number, patch: Partial<SalesMoney>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  return (
    <section className="space-y-3 rounded-xl border p-4">
      <h3 className="font-bold">مبلغ کل قرارداد</h3>
      {state.serviceKinds.includes('INSURANCE') &&
        Object.values(state.insuranceExtraToman ?? {}).some(
          (value) => value && value !== '0',
        ) && (
          <p className="text-sm">
            اضافه‌بیمه بالای ۶۰ سال جداگانه به جمع ریالی افزوده می‌شود.
          </p>
        )}
      {rows.map((row, index) => (
        <div key={index} className="flex flex-wrap items-end gap-3">
          <SalesCurrencySelect
            label="ارز مبلغ قرارداد"
            currencies={currencies.filter(
              (c) =>
                c.code === row.currencyCode ||
                !rows.some((r) => r.currencyCode === c.code),
            )}
            value={row.currencyCode}
            onChange={(currencyCode) => update(index, { currencyCode })}
          />
          <label className="grid flex-1 gap-1">
            مبلغ کل ({currencySymbol(row.currencyCode)})
            <MoneyInput
              aria-label={`مبلغ کل قرارداد ${row.currencyCode}`}
              value={row.amount}
              onValueChange={(amount) => update(index, { amount })}
            />
          </label>
          {rows.length > 1 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onChange(rows.filter((_, i) => i !== index))}
            >
              حذف مبلغ
            </Button>
          )}
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        disabled={
          !currencies.some(
            (c) =>
              c.status === 'active' &&
              !rows.some((r) => r.currencyCode === c.code),
          )
        }
        onClick={() => {
          const next = currencies.find(
            (c) =>
              c.status === 'active' &&
              !rows.some((r) => r.currencyCode === c.code),
          );
          if (next)
            onChange([...rows, { currencyCode: next.code, amount: '' }]);
        }}
      >
        افزودن مبلغ با ارز دیگر
      </Button>
    </section>
  );
}
