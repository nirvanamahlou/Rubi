/** Insurance preparation is separate from confirmed provider issuance. */
export type InsurancePolicyStatusV1 =
  'DRAFT' | 'INPUT_ERROR' | 'PROVIDER_ERROR' | 'ISSUED' | 'CANCELLED';

export interface InsuranceRateBandV1 {
  minDays: number;
  maxDays: number;
  minAge: number;
  maxAge: number;
  amount: string;
  currencyCode: string;
}

export interface InsuranceCountryMappingV1 {
  countryId: string;
  providerCountryCode: string;
  providerCountryName: string;
  englishName: string;
  active: boolean;
  plans: {
    masterPlanId: string;
    providerPlanCode: string;
    title: string;
    rates: InsuranceRateBandV1[];
  }[];
}

export interface InsuranceConfigurationV1 {
  schemaVersion: 1;
  countries: InsuranceCountryMappingV1[];
}

export interface InsuranceDraftInputV1 {
  intakeId: string;
  customerId: string;
  destinationCode: string;
  planCode: string;
  departureDate: string;
  durationDays: number;
  notes: string;
  expectedVersion: number;
}

export interface InsurancePolicyRowV1 {
  id: string;
  intakeId: string;
  branchId: string;
  customerId: string;
  contractNumber: string;
  passengerName: string;
  policyNumber: string | null;
  status: InsurancePolicyStatusV1;
  destinationCode: string;
  planCode: string;
  departureDate: string;
  durationDays: number;
  amount: string | null;
  currencyCode: string | null;
  issuedAt: string | null;
  createdAt: string;
  cancelledAt: string | null;
  notes: string;
  version: number;
}
