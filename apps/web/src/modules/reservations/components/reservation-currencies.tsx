'use client';
import { useEffect, useState } from 'react';
import { travelRequest } from './travel-workflow-form';
import { SearchCombobox } from '@/components/ui/search-combobox';
import { currencySymbol } from '@/lib/currency-symbol';

export async function loadReservationCurrencies(requestId: string) {
  const currencies: { code: string; name: string }[] = [];
  let loaded = 0;
  for (let page = 1; ; page++) {
    const result = await travelRequest<{
      data: { code: string | null; name: string }[];
      meta: { total: number };
    }>(
      `reservations/requests/${encodeURIComponent(requestId)}/voucher-currencies?page=${page}`,
    );
    loaded += result.data.length;
    for (const record of result.data) {
      const code = record.code?.trim().toUpperCase();
      if (code && !currencies.some((c) => c.code === code))
        currencies.push({ code, name: record.name });
    }
    if (!result.data.length || loaded >= result.meta.total) return currencies;
  }
}
export function useReservationCurrencies(requestId: string) {
  const [state, setState] = useState({
    currencies: [] as { code: string; name: string }[],
    loading: true,
    error: '',
  });
  useEffect(() => {
    let live = true;
    void loadReservationCurrencies(requestId)
      .then((currencies) => {
        if (live) setState({ currencies, loading: false, error: '' });
      })
      .catch(() => {
        if (live)
          setState({
            currencies: [],
            loading: false,
            error: 'دریافت ارزها ناموفق بود.',
          });
      });
    return () => {
      live = false;
    };
  }, [requestId]);
  return state;
}
export function ReservationCurrencySelect({
  value,
  onChange,
  currencies,
  disabled,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  currencies: readonly { code: string; name: string }[];
  disabled: boolean;
  label: string;
}) {
  return (
    <SearchCombobox
      label={label}
      value={value}
      disabled={disabled}
      placeholder="انتخاب ارز"
      optionLimit={currencies.length + 2}
      onValueChange={onChange}
      options={[
        ...(value && !currencies.some((c) => c.code === value)
          ? [{ value, label: currencySymbol(value) }]
          : []),
        ...currencies.map((c) => ({
          value: c.code,
          label: `${c.name} · ${c.code} (${currencySymbol(c.code)})`,
          searchText: `${c.name} ${c.code}`,
        })),
      ]}
    />
  );
}
