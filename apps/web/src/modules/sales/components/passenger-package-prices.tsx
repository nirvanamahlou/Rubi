'use client';
import { currencySymbol } from '@/lib/currency-symbol';
import { Button } from '@/components/ui/button';
import { insuranceExtraRials, passengerOverSixty } from '@nora/contracts';
import {
  salesTravelDate,
  salesHotelGuestIds,
  salesPassengerFlightDirections,
  salesPassengerAgeLabel,
} from '../model/sales-form';

import { moneyDecimal, moneyUnits, type SalesMoney } from '@nora/contracts';
import { MoneyInput, formatSalesMoney } from '@/components/ui/money-input';
import {
  SalesCurrencySelect,
  type SalesCurrency,
} from './sales-currency-select';
import { type SalesFormState } from '../model/sales-form';

export function PassengerPackagePrices({
  state,
  currencies = [],
  flight = false,
  hotel = false,
  onChange,
}: {
  state: SalesFormState;
  flight?: boolean;
  hotel?: boolean;
  currencies?: readonly SalesCurrency[];
  onChange: (prices: Record<string, SalesMoney[]>) => void;
}) {
  const passengers = state.passengers.filter((p) =>
    hotel
      ? salesHotelGuestIds(state).includes(p.customerId)
      : !flight ||
        salesPassengerFlightDirections(state, p.customerId).length > 0,
  );
  const totals = new Map<string, bigint>();
  let invalid = false;
  for (const passenger of passengers)
    for (const price of state.passengerPrices?.[passenger.customerId] ?? []) {
      if (flight && !price.amount.trim()) continue;
      try {
        totals.set(
          price.currencyCode,
          (totals.get(price.currencyCode) ?? 0n) + moneyUnits(price.amount),
        );
      } catch {
        invalid = true;
      }
    }
  if (!flight && state.serviceKinds.includes('INSURANCE'))
    for (const passenger of passengers) {
      const extra = state.insuranceExtraToman?.[passenger.customerId];
      if (
        extra &&
        passengerOverSixty(passenger.birthDate, salesTravelDate(state))
      ) {
        try {
          totals.set(
            'IRR',
            (totals.get('IRR') ?? 0n) + moneyUnits(insuranceExtraRials(extra)),
          );
        } catch {
          invalid = true;
        }
      }
    }
  const set = (id: string, code: string, amount: string, foreign = false) => {
    const current = state.passengerPrices?.[id] ?? [];
    onChange({
      ...state.passengerPrices,
      [id]: [
        ...current.filter((p) =>
          foreign
            ? p.currencyCode !==
                current.find((row) => row.currencyCode !== 'IRR')
                  ?.currencyCode && p.currencyCode !== code
            : p.currencyCode !== code,
        ),
        ...(code && (foreign || amount !== '')
          ? [{ currencyCode: code, amount }]
          : []),
      ],
    });
  };
  return (
    <section className="space-y-3 rounded-xl border p-4">
      <h3 className="font-bold">
        {hotel
          ? 'قیمت هتل هر مسافر'
          : flight
            ? 'قیمت ریالی و ارزی هر مسافر'
            : 'قیمت کل خدمات هر مسافر'}
      </h3>

      {state.serviceKinds.includes('INSURANCE') &&
        Object.values(state.insuranceExtraToman ?? {}).some(
          (v) => v && v !== '0',
        ) && (
          <p className="text-sm">
            مبلغ هر مسافر را بدون اضافه بیمه بالای ۶۰ سال وارد کنید؛ اضافه بیمه
            در جمع نهایی همین مسافر لحاظ می‌شود.
          </p>
        )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted">
              <th className="p-2 text-right">مسافر</th>
              <th className="p-2">رده سنی</th>
              <th className="p-2">قیمت ریالی (IRR)</th>
              <th className="p-2">ارز</th>
              <th className="p-2">قیمت ارزی</th>
            </tr>
          </thead>
          <tbody>
            {passengers.map((p, index) => {
              const rows = state.passengerPrices?.[p.customerId] ?? [];
              const rial = rows.find((r) => r.currencyCode === 'IRR');
              const foreign = rows.find((r) => r.currencyCode !== 'IRR');
              return (
                <tr key={p.customerId} className="border-b">
                  <th className="p-2 text-right font-medium">
                    {index + 1}. {p.displayName}
                    {flight && (
                      <span className="block text-xs">
                        {salesPassengerFlightDirections(state, p.customerId)
                          .map((d) => (d === 'OUTBOUND' ? 'رفت' : 'برگشت'))
                          .join(' / ')}
                      </span>
                    )}
                  </th>
                  <td className="p-2">
                    {salesPassengerAgeLabel(
                      p.birthDate,
                      salesTravelDate(state),
                      p.ageCategory,
                    )}
                  </td>
                  <td className="min-w-40 p-2">
                    <MoneyInput
                      aria-label={'قیمت ریالی ' + p.displayName}
                      value={rial?.amount ?? ''}
                      onValueChange={(value) => set(p.customerId, 'IRR', value)}
                    />
                  </td>
                  {
                    <td className="min-w-44 p-2">
                      <SalesCurrencySelect
                        label={'ارز ' + p.displayName}
                        currencies={currencies.filter((r) => r.code !== 'IRR')}
                        value={foreign?.currencyCode ?? ''}
                        onChange={(code) =>
                          set(p.customerId, code, foreign?.amount ?? '', true)
                        }
                      />
                      {foreign && (
                        <Button
                          type="button"
                          variant="outline"
                          className="mt-1 text-xs"
                          onClick={() => set(p.customerId, '', '', true)}
                        >
                          حذف مبلغ ارزی
                        </Button>
                      )}
                    </td>
                  }
                  <td className="min-w-40 p-2">
                    {
                      <MoneyInput
                        aria-label={'قیمت ارزی ' + p.displayName}
                        disabled={!foreign?.currencyCode}
                        value={foreign?.amount ?? ''}
                        onValueChange={(value) =>
                          set(
                            p.customerId,
                            foreign?.currencyCode ?? '',
                            value,
                            true,
                          )
                        }
                      />
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-4 border-t pt-3">
        <strong>{hotel ? 'جمع هتل:' : 'جمع قرارداد:'}</strong>
        {[...totals].map(([code, amount]) => (
          <span key={code}>
            <bdi>
              {formatSalesMoney(moneyDecimal(amount))} {currencySymbol(code)}
            </bdi>
          </span>
        ))}
      </div>
      {invalid && (
        <p role="alert" className="text-sm text-destructive">
          مبلغ معتبر با حداکثر چهار رقم اعشار وارد کنید.
        </p>
      )}
    </section>
  );
}
