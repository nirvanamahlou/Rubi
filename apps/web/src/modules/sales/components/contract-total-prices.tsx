'use client';
import { flightRoomTotals } from '@nora/contracts';
import type { SalesMoney } from '@nora/contracts';
import { MoneyInput } from '@/components/ui/money-input';
import { Button } from '@/components/ui/button';
import { currencySymbol } from '@/lib/currency-symbol';
import {
  SalesCurrencySelect,
  type SalesCurrency,
} from './sales-currency-select';
import {
  passengerFlightSalePrices,
  salesHotelGuestIds,
  type SalesFormState,
  salesNetServicePrices,
} from '../model/sales-form';

export function ContractTotalPrices({
  state,
  currencies,
  onChange,
}: {
  state: SalesFormState;
  currencies: readonly SalesCurrency[];
  onChange: (prices: SalesMoney[]) => void;
}) {
  const automatic =
    state.passengerTotalPricing ||
    ((!state.packageSaleQuote || state.passengerHotelPrices !== undefined) &&
      state.automaticComponentPricing &&
      state.serviceKinds.some((k) => k === 'FLIGHT' || k === 'HOTEL'));
  let calculated: SalesMoney[] = [];
  try {
    if (
      state.passengerTotalPricing ||
      (state.passengerDeductions &&
        Object.keys(state.passengerDeductions).length)
    ) {
      calculated = flightRoomTotals(salesNetServicePrices(state), []);
    } else {
      calculated = flightRoomTotals(
        {
          ...passengerFlightSalePrices(state),
          ...Object.fromEntries(
            Object.entries(
              state.serviceKinds.includes('HOTEL')
                ? (state.passengerHotelPrices ?? {})
                : {},
            )
              .filter(([id]) => salesHotelGuestIds(state).includes(id))
              .map(([id, p]) => ['hotel-' + id, p]),
          ),
        },
        state.passengerHotelPrices === undefined &&
          state.serviceKinds.includes('HOTEL')
          ? (state.hotel.rooms ?? [])
          : [],
      );
    }
  } catch {
    /* Invalid input is reported by final-step validation. */
  }
  const rows = state.contractPrices?.length
    ? state.contractPrices
    : [{ currencyCode: 'IRR', amount: '' }];
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
      {automatic ? (
        <div
          className="flex flex-wrap gap-4 rounded-lg bg-muted p-3"
          aria-label="جمع خودکار قرارداد"
        >
          {calculated.map((p) => (
            <span key={p.currencyCode}>
              <bdi>
                {p.amount} {currencySymbol(p.currencyCode)}
              </bdi>
            </span>
          ))}
        </div>
      ) : (
        rows.map((row, index) => (
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
        ))
      )}
      {!automatic && (
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
      )}
    </section>
  );
}
