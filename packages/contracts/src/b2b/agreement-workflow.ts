export type B2bCooperationRole = 'AGENCY' | 'CORPORATE_CUSTOMER';
export type B2bReviewStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';
export const B2B_SERVICE_CODES = [
  'FLIGHT',
  'HOTEL',
  'TOUR',
  'VISA',
  'INSURANCE',
  'RAIL',
  'BUS',
  'OTHER',
] as const;
export interface B2bCreditDraftV1 {
  currencyCode: string;
  creditLimit: string;
  limitType: 'HARD' | 'SOFT';
  dueDays: number;
  overdueAction: 'BLOCK' | 'WARN';
  effectiveFrom: string;
  expiresAt: string | null;
}
export interface B2bGuaranteeDraftV1 {
  kind: 'BANK_GUARANTEE' | 'CHEQUE' | 'DEPOSIT_REQUIREMENT' | 'OTHER';
  reference: string;
  amount: string;
  currencyCode: string;
  issuer: string;
  receivedAt: string;
  expiresAt: string | null;
  status: 'REQUIRED' | 'RECEIVED';
  documentId: string | null;
  documentVersionId?: string | null;
}
export interface B2bAgreementTermsV1 {
  title: string;
  agreementType: 'FRAMEWORK' | 'AGENCY' | 'CORPORATE';
  startsAt: string;
  endsAt: string | null;
  currencyCodes: string[];
  services: (typeof B2B_SERVICE_CODES)[number][];
  paymentMethod: 'PREPAID' | 'CREDIT' | 'MIXED';
  settlementCycle: 'PER_ORDER' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
  settlementDays: number;
  cutoffDay: number | null;
  slaHours: number | null;
  cancellationTerms: string;
  refundTerms: string;
  notes: string;
  changeReason: string;
  documentId: string | null;
  documentVersionId?: string | null;
  creditPolicies: B2bCreditDraftV1[];
  guarantees: B2bGuaranteeDraftV1[];
}
export interface B2bAgreementRevisionV1 extends B2bAgreementTermsV1 {
  id: string;
  number: number;
  status: B2bReviewStatus;
  createdByUserId: string;
  submittedByUserId: string | null;
  reviewedByUserId: string | null;
  createdAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewReason: string | null;
}
export interface B2bAgreementCaseV1 {
  id: string;
  organizationId: string;
  branchId: string;
  role: B2bCooperationRole;
  code: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  status: string;
  version: number;
  activeRevisionId: string | null;
  revisions: B2bAgreementRevisionV1[];
}
export interface SaveB2bAgreementTermsRequestV1 {
  branchId: string;
  role: B2bCooperationRole;
  requestId: string;
  version?: number;
  terms: B2bAgreementTermsV1;
}
export interface B2bAgreementActionRequestV1 {
  branchId: string;
  role: B2bCooperationRole;
  requestId: string;
  version: number;
  reason: string;
  decision?: 'APPROVE' | 'REJECT';
}
