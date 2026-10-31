'use client';
import { currencySymbol } from '@/lib/currency-symbol';
import type { MasterDataRecord } from '@nora/contracts';
import { useId } from 'react';
import { FormField } from '@/components/ui/form-controls';
import { SearchCombobox } from '@/components/ui/search-combobox';
export function salesReferenceDisplayName(
  item: Pick<MasterDataRecord, 'name'> & Partial<MasterDataRecord>,
  preferEnglishName = false,
) {
  if (item.resource === 'currencies' && item.code)
    return currencySymbol(item.code);
  const englishName = item.attributes?.englishName;
  return (
    (preferEnglishName && typeof englishName === 'string' && englishName.trim()
      ? englishName.trim()
      : null) ?? item.name.trim()
  );
}

export function SearchableReference({
  label,
  hideLabel = false,
  value,
  options,
  onChange,
  disabled = false,
  loading = false,
  preferEnglishName = false,
  showAllOptionsOnOpen = false,
  required = true,
  onOpenChange,
}: {
  label: string;
  hideLabel?: boolean;
  value: string;
  options: readonly (Pick<MasterDataRecord, 'id' | 'name' | 'code'> &
    Partial<MasterDataRecord>)[];
  onChange: (value: string) => void;
  disabled?: boolean;
  loading?: boolean;
  required?: boolean;
  onOpenChange?: (open: boolean) => void;
  showAllOptionsOnOpen?: boolean;
  preferEnglishName?: boolean;
}) {
  const id = useId();
  return (
    <FormField
      id={id}
      label={label}
      labelClassName={hideLabel ? 'sr-only' : ''}
      required={required && !hideLabel}
    >
      <SearchCombobox
        id={id}
        label={label}
        value={value}
        disabled={disabled}
        loading={loading}
        placeholder={
          disabled ? 'ابتدا کشور را انتخاب کنید' : 'جست‌وجو و انتخاب…'
        }
        className="h-10 rounded-xl"
        options={options.map((item) => ({
          value: item.id,
          label: salesReferenceDisplayName(item, preferEnglishName),
          searchText:
            item.name +
            ' ' +
            item.code +
            ' ' +
            String(item.attributes?.englishName ?? ''),
        }))}
        optionLimit={showAllOptionsOnOpen ? Number.POSITIVE_INFINITY : 5}
        {...(onOpenChange ? { onOpenChange } : {})}
        onValueChange={onChange}
      />
    </FormField>
  );
}
