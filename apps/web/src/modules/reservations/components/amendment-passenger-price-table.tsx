'use client';
import { useState } from 'react';
import {
  type SalesContractAmendmentV1,
  type SalesMoney,
  type PassengerDeductions,
} from '@nora/contracts';
import { MoneyInput } from '@/components/ui/money-input';
import {
  SalesCurrencySelect,
  type SalesCurrency,
} from '@/modules/sales/components/sales-currency-select';
import {
  amendmentPassengerGross,
  amendmentPricingRows,
  amendmentPricingDeductions,
  applyAmendmentPassengerPrices,
} from './amendment-passenger-prices';

export function AmendmentPassengerPriceTable({
  draft,
  currencies,
  onChange,
  onError,
}: {
  draft: SalesContractAmendmentV1;
  currencies: readonly SalesCurrency[];
  onChange: (next: SalesContractAmendmentV1) => void;
  onError: (message: string) => void;
}) {
  const [gross, setGross] = useState(() => amendmentPassengerGross(draft));
  const [currencyCodes, setCurrencyCodes] = useState<Record<string, string>>(
    {},
  );
  const [deductions, setDeductions] = useState(() =>
    amendmentPricingDeductions(draft),
  );
  const change = (
    prices: Record<string, SalesMoney[]>,
    values: PassengerDeductions,
  ) => {
    setGross(prices);
    setDeductions(values);
    try {
      onChange(applyAmendmentPassengerPrices(draft, prices, values));
      onError('');
    } catch (e) {
      onError(e instanceof Error ? e.message : 'مبلغ مسافر معتبر نیست.');
    }
  };
  const updatePrice = (id: string, code: string, amount: string) =>
    change(
      {
        ...gross,
        [id]: [
          ...(gross[id] ?? []).filter((v) => v.currencyCode !== code),
          ...(amount.trim() ? [{ currencyCode: code, amount }] : []),
        ],
      },
      deductions,
    );
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            {[
              'مسافر',
              'رده سنی',
              'قیمت ریالی',
              'قیمت ارزی',
              'تخفیف',
              'کمیسیون',
            ].map((t) => (
              <th key={t} className="p-2 text-start">
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {amendmentPricingRows(draft).map((p) => {
            const rows = gross[p.customerId] ?? [],
              rial = rows.find((v) => v.currencyCode === 'IRR');
            const foreign = rows.find((v) => v.currencyCode !== 'IRR');
            const code =
              currencyCodes[p.customerId] ??
              foreign?.currencyCode ??
              currencies.find((v) => v.code === 'USD')?.code ??
              currencies.find((v) => v.code !== 'IRR')?.code ??
              '';
            return (
              <tr key={p.customerId} className="border-t">
                <th className="p-2 text-start">{p.displayNameSnapshot}</th>
                <td className="p-2">
                  {p.ageCategory
                    ? ({ ADT: 'بزرگسال', CHD: 'کودک', INF: 'نوزاد' } as const)[
                        p.ageCategory
                      ]
                    : '—'}
                </td>
                <td className="min-w-32 p-2">
                  <MoneyInput
                    aria-label={'قیمت ریالی ' + p.displayNameSnapshot}
                    value={rial?.amount ?? ''}
                    onValueChange={(v) => updatePrice(p.customerId, 'IRR', v)}
                  />
                </td>
                <td className="min-w-36 space-y-1 p-2">
                  <SalesCurrencySelect
                    hideLabel
                    label={'ارز ' + p.displayNameSnapshot}
                    currencies={currencies.filter((v) => v.code !== 'IRR')}
                    value={code}
                    onChange={(currencyCode) => {
                      setCurrencyCodes((values) => ({
                        ...values,
                        [p.customerId]: currencyCode,
                      }));
                      change(
                        {
                          ...gross,
                          [p.customerId]: rows.map((v) =>
                            v.currencyCode === code
                              ? { ...v, currencyCode }
                              : v,
                          ),
                        },
                        deductions,
                      );
                    }}
                  />
                  <MoneyInput
                    aria-label={'قیمت ارزی ' + p.displayNameSnapshot}
                    value={foreign?.amount ?? ''}
                    onValueChange={(v) => updatePrice(p.customerId, code, v)}
                  />
                </td>
                {(['discount', 'commission'] as const).map((kind) => {
                  const price = deductions[p.customerId]?.[kind],
                    label = kind === 'discount' ? 'تخفیف' : 'کمیسیون';
                  const update = (part: Partial<SalesMoney>) =>
                    change(gross, {
                      ...deductions,
                      [p.customerId]: {
                        ...deductions[p.customerId],
                        [kind]: {
                          amount: price?.amount || '0',
                          currencyCode: price?.currencyCode ?? 'IRR',
                          ...part,
                        },
                      },
                    });
                  return (
                    <td key={kind} className="min-w-32 space-y-1 p-2">
                      <SalesCurrencySelect
                        hideLabel
                        label={label + ' ' + p.displayNameSnapshot}
                        currencies={currencies}
                        value={price?.currencyCode ?? 'IRR'}
                        onChange={(currencyCode) => update({ currencyCode })}
                      />
                      <MoneyInput
                        aria-label={label + ' ' + p.displayNameSnapshot}
                        value={price?.amount ?? ''}
                        onValueChange={(amount) =>
                          update({ amount: amount || '0' })
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
  );
}
