'use client';

import { useId } from 'react';
import { NativeSearchSelect } from '@/components/ui/native-search-select';

export interface UserUnitOption {
  id: string;
  name: string;
  branchId: string;
}

export function UserUnitSelect({
  value,
  units,
  branchIds,
  disabled,
  onChange,
}: {
  value: string;
  units: UserUnitOption[];
  branchIds: string[];
  disabled: boolean;
  onChange: (id: string) => void;
}) {
  const id = useId();
  const available = units.filter((unit) => branchIds.includes(unit.branchId));
  return (
    <div className="grid gap-2">
      <label htmlFor={id}>واحد سازمانی</label>
      <NativeSearchSelect
        id={id}
        aria-label="واحد سازمانی کاربر"
        value={value}
        disabled={disabled}
        optionLimit={available.length + 2}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">بدون واحد سازمانی</option>
        {value && !available.some((unit) => unit.id === value) && (
          <option value={value} disabled>
            واحد فعلی (غیرفعال یا خارج از شعب مجاز)
          </option>
        )}
        {available.map((unit) => (
          <option key={unit.id} value={unit.id}>
            {unit.name}
          </option>
        ))}
      </NativeSearchSelect>
      {!available.length && (
        <p className="text-xs text-muted-foreground">
          واحد فعالی برای شعب انتخاب‌شده موجود نیست.
        </p>
      )}
    </div>
  );
}
