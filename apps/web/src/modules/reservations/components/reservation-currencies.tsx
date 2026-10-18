'use client';
import { useEffect, useState } from 'react';
import { travelRequest } from './travel-workflow-form';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
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
    <NativeSearchSelect
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">انتخاب ارز</option>
      {value && !currencies.some((c) => c.code === value) && (
        <option value={value}>{currencySymbol(value)}</option>
      )}
      {currencies.map((c) => (
        <option key={c.code} value={c.code} aria-label={`${c.name} ${c.code}`}>
          {c.name} � {c.code} ({currencySymbol(c.code)})
        </option>
      ))}
    </NativeSearchSelect>
  );
}
