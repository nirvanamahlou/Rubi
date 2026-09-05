export const B2B_CONTRACT_VERSION = 1 as const;
export const B2B_API_PREFIX = '/api/v1/b2b' as const;

export type AgencyOperationalStatus =
  'ACTIVE' | 'UNDER_REVIEW' | 'SUSPENDED' | 'ENDED';

export type B2bAgreementStatus =
  'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'TERMINATED';

export type B2bAgreedRateKind =
  'FIXED_AMOUNT' | 'DISCOUNT_PERCENT' | 'COMMISSION_PERCENT';

export interface B2bAgencyProfileV1 {
  id: string;
  organizationId: string;
  branchId: string;
  accountManagerUserId: string | null;
  status: AgencyOperationalStatus;
  displayOrder: number;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface B2bAgencyAgreementV1 {
  id: string;
  profileId: string;
  code: string;
  title: string;
  documentReference: string | null;
  startsAt: string;
  endsAt: string | null;
  status: B2bAgreementStatus;
  notes: string | null;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface B2bAgencyCreditPolicyV1 {
  id: string;
  profileId: string;
  creditLimit: string;
  currencyCode: string;
  effectiveFrom: string;
  expiresAt: string | null;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface B2bAgencyAgreedRateV1 {
  id: string;
  profileId: string;
  code: string;
  serviceReference: string;
  title: string;
  kind: B2bAgreedRateKind;
  value: string;
  currencyCode: string | null;
  validFrom: string;
  validTo: string | null;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type B2bFinanceExposureV1 =
  | {
      status: 'AVAILABLE';
      amount: string;
      currencyCode: string;
      observedAt: string;
      sourceVersion: number;
    }
  | {
      status: 'UNAVAILABLE';
      reason: 'FINANCE_PORT_UNAVAILABLE' | 'NO_EXPOSURE_SNAPSHOT';
    };

export interface B2bAgencyWorkspaceV1 {
  organization: {
    id: string;
    code: string;
    legalName: string;
    displayName: string;
    personType: string | null;
    logoFileReference: string | null;
    isActive: boolean;
    version: number;
  };
  primaryAddress: {
    id: string;
    label: string;
    countryId: string;
    countryName: string;
    cityId: string;
    cityName: string;
    postalCode: string | null;
    addressLine: string;
    version: number;
  } | null;
  profile: B2bAgencyProfileV1 | null;
  agreements: readonly B2bAgencyAgreementV1[];
  creditPolicy: B2bAgencyCreditPolicyV1 | null;
  agreedRates: readonly B2bAgencyAgreedRateV1[];
  financeExposure: B2bFinanceExposureV1;
}

export interface UpsertB2bAgencyProfileRequestV1 {
  branchId: string;
  accountManagerUserId?: string | null;
  status?: AgencyOperationalStatus;
  displayOrder?: number;
  version?: number;
}

export interface CreateB2bAgencyAgreementRequestV1 {
  branchId: string;
  title: string;
  documentReference?: string | null;
  startsAt: string;
  endsAt?: string | null;
  status?: B2bAgreementStatus;
  notes?: string | null;
}

export interface UpsertB2bAgencyCreditPolicyRequestV1 {
  branchId: string;
  creditLimit: string;
  currencyCode: string;
  effectiveFrom: string;
  expiresAt?: string | null;
  isActive?: boolean;
  version?: number;
}

export interface CreateB2bAgencyAgreedRateRequestV1 {
  branchId: string;
  serviceReference: string;
  title: string;
  kind: B2bAgreedRateKind;
  value: string;
  currencyCode?: string | null;
  validFrom: string;
  validTo?: string | null;
}

export interface FinancePartyExposureQueryV1 {
  organizationId: string;
  branchId: string;
  currencyCode: string | null;
}

export interface FinancePartyExposurePortV1 {
  getPartyExposure(
    query: FinancePartyExposureQueryV1,
  ): Promise<B2bFinanceExposureV1>;
}

export const b2bEndpoints = {
  agency: (organizationId: string) =>
    `${B2B_API_PREFIX}/agencies/${encodeURIComponent(organizationId)}` as const,
  agencyProfile: (organizationId: string) =>
    `${B2B_API_PREFIX}/agencies/${encodeURIComponent(organizationId)}/profile` as const,
  agencyAgreements: (organizationId: string) =>
    `${B2B_API_PREFIX}/agencies/${encodeURIComponent(organizationId)}/agreements` as const,
  agencyCreditPolicy: (organizationId: string) =>
    `${B2B_API_PREFIX}/agencies/${encodeURIComponent(organizationId)}/credit-policy` as const,
  agencyAgreedRates: (organizationId: string) =>
    `${B2B_API_PREFIX}/agencies/${encodeURIComponent(organizationId)}/agreed-rates` as const,
};
