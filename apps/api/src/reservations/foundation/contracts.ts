/** Module-local V1 proposals. Publish/map only after the Sales shared-contract handoff. */
export const RESERVATIONS_FOUNDATION_VERSION =
  'reservations.v1-proposal' as const;
export const permissions = [
  'reservations.read',
  'reservations.create',
  'reservations.assign',
  'reservations.update',
  'reservations.issue.ticket',
  'reservations.stop.ticket',
  'reservations.hotel.request',
  'reservations.hotel.confirm',
  'reservations.issue.voucher',
  'reservations.insurance.issue',
  'reservations.manifest.manage',
  'reservations.cost.manage',
  'reservations.audit.read',
  'reservations.release.read',
  'reservations.deliver',
] as const;
export type Permission = (typeof permissions)[number];
export interface Actor {
  actorId: string;
  authenticated: boolean;
  branchIds: readonly string[];
  permissions: readonly string[];
  /** Resolved server-side from Legal Entity public service, never request-body claims. */
  issuer: LegalEntityIssuanceContextV1 | { mode: 'ALL' };
}
export interface LegalEntityIssuanceContextV1 {
  mode: 'SINGLE';
  legalEntityId: string;
  active: boolean;
  brandingSnapshotId: string;
  brandingVersion: number;
}
export interface CustomerPassengerReferenceV1 {
  passengerId: string;
  customerId: string | null;
  displayName: string;
  /** Completeness only; identity numbers are resolved privately by the owning port. */
  informationComplete: boolean;
}
export type ServiceKind =
  'FLIGHT' | 'TRAIN' | 'BUS' | 'HOTEL' | 'INSURANCE' | 'OTHER';
export interface TravelSegment {
  segmentId: string;
  originId: string;
  destinationId: string;
  departureAt: string;
  carrierId: string;
  transportNumber: string;
}
export interface ServiceLine {
  serviceLineId: string;
  kind: ServiceKind;
  passengerIds: readonly string[];
  segments: readonly TravelSegment[];
  offerId?: string;
  hotel?: {
    hotelId: string;
    checkIn: string;
    checkOut: string;
    rooms: readonly {
      roomId: string;
      roomTypeId: string;
      passengerIds: readonly string[];
    }[];
    passengerRequests: string;
  };
  insurance?: {
    countryId: string;
    startsAt: string;
    endsAt: string;
    planId: string;
  };
}
export interface SalesReservationRequestV1 {
  version: 1;
  requestId: string;
  contractId: string;
  contractNumber: string;
  contractVersion: number;
  branchId: string;
  legalEntityId: string;
  salesCounterId: string;
  customerId: string;
  customerDisplayName: string;
  passengers: readonly CustomerPassengerReferenceV1[];
  services: readonly ServiceLine[];
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
  dueAt: string;
  createdAt: string;
}
export interface TicketOfferReferenceV1 {
  offerId: string;
  version: number;
  branchId: string;
  active: boolean;
  companyOwned: boolean;
  availableCapacity: number;
  checkedAt: string;
  /** Allocation confirmed through Catalog, not invented from availableCapacity. */
  allocation?: {
    contractId: string;
    serviceLineId: string;
    passengerIds: readonly string[];
  };
}
export interface MasterDataTravelReferenceV1 {
  id: string;
  kind: 'HOTEL' | 'AGENT' | 'LEADER' | 'COUNTRY' | 'PLAN';
  active: boolean;
}
export interface ManifestTemplateV1 {
  templateId: string;
  version: number;
  carrierId: string;
  active: boolean;
}
export interface FinanceReleaseProjectionV1 {
  version: 1;
  projectionVersion: number;
  contractId: string;
  branchId: string;
  documentIds: readonly string[];
  status: 'BLOCKED' | 'CONDITIONAL' | 'APPROVED';
  checkedAt: string;
  expiresAt: string | null;
}
export interface DecimalMoney {
  amount: string;
  currencyCode: string;
}
export interface ReservationPurchaseCostProposalV1 {
  version: 1;
  contractId: string;
  serviceLineId: string;
  supplierId: string;
  initial: DecimalMoney;
  discount: DecimalMoney;
  fees: DecimalMoney;
  net: DecimalMoney;
  fxReference?: { rate: string; sourceId: string; validAt: string };
  actorId: string;
  occurredAt: string;
}
export interface DocumentGenerationRequestV1 {
  version: 1;
  requestId: string;
  contractId: string;
  serviceLineId: string;
  kind: 'TICKET' | 'VOUCHER' | 'INSURANCE' | 'MANIFEST';
  issuer: LegalEntityIssuanceContextV1;
  delivery: 'BLOCKED_UNTIL_FINANCE_RELEASE';
  /** Semantic reference only; renderer/storage owned by later Worker/Documents integration. */
  operationId: string;
}
export interface ReservationStatusEventV1 {
  version: 1;
  aggregateId: string;
  aggregateVersion: number;
  actorId: string;
  occurredAt: string;
  action: string;
  from: string;
  to: string;
  outcome: 'ALLOWED' | 'DENIED';
  reasonCode?: string;
}
export interface InsuranceSubmissionV1 {
  operationId: string;
  idempotencyKey: string;
  contractId: string;
  serviceLineId: string;
  passengerId: string;
  countryId: string;
  startsAt: string;
  endsAt: string;
  planId: string;
}
export type InsuranceProviderResult =
  | { status: 'NOT_CONFIGURED' }
  | { status: 'SUBMITTED'; providerReference: string }
  | { status: 'ISSUED'; providerReference: string; policyNumber: string }
  | {
      status: 'FAILED';
      retryable: boolean;
      reasonCode: 'REJECTED' | 'UNAVAILABLE';
    }
  | { status: 'UNKNOWN' };
export interface SamanInsuranceProviderPortV1 {
  readonly configuration: 'CONFIGURED' | 'NOT_CONFIGURED';
  submit(input: InsuranceSubmissionV1): Promise<InsuranceProviderResult>;
  reconcile(
    input: Pick<InsuranceSubmissionV1, 'operationId' | 'idempotencyKey'>,
  ): Promise<InsuranceProviderResult>;
}
export interface HotelSupplierCommunicationPortV1 {
  send(input: {
    operationId: string;
    idempotencyKey: string;
    contractId: string;
    serviceLineId: string;
    supplierId: string;
  }): Promise<
    | { status: 'NOT_CONFIGURED' }
    | { status: 'SENT'; communicationReference: string }
  >;
}
export interface ReservationStatusPortV1 {
  publish(event: ReservationStatusEventV1): Promise<void>;
}
