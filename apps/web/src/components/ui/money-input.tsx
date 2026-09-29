'use client';
import { useLayoutEffect, useRef, type ComponentProps } from 'react';
import { Input } from '@/components/ui/form-controls';
export function cleanSalesMoney(value: string) {
  return value
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[,٬\s]/g, '')
    .replace(/٫/g, '.');
}
export function formatSalesMoney(value: string) {
  const [whole = '', ...fraction] = value.split('.');
  return (
    whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') +
    (fraction.length ? '.' + fraction.join('.') : '')
  );
}
export function MoneyInput({
  value,
  onValueChange,
  ...props
}: Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> & {
  value: string;
  onValueChange: (value: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const cursor = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (cursor.current === null || !ref.current) return;
    const formatted = formatSalesMoney(value);
    let remaining = cursor.current,
      offset = 0;
    while (offset < formatted.length && remaining > 0) {
      if (formatted[offset] !== ',') remaining--;
      offset++;
    }
    ref.current.setSelectionRange(offset, offset);
    cursor.current = null;
  }, [value]);
  return (
    <Input
      {...props}
      ref={ref}
      type="text"
      dir="ltr"
      inputMode="decimal"
      value={formatSalesMoney(value)}
      onChange={(event) => {
        const raw = cleanSalesMoney(event.target.value);
        if (!/^\d{0,18}(?:\.\d{0,4})?$/.test(raw)) return;
        cursor.current = cleanSalesMoney(
          event.target.value.slice(
            0,
            event.target.selectionStart ?? event.target.value.length,
          ),
        ).length;
        onValueChange(raw);
      }}
    />
  );
}
