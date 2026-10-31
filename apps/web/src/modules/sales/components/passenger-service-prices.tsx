'use client';
import {
  moneyDecimal,
  moneyUnits,
  flightRoomTotals,
  type SalesMoney,
} from '@nora/contracts';
import { formatSalesMoney } from '@/components/ui/money-input';
import { SalesMoneyInput } from './sales-money-input';
import { currencySymbol } from '@/lib/currency-symbol';
import { useDisplayLanguage } from '@/i18n/locale-context';
import {
  SalesCurrencySelect,
  type SalesCurrency,
} from './sales-currency-select';
import { passengerHotelStay } from '../model/contract-guest-stays';
import { passengerTotalEntry } from '../model/passenger-total-entry';
import {
  salesHotelGuestIds,
  salesPassengerAgeLabel,
  salesPassengerFlightDirections,
  salesPassengerTransferDirections,
  salesAdditionalServices,
  salesTravelDate,
  salesNetServicePrices,
  salesHotelCalendarSystem,
  type SalesFormState,
} from '../model/sales-form';

export function PassengerServicePrices({
  state,
  currencies,
  onChange,
}: {
  state: SalesFormState;
  currencies: readonly SalesCurrency[];
  onChange: (
    patch: Partial<
      Pick<SalesFormState, 'passengerPrices' | 'passengerDeductions'>
    >,
  ) => void;
}) {
  const language = useDisplayLanguage();
  if (!state.serviceKinds.some((s) => s === 'FLIGHT' || s === 'HOTEL'))
    return null;
  const guests = new Set(salesHotelGuestIds(state));
  const foreignCurrencies = currencies.filter((c) => c.code !== 'IRR');
  const calendar = salesHotelCalendarSystem(state);
  const date = (v: string) =>
    v && Number.isFinite(Date.parse(v))
      ? new Intl.DateTimeFormat(
          language === 'en' || calendar === 'gregorian' ? 'en-GB' : 'fa-IR',
          {
            timeZone: 'UTC',
            dateStyle: 'medium',
            calendar: calendar === 'gregorian' ? 'gregory' : 'persian',
          },
        ).format(new Date(v))
      : '—';
  let totals: SalesMoney[] = [],
    invalid = '';
  try {
    totals = flightRoomTotals(
      salesNetServicePrices({ ...state, passengerTotalPricing: true }),
      [],
    );
  } catch (e) {
    invalid =
      e instanceof Error
        ? e.message
        : 'قیمت ریالی و ارزی مسافران را بررسی کنید.';
  }
  const servicesFor = (id: string) => [
    ...state.serviceKinds.flatMap((kind) => {
      if (kind === 'FLIGHT') {
        const dirs = salesPassengerFlightDirections(state, id);
        return dirs.length
          ? [
              'پرواز ' +
                dirs
                  .map((d) => (d === 'OUTBOUND' ? 'رفت' : 'برگشت'))
                  .join(' و '),
            ]
          : [];
      }
      if (kind === 'HOTEL') return guests.has(id) ? ['هتل'] : [];
      if (kind === 'TRANSFER') {
        const dirs = salesPassengerTransferDirections(state, id);
        return dirs.length
          ? [
              'ترانسفر ' +
                dirs
                  .map((d) => (d === 'OUTBOUND' ? 'رفت' : 'برگشت'))
                  .join(' و '),
            ]
          : [];
      }
      if (
        kind === 'VISA' &&
        state.visaComposition &&
        !state.visaApplicantIds?.includes(id)
      )
        return [];
      return [
        {
          VISA: 'ویزا',
          TRANSFER: 'ترانسفر',
          INSURANCE: 'بیمه',
          TOUR: 'تور',
          BUS: 'اتوبوس',
          TRAIN: 'قطار',
          CIP: 'CIP',
          OTHER: 'سایر خدمات',
        }[kind] ?? kind,
      ];
    }),
    ...(state.additionalServices ?? []).map(
      (role) => salesAdditionalServices[role],
    ),
  ];
  return (
    <section className="space-y-3 rounded-xl border p-4">
      <h3 className="font-bold">قیمت کل خدمات هر مسافر</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted">
              {[
                'مسافر',
                'خدمات',
                'چک‌این هتل',
                'چک‌اوت هتل',
                'قیمت ریالی',
                'قیمت ارزی',
                'تخفیف',
                'کمیسیون',
              ].map((title) => (
                <th key={title} className="p-2 text-start whitespace-nowrap">
                  {title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {state.passengers.map((p, index) => {
              let rows: SalesMoney[] = [],
                rowError = '';
              try {
                rows = passengerTotalEntry(state, p.customerId);
              } catch {
                rowError = 'مبلغ قیمت ریالی و ارزی معتبر نیست.';
              }
              const rial = rows.find((r) => r.currencyCode === 'IRR');
              const foreign = rows.filter((r) => r.currencyCode !== 'IRR');
              const fx = foreign[0] ?? { amount: '', currencyCode: 'USD' };
              const change = (
                kind: 'rial' | 'foreign',
                part: Partial<SalesMoney>,
              ) => {
                const updated =
                  kind === 'rial'
                    ? [
                        ...rows.filter((r) => r.currencyCode !== 'IRR'),
                        {
                          amount: rial?.amount ?? '',
                          currencyCode: 'IRR',
                          ...part,
                        },
                      ]
                    : [
                        ...rows.filter((r) => r.currencyCode === 'IRR'),
                        {
                          ...fx,
                          ...(foreign.length > 1 ? { amount: '' } : {}),
                          ...part,
                        },
                      ];
                onChange({
                  passengerPrices: {
                    ...state.passengerPrices,
                    [p.customerId]: updated,
                  },
                });
              };
              const stay = passengerHotelStay(
                guests.has(p.customerId),
                state.hotel,
                state.passengerHotelStays?.[p.customerId],
              );
              return (
                <tr
                  key={p.customerId}
                  className="border-b align-top"
                  aria-label={`قیمت‌های مسافر ${index + 1}`}
                >
                  <th
                    scope="row"
                    className="min-w-40 p-2 text-start font-medium"
                  >
                    <bdi className="block leading-6">
                      {p.displayName.trim()}
                    </bdi>
                    <span className="text-xs text-muted-foreground">
                      {salesPassengerAgeLabel(
                        p.birthDate,
                        salesTravelDate(state),
                        p.ageCategory,
                      )}
                    </span>
                  </th>
                  <td className="min-w-24 p-2">
                    {servicesFor(p.customerId).map((s) => (
                      <div key={s}>{s}</div>
                    ))}
                    {stay?.different ? (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        اقامت متفاوت
                      </span>
                    ) : null}
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    {stay ? (
                      <time dateTime={stay.checkIn}>{date(stay.checkIn)}</time>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    {stay ? (
                      <time dateTime={stay.checkOut}>
                        {date(stay.checkOut)}
                      </time>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="min-w-32 p-2">
                    <span className="mb-1 block text-xs text-muted-foreground">
                      ریال (IRR)
                    </span>
                    <SalesMoneyInput
                      currencyCode="IRR"
                      aria-label="قیمت ریالی"
                      value={rial?.amount ?? ''}
                      onValueChange={(amount) => change('rial', { amount })}
                    />
                  </td>
                  <td className="min-w-36 space-y-1 p-2">
                    <SalesCurrencySelect
                      hideLabel
                      label="نوع ارز"
                      currencies={foreignCurrencies}
                      value={fx.currencyCode}
                      onChange={(currencyCode) =>
                        change('foreign', { currencyCode })
                      }
                    />
                    <SalesMoneyInput
                      currencyCode={fx.currencyCode}
                      aria-label="قیمت ارزی"
                      value={foreign.length > 1 ? '' : fx.amount}
                      disabled={foreign.length > 1}
                      onValueChange={(amount) => change('foreign', { amount })}
                    />
                    {foreign.length > 1 && (
                      <p role="alert" className="text-xs text-destructive">
                        پیش‌نویس چند ارز دارد؛ نوع ارز و مبلغ ارزی جدید را مشخص
                        کنید.
                      </p>
                    )}
                    {rowError && <p role="alert">{rowError}</p>}
                  </td>
                  {(['discount', 'commission'] as const).map((kind) => {
                    const price =
                      state.passengerDeductions?.[p.customerId]?.[kind];
                    const label = kind === 'discount' ? 'تخفیف' : 'کمیسیون';
                    const currencyCode = price?.currencyCode ?? 'IRR';
                    const changeDeduction = (part: Partial<SalesMoney>) =>
                      onChange({
                        passengerDeductions: {
                          ...state.passengerDeductions,
                          [p.customerId]: {
                            ...state.passengerDeductions?.[p.customerId],
                            [kind]: {
                              amount: price?.amount ?? '',
                              currencyCode,
                              ...part,
                            },
                          },
                        },
                      });
                    return (
                      <td key={kind} className="min-w-28 space-y-1 p-2">
                        <SalesCurrencySelect
                          hideLabel
                          label={'ارز ' + label}
                          currencies={currencies}
                          value={currencyCode}
                          onChange={(currencyCode) =>
                            changeDeduction({ currencyCode })
                          }
                        />
                        <SalesMoneyInput
                          currencyCode={currencyCode}
                          aria-label={label}
                          value={price?.amount ?? ''}
                          onValueChange={(amount) =>
                            changeDeduction({ amount })
                          }
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-4 border-t pt-3">
        <strong>جمع پس از تخفیف و کمیسیون:</strong>
        {totals.map((p) => (
          <bdi key={p.currencyCode}>
            {formatSalesMoney(moneyDecimal(moneyUnits(p.amount)))}{' '}
            {currencySymbol(p.currencyCode)}
          </bdi>
        ))}
      </div>
      {invalid && (
        <p role="alert" className="text-sm text-destructive">
          {invalid}
        </p>
      )}
    </section>
  );
}
