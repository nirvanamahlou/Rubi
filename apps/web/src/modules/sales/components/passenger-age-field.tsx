'use client';

import { useId } from 'react';
import { FormField } from '@/components/ui/form-controls';
import { SearchCombobox } from '@/components/ui/search-combobox';

export function passengerAgeOptions(infant: boolean) {
  return [
    { value: '', label: 'انتخاب سن' },
    ...Array.from({ length: infant ? 2 : 10 }, (_, i) => {
      const age = infant ? i : i + 2;
      return {
        value: String(age),
        label:
          age === 0
            ? 'کمتر از ۱ سال'
            : `${age.toLocaleString('fa-IR')} تا کمتر از ${(age + 1).toLocaleString('fa-IR')} سال`,
        searchText: String(age),
      };
    }),
  ];
}

export function PassengerAgeField({
  label,
  value,
  onChange,
  infant = false,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  infant?: boolean;
}) {
  const id = useId();
  const options = passengerAgeOptions(infant);
  return (
    <FormField id={id} label={label}>
      <SearchCombobox
        id={id}
        label={label}
        value={value === null ? '' : String(value)}
        options={options}
        optionLimit={options.length}
        placeholder="انتخاب سن"
        className="h-12 text-base"
        onValueChange={(next) => {
          if (options.some((option) => option.value === next))
            onChange(next === '' ? null : Number(next));
        }}
      />
    </FormField>
  );
}
