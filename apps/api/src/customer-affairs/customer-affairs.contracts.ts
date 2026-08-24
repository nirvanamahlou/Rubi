export const CUSTOMER_AFFAIRS_CONTRACT_VERSION =
  'customer-affairs.v1-proposal' as const;
export const CUSTOMER_AFFAIRS_PHASE_A_NOTICE =
  'Phase A preview only; no controller, persistence, or cross-module mutation is active.' as const;

export type LeadStage =
  | 'NEW'
  | 'CONTACTED'
  | 'QUALIFYING'
  | 'NURTURE'
  | 'QUALIFIED'
  | 'HANDOFF_PROPOSED'
  | 'HANDED_OFF'
  | 'LOST';

export type LeadPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type LeadActivityType = 'CALL' | 'MESSAGE' | 'MEETING' | 'NOTE';
export type QualificationState =
  'NOT_STARTED' | 'NEEDS_REVIEW' | 'QUALIFIED' | 'DISQUALIFIED';

export interface MoneyDraft {
  amount: string;
  currencyCode: string;
}

export interface LeadListQuery {
  search: string;
  stage: LeadStage | 'ALL';
  priority: LeadPriority | 'ALL';
  assigneeReference: string | null;
  overdueOnly: boolean;
  sortBy: 'createdAt' | 'updatedAt' | 'nextActionAt' | 'priority';
  sortDirection: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export interface LeadSummary {
  id: string;
  title: string;
  sourceReference: string;
  inboundChannel: 'PHONE' | 'WEBSITE' | 'REFERRAL' | 'WALK_IN' | 'OTHER';
  travelNeed: string;
  destinationReference: string | null;
  approximateTravelStart: string | null;
  approximateTravelEnd: string | null;
  passengerCount: number;
  initialBudget: MoneyDraft | null;
  priority: LeadPriority;
  assigneeReference: string | null;
  stage: LeadStage;
  qualificationState: QualificationState;
  nextActionAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadDraft {
  title: string;
  sourceReference: string;
  inboundChannel: LeadSummary['inboundChannel'];
  travelNeed: string;
  destinationReference: string | null;
  approximateTravelStart: string | null;
  approximateTravelEnd: string | null;
  passengerCount: number;
  initialBudget: MoneyDraft | null;
  priority: LeadPriority;
  assigneeReference: string | null;
  nextActionAt: string | null;
}

export interface LeadActivity {
  id: string;
  leadId: string;
  type: LeadActivityType;
  occurredAt: string;
  nextActionAt: string | null;
  completed: boolean;
  summary: string;
  actorReference: string;
}

export interface QualificationResult {
  state: QualificationState;
  score: number;
  reasons: readonly string[];
  evaluatedAt: string;
}

export type TicketStatus =
  | 'NEW'
  | 'TRIAGED'
  | 'IN_PROGRESS'
  | 'WAITING_CUSTOMER'
  | 'WAITING_EXTERNAL'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REOPENED'
  | 'CANCELLED';

export type TicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
export type SLAState = 'ON_TRACK' | 'AT_RISK' | 'BREACHED' | 'PAUSED' | 'MET';

export type TicketCategory =
  | 'COMPLAINT'
  | 'PROFILE_CORRECTION'
  | 'CANCELLATION'
  | 'REFUND'
  | 'TICKET_ISSUE'
  | 'HOTEL_VOUCHER'
  | 'INSURANCE'
  | 'ADDITIONAL_SERVICE'
  | 'OTHER';

export interface CustomerReference {
  kind: 'CUSTOMER_REFERENCE_PROPOSAL';
  customerId: string;
  displayLabel?: string;
}

export interface SalesRequestReference {
  kind: 'SALES_REQUEST_REFERENCE_PROPOSAL';
  salesRequestId: string;
  contractId?: string;
  reservationId?: string;
  serviceReference?: string;
}

export interface SupportTicketSummary {
  id: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  assigneeReference: string | null;
  customerReference: CustomerReference | null;
  salesReference: SalesRequestReference | null;
  firstResponseDueAt: string;
  resolutionDueAt: string;
  firstRespondedAt: string | null;
  resolvedAt: string | null;
  slaState: SLAState;
  escalated: boolean;
  updatedAt: string;
}

export interface SupportTicketDraft {
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  assigneeReference: string | null;
  customerReference: CustomerReference | null;
  salesReference: SalesRequestReference | null;
  internalNote: string;
  customerReplyDraft: string;
}

export interface Escalation {
  id: string;
  ticketId: string;
  level: 1 | 2 | 3;
  reason: string;
  escalatedAt: string;
  escalatedByReference: string;
  targetReference: string;
  acknowledgedAt: string | null;
}

export interface Satisfaction {
  ticketId: string;
  score: 1 | 2 | 3 | 4 | 5;
  comment: string | null;
  submittedAt: string;
}

export type CustomerAffairsAction =
  | 'lead.read'
  | 'lead.create'
  | 'lead.update'
  | 'lead.qualify'
  | 'lead.handoff.propose'
  | 'ticket.read'
  | 'ticket.create'
  | 'ticket.update'
  | 'ticket.assign'
  | 'ticket.escalate'
  | 'ticket.close'
  | 'sla.manage'
  | 'satisfaction.read';

export const customerAffairsPermissionMatrix: Readonly<
  Record<CustomerAffairsAction, string>
> = {
  'lead.read': 'customer_affairs.lead.read',
  'lead.create': 'customer_affairs.lead.create',
  'lead.update': 'customer_affairs.lead.update',
  'lead.qualify': 'customer_affairs.lead.qualify',
  'lead.handoff.propose': 'customer_affairs.lead.handoff.propose',
  'ticket.read': 'customer_affairs.ticket.read',
  'ticket.create': 'customer_affairs.ticket.create',
  'ticket.update': 'customer_affairs.ticket.update',
  'ticket.assign': 'customer_affairs.ticket.assign',
  'ticket.escalate': 'customer_affairs.ticket.escalate',
  'ticket.close': 'customer_affairs.ticket.close',
  'sla.manage': 'customer_affairs.sla.manage',
  'satisfaction.read': 'customer_affairs.satisfaction.read',
};

export const customerAffairsEndpointProposals = {
  leads: '/api/v1/customer-affairs/leads',
  qualifyLead: '/api/v1/customer-affairs/leads/:leadId/qualification',
  proposeHandoff: '/api/v1/customer-affairs/leads/:leadId/handoff-proposal',
  activities: '/api/v1/customer-affairs/leads/:leadId/activities',
  tickets: '/api/v1/customer-affairs/tickets',
  ticketStatus: '/api/v1/customer-affairs/tickets/:ticketId/status',
  escalation: '/api/v1/customer-affairs/tickets/:ticketId/escalations',
  satisfaction: '/api/v1/customer-affairs/tickets/:ticketId/satisfaction',
} as const;

export function hasCustomerAffairsPermission(
  grantedPermissions: readonly string[],
  action: CustomerAffairsAction,
): boolean {
  const required = customerAffairsPermissionMatrix[action];
  return grantedPermissions.includes(required);
}
