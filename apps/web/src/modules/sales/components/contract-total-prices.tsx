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
  type SalesFormState,
} from '../model/sales-form';

export function ContractTotalPrices({
  state,
  currencies,
  onChange,
  onRoomPricesChange,
}: {
  state: SalesFormState;
  currencies: readonly SalesCurrency[];
  onChange: (prices: SalesMoney[]) => void;
  onRoomPricesChange?: (
    rooms: NonNullable<SalesFormState['hotel']['rooms']>,
  ) => void;
}) {
  const automatic =
    !state.packageSaleQuote &&
    state.automaticComponentPricing &&
    state.serviceKinds.some((k) => k === 'FLIGHT' || k === 'HOTEL');
  let calculated: SalesMoney[] = [];
  try {
    calculated = flightRoomTotals(
      passengerFlightSalePrices(state),
      state.serviceKinds.includes('HOTEL') ? (state.hotel.rooms ?? []) : [],
    );
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
      {state.serviceKinds.includes('HOTEL') &&
      state.hotel.rooms?.length &&
      onRoomPricesChange ? (
        <section className="grid gap-3 rounded-xl border p-3">
          <h4 className="font-bold">مبلغ توافق‌شدهٔ هر اتاق</h4>
          <p className="text-xs text-muted-foreground">
            مبالغ اتاق‌ها بخشی از مبلغ کل قرارداد هستند.
          </p>
          {state.hotel.rooms.map((room, index) => {
            const price = room.agreedPrice ?? {
              amount: '',
              currencyCode:
                currencies.find((c) => c.status === 'active')?.code ?? '',
            };
            const update = (patch: Partial<SalesMoney>) =>
              onRoomPricesChange(
                state.hotel.rooms!.map((r, i) =>
                  i === index
                    ? { ...r, agreedPrice: { ...price, ...patch } }
                    : r,
                ),
              );
            return (
              <div
                key={room.ordinal}
                className="grid gap-2 sm:grid-cols-[1fr_10rem_1fr]"
              >
                <span>
                  اتاق {room.ordinal} · {room.roomTypeNameSnapshot}
                </span>
                <SalesCurrencySelect
                  label="ارز اتاق"
                  currencies={currencies}
                  value={price.currencyCode}
                  onChange={(currencyCode) => update({ currencyCode })}
                />
                <label>
                  مبلغ توافق‌شدهٔ اتاق
                  <MoneyInput
                    aria-label={`مبلغ اتاق ${room.ordinal}`}
                    value={price.amount}
                    onValueChange={(amount) => update({ amount })}
                  />
                </label>
              </div>
            );
          })}
        </section>
      ) : null}

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
