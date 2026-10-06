'use client';
import { SearchCombobox } from '@/components/ui/search-combobox';
import type { DestinationChoice } from './pack-destinations';
import styles from './rates.module.css';

export function PackDestinationFields({
  countries,
  cities,
  countryId,
  cityId,
  disabled,
  onCountryChange,
  onCityChange,
  onCitySearch,
}: {
  countries: readonly DestinationChoice[];
  cities: readonly DestinationChoice[];
  countryId: string;
  cityId: string;
  disabled: boolean;
  onCountryChange: (id: string) => void;
  onCityChange: (id: string) => void;
  onCitySearch: (search: string) => void;
}) {
  return (
    <div className={styles.destinationRow}>
      <h2>انتخاب کشور و شهر</h2>
      <div className={styles.destinationField}>
        <span>کشور</span>
        <SearchCombobox
          label="کشور بستهٔ هتل"
          placeholder="انتخاب کشور"
          value={countryId}
          disabled={disabled}
          options={countries.map((country) => ({
            value: country.id,
            label: country.name,
          }))}
          onValueChange={onCountryChange}
        />
      </div>
      <div className={styles.destinationField}>
        <span>شهر</span>
        <SearchCombobox
          label="شهر بستهٔ هتل"
          placeholder={countryId ? 'انتخاب شهر' : 'ابتدا کشور را انتخاب کنید'}
          value={cityId}
          disabled={disabled || !countryId}
          options={cities.map((city) => ({ value: city.id, label: city.name }))}
          onSearchChange={onCitySearch}
          onValueChange={onCityChange}
        />
      </div>
    </div>
  );
}
