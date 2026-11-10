import type { InsuranceCountryMappingV1 } from '@nora/contracts';
import type { InsuranceProviderCatalog, InsuranceReference } from './client';
type Country = InsuranceProviderCatalog['countries'][number];
export function matchInsuranceCountry(
  master: InsuranceReference,
  catalog: readonly Country[],
) {
  const code = String(master.attributes?.iso2Code || master.code)
    .trim()
    .toUpperCase();
  const matches = catalog.filter(
    (country) =>
      country.standardCode && country.standardCode.toUpperCase() === code,
  );
  return matches.length === 1 ? matches[0] : undefined;
}
export function insuranceCountryFields(
  country: Country,
  master?: InsuranceReference,
): Pick<
  InsuranceCountryMappingV1,
  'providerCountryCode' | 'providerCountryName' | 'englishName'
> {
  let englishName = '';
  const code = country.standardCode.trim().toUpperCase();
  if (
    master &&
    String(master.attributes?.iso2Code || master.code)
      .trim()
      .toUpperCase() === code
  )
    englishName = String(
      master.englishName || master.attributes?.englishName || '',
    ).trim();
  if (!englishName && /^[A-Z]{2}$/.test(code)) {
    const name = new Intl.DisplayNames(['en'], { type: 'region' }).of(code);
    if (name && name !== code) englishName = name;
  }
  return {
    providerCountryCode: String(country.id),
    providerCountryName: country.title,
    englishName,
  };
}
