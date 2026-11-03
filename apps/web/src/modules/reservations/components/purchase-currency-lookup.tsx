'use client';
import {
  useReservationCurrencies,
  ReservationCurrencySelect,
} from './reservation-currencies';
import type { Option } from '../hotel-rates/controls';
export function PurchaseCurrencyLookup({
  requestId,
  purchaseRoot,
  label,
  value,
  onChange,
}: {
  requestId: string;
  purchaseRoot: string;
  label: string;
  value: Option | null;
  onChange: (v: Option) => void;
}) {
  const list = useReservationCurrencies(requestId, purchaseRoot);
  return (
    <>
      <ReservationCurrencySelect
        label={label}
        value={value?.id ?? ''}
        currencies={list.currencies}
        disabled={list.loading}
        onChange={(code) =>
          onChange({
            id: code,
            name: list.currencies.find((c) => c.code === code)?.name ?? code,
          })
        }
      />
      {list.error && <p role="alert">{list.error}</p>}
    </>
  );
}
