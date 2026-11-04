'use client';
import type { SalesMoney } from '@nora/contracts';
import { moneyUnits, moneyDecimal } from '@nora/contracts';
import { SalesMoneyInput } from './sales-money-input';
import {
  SalesCurrencySelect,
  type SalesCurrency,
} from './sales-currency-select';
import { currencySymbol } from '@/lib/currency-symbol';
import {
  legacyContractPriceComponents,
  type SalesFormState,
} from '../model/sales-form';

export function LegacyContractPrices({
  state,
  currencies,
  onChange,
}: {
  state: SalesFormState;
  currencies: readonly SalesCurrency[];
  onChange: (patch: Partial<SalesFormState>) => void;
}) {
  const prices = state.contractPrices ?? [];
  const rial = prices.find((p) => p.currencyCode === 'IRR');
  const foreign = prices.filter((p) => p.currencyCode !== 'IRR');
  const defaultForeign =
    currencies.find((c) => c.status === 'active' && c.code === 'USD') ??
    currencies.find((c) => c.status === 'active' && c.code !== 'IRR');
  const fx = foreign[0] ?? {
    amount: '',
    currencyCode: defaultForeign?.code ?? '',
  };
  const change = (kind: 'rial' | 'foreign', part: Partial<SalesMoney>) =>
    onChange({
      contractPrices:
        kind === 'rial'
          ? [
              ...foreign,
              { amount: rial?.amount ?? '', currencyCode: 'IRR', ...part },
            ]
          : [
              ...prices.filter((p) => p.currencyCode === 'IRR'),
              { ...fx, ...part },
            ],
    });
  let error = '';
  const totals = new Map<string, bigint>();
  try {
    for (const p of legacyContractPriceComponents(state))
      totals.set(
        p.currencyCode,
        (totals.get(p.currencyCode) ?? 0n) +
          moneyUnits(p.amount) * (p.type === 'DISCOUNT' ? -1n : 1n),
      );
  } catch (cause) {
    error = cause instanceof Error ? cause.message : '';
  }
  return (
    <section className="space-y-3 rounded-xl border p-4">
      <h3 className="font-bold">مبلغ کل قرارداد</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted">
              {['مشتری', 'قیمت ریالی', 'قیمت ارزی', 'تخفیف', 'کمیسیون'].map(
                (title) => (
                  <th className="p-2 text-start" key={title}>
                    {title}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            <tr className="align-top">
              <th scope="row" className="min-w-40 p-2 text-start font-medium">
                <bdi>{state.customerName}</bdi>
              </th>
              <td className="min-w-32 p-2">
                <span className="mb-1 block text-xs text-muted-foreground">
                  ریال (IRR)
                </span>
                <SalesMoneyInput
                  aria-label="قیمت ریالی"
                  currencyCode="IRR"
                  value={rial?.amount ?? ''}
                  onValueChange={(amount) => change('rial', { amount })}
                />
              </td>
              <td className="min-w-36 space-y-1 p-2">
                <SalesCurrencySelect
                  hideLabel
                  label="نوع ارز"
                  currencies={currencies.filter((c) => c.code !== 'IRR')}
                  value={fx.currencyCode}
                  onChange={(currencyCode) =>
                    change('foreign', { currencyCode })
                  }
                />
                <SalesMoneyInput
                  aria-label="قیمت ارزی"
                  currencyCode={fx.currencyCode}
                  value={foreign.length > 1 ? '' : fx.amount}
                  disabled={foreign.length > 1}
                  onValueChange={(amount) => change('foreign', { amount })}
                />
                {foreign.length > 1 && (
                  <p role="alert">
                    پیش‌نویس چند ارز دارد؛ نوع ارز و مبلغ ارزی جدید را مشخص
                    کنید.
                  </p>
                )}
              </td>
              {(['discount', 'commission'] as const).map((kind) => {
                const price = state.legacyDeductions?.[kind] ?? {
                  amount: '',
                  currencyCode: 'IRR',
                };
                const label = kind === 'discount' ? 'تخفیف' : 'کمیسیون';
                const update = (part: Partial<SalesMoney>) =>
                  onChange({
                    legacyDeductions: {
                      ...state.legacyDeductions,
                      [kind]: { ...price, ...part },
                    },
                  });
                return (
                  <td className="min-w-28 space-y-1 p-2" key={kind}>
                    <SalesCurrencySelect
                      hideLabel
                      label={'ارز ' + label}
                      currencies={currencies}
                      value={price.currencyCode}
                      onChange={(currencyCode) => update({ currencyCode })}
                    />
                    <SalesMoneyInput
                      aria-label={label}
                      currencyCode={price.currencyCode}
                      value={price.amount}
                      onValueChange={(amount) => update({ amount })}
                    />
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-4 border-t pt-3">
        <strong>جمع پس از تخفیف و کمیسیون:</strong>
        {[...totals].map(([code, amount]) => (
          <bdi key={code}>
            {moneyDecimal(amount)} {currencySymbol(code)}
          </bdi>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
