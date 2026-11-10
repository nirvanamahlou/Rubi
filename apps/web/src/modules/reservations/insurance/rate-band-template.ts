import type {
  InsuranceConfigurationV1,
  InsuranceCountryMappingV1,
} from '@nora/contracts';

type Plan = InsuranceCountryMappingV1['plans'][number];

export function insuranceRateBandTemplate(
  config: InsuranceConfigurationV1,
  masterPlanId: string,
): Plan['rates'] {
  const plans = config.countries.flatMap((country) => country.plans);
  const source =
    plans.find(
      (plan) => plan.masterPlanId === masterPlanId && plan.rates.length,
    ) ?? plans.find((plan) => plan.rates.length);
  return source?.rates.map((rate) => ({ ...rate, amount: '' })) ?? [];
}

export function insuranceCountryPlanTemplates(
  config: InsuranceConfigurationV1,
  selectedCountryId: string,
): Plan[] {
  const source =
    config.countries.find(
      (country) =>
        country.countryId === selectedCountryId && country.plans.length,
    ) ?? config.countries.find((country) => country.plans.length);
  return (
    source?.plans.map((plan) => ({
      ...plan,
      rates: insuranceRateBandTemplate(config, plan.masterPlanId),
    })) ?? []
  );
}
