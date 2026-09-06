'use client';

import type {
  MasterDataRecord,
  SalesContractCreateRequest,
} from '@rubi/contracts';
import { SearchableReference } from './searchable-reference';

export type SalesCurrency = Pick<MasterDataRecord, 'code' | 'name' | 'status'>;
export const salesCurrencyOptions = (currencies: readonly SalesCurrency[]) =>
  currencies
    .filter(
      (currency) =>
        currency.status === 'active' && /^[A-Z]{3}$/.test(currency.code),
    )
    .filter(
      (currency, index, all) =>
        all.findIndex((item) => item.code === currency.code) === index,
    )
    .map((currency) => ({
      id: currency.code,
      name: `${currency.name} (${currency.code})`,
      code: currency.code,
    }));
export function defaultSalesCurrency(currencies: readonly SalesCurrency[]) {
  const options = salesCurrencyOptions(currencies);
  return options.find((item) => item.id === 'IRR')?.id ?? options[0]?.id ?? '';
}
export function validateSalesCurrencySelection(
  payload: Pick<SalesContractCreateRequest, 'priceComponents' | 'payments'>,
  currencies: readonly SalesCurrency[],
) {
  const codes = new Set(
    salesCurrencyOptions(currencies).map((item) => item.id),
  );
  for (const item of [...payload.priceComponents, ...(payload.payments ?? [])])
    if (!codes.has(item.currencyCode))
      throw new Error(
        'ارز قیمت‌ها و پرداخت‌ها را از فهرست ارزهای فعال انتخاب کنید.',
      );
}
export function SalesCurrencySelect({
  label,
  currencies,
  value,
  onChange,
}: {
  label: string;
  currencies: readonly SalesCurrency[];
  value: string;
  onChange: (value: string) => void;
}) {
  const options = salesCurrencyOptions(currencies);
  return (
    <div className="min-w-0 flex-1 space-y-1">
      <SearchableReference
        label={label}
        value={value}
        options={options}
        onChange={onChange}
      />
      {!options.length ? (
        <p role="status" className="text-xs text-muted-foreground">
          فهرست ارزهای فعال در دسترس نیست؛ اطلاعات پایه را بررسی کنید.
        </p>
      ) : value && !options.some((item) => item.id === value) ? (
        <p role="alert" className="text-xs text-destructive">
          ارز قبلی فعال نیست؛ دوباره انتخاب کنید.
        </p>
      ) : null}
    </div>
  );
}
