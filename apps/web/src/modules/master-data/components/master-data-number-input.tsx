'use client';

import { useState, type InputHTMLAttributes } from 'react';

import { Input } from '@/components/ui/form-controls';

export function normalizeMasterDataNumber(value: string): string {
  const persian = '۰۱۲۳۴۵۶۷۸۹';
  const arabic = '٠١٢٣٤٥٦٧٨٩';
  return [...value.replaceAll(',', '').replaceAll('٬', '').trim()]
    .map((character) => {
      const persianIndex = persian.indexOf(character);
      if (persianIndex >= 0) return String(persianIndex);
      const arabicIndex = arabic.indexOf(character);
      return arabicIndex >= 0 ? String(arabicIndex) : character;
    })
    .join('');
}

export function formatMasterDataNumber(value: string): string {
  const normalized = normalizeMasterDataNumber(value);
  if (!normalized || !/^-?\d*(?:\.\d*)?$/.test(normalized)) return value;
  const [integer = '', decimal] = normalized.split('.');
  const sign = integer.startsWith('-') ? '-' : '';
  const digits = sign ? integer.slice(1) : integer;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}${grouped}${decimal === undefined ? '' : `.${decimal}`}`;
}

export function MasterDataNumberInput({
  onChange,
  value,
  ...props
}: Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange'
> & {
  onChange: (value: string) => void;
  value: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Input
      {...props}
      inputMode="decimal"
      onBlur={(event) => {
        setFocused(false);
        props.onBlur?.(event);
      }}
      onChange={(event) =>
        onChange(normalizeMasterDataNumber(event.target.value))
      }
      onFocus={(event) => {
        setFocused(true);
        props.onFocus?.(event);
      }}
      type="text"
      value={
        focused
          ? normalizeMasterDataNumber(value)
          : formatMasterDataNumber(value)
      }
    />
  );
}
