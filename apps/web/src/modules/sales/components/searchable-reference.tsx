'use client';
import type { MasterDataRecord } from '@nora/contracts';
import { useId } from 'react';
import { FormField } from '@/components/ui/form-controls';
import { SearchCombobox } from '@/components/ui/search-combobox';
export function salesReferenceDisplayName(
  item: Pick<MasterDataRecord, 'name'> & Partial<MasterDataRecord>,
  preferEnglishName = false,
) {
  const englishName = item.attributes?.englishName;
  return (
    (preferEnglishName && typeof englishName === 'string' && englishName.trim()
      ? englishName.trim()
      : null) ?? item.name.trim()
  );
}

export function SearchableReference({
  label,
  value,
  options,
  onChange,
  disabled = false,
  preferEnglishName = false,
}: {
  label: string;
  value: string;
  options: readonly (Pick<MasterDataRecord, 'id' | 'name' | 'code'> &
    Partial<MasterDataRecord>)[];
  onChange: (value: string) => void;
  disabled?: boolean;
  showAllOptionsOnOpen?: boolean;
  preferEnglishName?: boolean;
}) {
  const id = useId();
  return (
    <FormField id={id} label={label} required>
      <SearchCombobox
        id={id}
        label={label}
        value={value}
        disabled={disabled}
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
        onValueChange={onChange}
      />
    </FormField>
  );
}
