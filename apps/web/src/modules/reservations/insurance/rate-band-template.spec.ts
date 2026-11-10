import { expect, it } from 'vitest';
import type { InsuranceConfigurationV1 } from '@nora/contracts';
import {
  insuranceCountryPlanTemplates,
  insuranceRateBandTemplate,
} from './rate-band-template';
const rate = {
  minDays: 1,
  maxDays: 7,
  minAge: 0,
  maxAge: 12,
  amount: '100',
  currencyCode: 'IRR',
};
const config = {
  schemaVersion: 1,
  countries: [
    {
      countryId: 'tr',
      plans: [
        {
          masterPlanId: 'plan',
          providerPlanCode: '76',
          title: 'Festival',
          rates: [rate, { ...rate, minAge: 13, maxAge: 65, amount: '200' }],
        },
      ],
    },
  ],
} as InsuranceConfigurationV1;
it('copies age and duration bands for new countries without copying their prices or sharing state', () => {
  const plans = insuranceCountryPlanTemplates(config, 'tr');
  expect(plans[0]?.rates).toEqual(
    config.countries[0]!.plans[0]!.rates.map((r) => ({ ...r, amount: '' })),
  );
  plans[0]!.rates[0]!.minAge = 5;
  expect(rate.minAge).toBe(0);
  expect(config.countries[0]!.plans[0]!.rates[0]!.amount).toBe('100');
});
it('fills an empty existing country plan from the matching plan before other plans', () => {
  const other = structuredClone(config);
  other.countries[0]!.plans.unshift({
    masterPlanId: 'other',
    providerPlanCode: '77',
    title: 'Other',
    rates: [{ ...rate, maxAge: 99 }],
  });
  expect(insuranceRateBandTemplate(other, 'plan')[0]?.maxAge).toBe(12);
  expect(insuranceCountryPlanTemplates(other, 'missing')).toHaveLength(2);
});
it('keeps the first configuration empty when no previous bands exist', () => {
  expect(
    insuranceCountryPlanTemplates({ schemaVersion: 1, countries: [] }, ''),
  ).toEqual([]);
  expect(
    insuranceRateBandTemplate({ schemaVersion: 1, countries: [] }, 'plan'),
  ).toEqual([]);
});
