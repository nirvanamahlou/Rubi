'use client';

import { Fragment } from 'react';
import {
  moneyDecimal,
  moneyUnits,
  flightRoomTotals,
  type SalesMoney,
} from '@nora/contracts';
import { MoneyInput, formatSalesMoney } from '@/components/ui/money-input';
import { currencySymbol } from '@/lib/currency-symbol';
import {
  defaultSalesCurrency,
  SalesCurrencySelect,
  type SalesCurrency,
} from './sales-currency-select';
import {
  salesHotelGuestIds,
  salesPassengerAgeLabel,
  salesPassengerFlightDirections,
  salesTravelDate,
  salesNetServicePrices,
  type SalesFormState,
} from '../model/sales-form';

type PriceField = 'passengerFlightPrices' | 'passengerHotelPrices';
export function PassengerServicePrices({
  state,
  currencies,
  onChange,
}: {
  state: SalesFormState;
  currencies: readonly SalesCurrency[];
  onChange: (
    patch: Partial<Pick<SalesFormState, PriceField | 'passengerDeductions'>>,
  ) => void;
}) {
  const guests = new Set(salesHotelGuestIds(state));
  const services = [
    ...(state.serviceKinds.includes('FLIGHT')
      ? [{ field: 'passengerFlightPrices' as const, label: 'پرواز' }]
      : []),
    ...(state.serviceKinds.includes('HOTEL')
      ? [{ field: 'passengerHotelPrices' as const, label: 'هتل' }]
      : []),
  ];
  if (!services.length) return null;
  const selected = (id: string, field: PriceField) =>
    field === 'passengerHotelPrices'
      ? guests.has(id)
      : salesPassengerFlightDirections(state, id).length > 0;
  const passengers = state.passengers.filter((p) =>
    services.some((s) => selected(p.customerId, s.field)),
  );
  let totals = new Map<string, bigint>();
  let invalid = false;
  const set = (id: string, field: PriceField, price: SalesMoney) =>
    onChange({ [field]: { ...state[field], [id]: [price] } });
  try {
    totals = new Map(
      flightRoomTotals(salesNetServicePrices(state), []).map((p) => [
        p.currencyCode,
        moneyUnits(p.amount),
      ]),
    );
  } catch {
    invalid = true;
  }
  return (
    <section className="space-y-3 rounded-xl border p-4">
      <h3 className="font-bold">قیمت پرواز و هتل هر مسافر</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted">
              <th className="p-2 text-right">مسافر</th>
              <th className="p-2">رده سنی</th>
              {services.map((s) => (
                <Fragment key={s.field}>
                  <th className="p-2">{'ارز ' + s.label}</th>
                  <th className="p-2">
                    {s.field === 'passengerHotelPrices'
                      ? 'قیمت ارزی'
                      : 'قیمت پرواز'}
                  </th>
                </Fragment>
              ))}
              <th className="p-2">تخفیف</th>
              <th className="p-2">کمیسیون</th>
            </tr>
          </thead>
          <tbody>
            {passengers.map((p, index) => (
              <tr key={p.customerId} className="border-b">
                <th className="p-2 text-right font-medium">
                  {index + 1}. {p.displayName}
                  <span className="block text-xs">
                    {salesPassengerFlightDirections(state, p.customerId)
                      .map((d) => (d === 'OUTBOUND' ? 'رفت' : 'برگشت'))
                      .join(' / ')}
                  </span>
                </th>
                <td className="p-2">
                  {salesPassengerAgeLabel(p.birthDate, salesTravelDate(state))}
                </td>
                {services.map((s) => {
                  if (!selected(p.customerId, s.field))
                    return (
                      <td key={s.field} colSpan={2} className="p-2 text-center">
                        —
                      </td>
                    );
                  const differentStay =
                    s.field === 'passengerHotelPrices' &&
                    state.passengerHotelStays?.[p.customerId]?.different;
                  const amountLabel =
                    s.field === 'passengerHotelPrices'
                      ? differentStay
                        ? 'مبلغ اقامت متفاوت'
                        : 'قیمت ارزی'
                      : 'قیمت پرواز';
                  const rows = state[s.field]?.[p.customerId] ?? [];
                  const price = rows.length === 1 ? rows[0] : undefined;
                  const code =
                    price?.currencyCode ?? defaultSalesCurrency(currencies);
                  return (
                    <Fragment key={s.field}>
                      <td className="min-w-40 p-2">
                        <SalesCurrencySelect
                          label={'ارز ' + s.label + ' ' + p.displayName}
                          currencies={currencies}
                          value={code}
                          onChange={(currencyCode) =>
                            set(p.customerId, s.field, {
                              currencyCode,
                              amount: price?.amount ?? '',
                            })
                          }
                        />
                      </td>
                      <td className="min-w-40 p-2">
                        {differentStay ? (
                          <span className="mb-1 block text-xs text-muted-foreground">
                            مبلغ اقامت متفاوت
                          </span>
                        ) : null}
                        <MoneyInput
                          aria-label={amountLabel + ' ' + p.displayName}
                          disabled={!code || rows.length > 1}
                          value={price?.amount ?? ''}
                          onValueChange={(amount) =>
                            set(p.customerId, s.field, {
                              currencyCode: code,
                              amount,
                            })
                          }
                        />
                        {rows.length > 1 && (
                          <p role="alert" className="text-xs text-destructive">
                            {rows
                              .map((r) => r.amount + ' ' + r.currencyCode)
                              .join(' + ')}
                            {' · برای جایگزینی مبالغ قبلی، ارز را انتخاب کنید.'}
                          </p>
                        )}
                      </td>
                    </Fragment>
                  );
                })}
                {(['discount', 'commission'] as const).map((kind) => {
                  const price =
                    state.passengerDeductions?.[p.customerId]?.[kind];
                  const label =
                    (kind === 'discount' ? 'تخفیف' : 'کمیسیون') +
                    ' ' +
                    p.displayName;
                  const currencyCode =
                    price?.currencyCode ??
                    state.passengerFlightPrices?.[p.customerId]?.[0]
                      ?.currencyCode ??
                    state.passengerHotelPrices?.[p.customerId]?.[0]
                      ?.currencyCode ??
                    defaultSalesCurrency(currencies);
                  const change = (patch: Partial<SalesMoney>) =>
                    onChange({
                      passengerDeductions: {
                        ...state.passengerDeductions,
                        [p.customerId]: {
                          ...state.passengerDeductions?.[p.customerId],
                          [kind]: {
                            amount: price?.amount ?? '',
                            currencyCode,
                            ...patch,
                          },
                        },
                      },
                    });
                  return (
                    <td key={kind} className="min-w-40 space-y-1 p-2">
                      <SalesCurrencySelect
                        label={'ارز ' + label}
                        currencies={currencies}
                        value={currencyCode}
                        onChange={(currencyCode) => change({ currencyCode })}
                      />
                      <MoneyInput
                        aria-label={label}
                        disabled={!currencyCode}
                        value={price?.amount ?? ''}
                        onValueChange={(amount) => change({ amount })}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-4 border-t pt-3">
        <strong>جمع پس از تخفیف و کمیسیون:</strong>
        {[...totals].map(([code, amount]) => (
          <bdi key={code}>
            {formatSalesMoney(moneyDecimal(amount))} {currencySymbol(code)}
          </bdi>
        ))}
      </div>
      {invalid && (
        <p role="alert">
          قیمت‌ها، تخفیف و کمیسیون را بررسی کنید؛ کسر مبلغ فقط در همان ارز و تا
          سقف قیمت همان مسافر مجاز است.
        </p>
      )}
    </section>
  );
}
