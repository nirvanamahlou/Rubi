import type {
  CustomerReference,
  LeadPriority,
  Satisfaction,
  SalesRequestReference,
  TicketCategory,
  TicketPriority,
} from './customer-affairs.contracts';

export const CUSTOMER_AFFAIRS_INTEGRATION_CONTRACT_VERSION =
  'customer-affairs.integration.v1-proposal' as const;

interface ProposalEnvelope<TType extends string, TPayload> {
  eventId: string;
  eventType: TType;
  version: 1;
  occurredAt: string;
  traceId: string;
  actorReference: string;
  aggregateId: string;
  persisted: false;
  payload: TPayload;
}

export type LeadQualified = ProposalEnvelope<
  'LeadQualified',
  {
    leadId: string;
    customerReference: CustomerReference | null;
    priority: LeadPriority;
    qualificationScore: number;
    destinationReference: string | null;
  }
>;

export type SalesHandoffRequested = ProposalEnvelope<
  'SalesHandoffRequested',
  {
    leadId: string;
    customerReference: CustomerReference;
    travelNeed: string;
    destinationReference: string | null;
    passengerCount: number;
  }
>;

export type CustomerSupportTicketOpened = ProposalEnvelope<
  'CustomerSupportTicketOpened',
  {
    ticketId: string;
    trackingNumber: string;
    customerReference: CustomerReference;
    category: TicketCategory;
    priority: TicketPriority;
  }
>;

export type ReservationIssueReported = ProposalEnvelope<
  'ReservationIssueReported',
  { ticketId: string; reference: SalesRequestReference; summary: string }
>;

export type RefundAssistanceRequested = ProposalEnvelope<
  'RefundAssistanceRequested',
  { ticketId: string; reference: SalesRequestReference; reason: string }
>;

export type CustomerSatisfactionRecorded = ProposalEnvelope<
  'CustomerSatisfactionRecorded',
  { satisfaction: Satisfaction; customerReference: CustomerReference }
>;

export type CustomerAffairsIntegrationProposal =
  | LeadQualified
  | SalesHandoffRequested
  | CustomerSupportTicketOpened
  | ReservationIssueReported
  | RefundAssistanceRequested
  | CustomerSatisfactionRecorded;

export function createIntegrationProposal<
  T extends CustomerAffairsIntegrationProposal,
>(proposal: Omit<T, 'persisted' | 'version'>): T {
  return { ...proposal, persisted: false, version: 1 } as T;
}
