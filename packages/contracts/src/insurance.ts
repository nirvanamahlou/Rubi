import type { SalesReservationRequestV1 } from './sales';

export function insurancePassengerIds(
  snapshot: SalesReservationRequestV1,
  automaticOnly = false,
) {
  const keys = new Set(
    snapshot.serviceSelections
      .filter(
        (s) =>
          s.kind === 'INSURANCE' &&
          (!automaticOnly || s.metadata?.insuranceAutomaticIssue === true),
      )
      .map((s) => s.clientKey),
  );
  return [
    ...new Set(
      (snapshot.passengerAssignments ?? [])
        .filter(
          (p) =>
            snapshot.passengerIds.includes(p.customerId) &&
            p.serviceClientKeys.some((key) => keys.has(key)),
        )
        .map((p) => p.customerId),
    ),
  ];
}

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

export interface InsurancePassengerInputV1 {
  version: number;
  firstName: string;
  lastName: string;
  firstNameLatin: string;
  lastNameLatin: string;
  nationalityCode: string;
  nationalCode: string;
  passportNo: string;
  birthDate: string;
  gender: 'M' | 'F';
  mobile: string;
  email: string;
}

export interface InsuranceDraftInputV1 {
  passenger?: InsurancePassengerInputV1;
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
  standalone?: boolean;
  automatic?: boolean;
  sandbox?: boolean;
  lastError?: string | null;
  id: string;
  intakeId: string | null;
  branchId: string;
  customerId: string | null;
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

/** A real standalone applicant; no synthetic Sales/Customer identifiers. */
export interface InsuranceStandaloneInputV1 {
  branchId: string;
  requestKey: string;
  sourceCountryCode: string;
  destinationCode: string;
  planCode: string;
  departureDate: string;
  durationDays: number;
  notes: string;
  expectedVersion: number;
  passenger: InsurancePassengerInputV1;
}
