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

export interface PaginatedResult<T> {
  data: readonly T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
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
  customerReference: CustomerReference | null;
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
  customerReference: CustomerReference | null;
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
  | 'QUESTION'
  | 'COMPLAINT'
  | 'PROFILE_CORRECTION'
  | 'CANCELLATION'
  | 'REFUND'
  | 'TICKET_ISSUE'
  | 'HOTEL_VOUCHER'
  | 'INSURANCE'
  | 'ADDITIONAL_SERVICE'
  | 'SERVICE_ISSUE'
  | 'OTHER';

export type TicketInteractionType =
  | 'CUSTOMER_MESSAGE'
  | 'OUTBOUND_REPLY'
  | 'PHONE_CALL'
  | 'INTERNAL_NOTE'
  | 'ASSIGNMENT'
  | 'STATUS_CHANGE'
  | 'ESCALATION'
  | 'SATISFACTION';

export interface TicketInteraction {
  id: string;
  ticketId: string;
  type: TicketInteractionType;
  occurredAt: string;
  actorReference: string;
  summary: string;
  customerVisible: boolean;
}

export const ticketSortFields = [
  'createdAt',
  'updatedAt',
  'firstResponseDueAt',
  'resolutionDueAt',
  'priority',
  'status',
] as const;

export type TicketSortField = (typeof ticketSortFields)[number];

export interface TicketListQuery {
  search: string;
  status: TicketStatus | 'ALL';
  category: TicketCategory | 'ALL';
  priority: TicketPriority | 'ALL';
  assigneeReference: string | null;
  slaState: SLAState | 'ALL';
  overdueOnly: boolean;
  sortBy: TicketSortField;
  sortDirection: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

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
  ticketDocumentId?: string;
  voucherDocumentId?: string;
  insurancePolicyId?: string;
}

export interface SupportTicketSummary {
  id: string;
  trackingNumber: string;
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
  escalationLevel: 1 | 2 | 3 | null;
  closedAt: string | null;
  closeReason: string | null;
  resolutionOutcome: string | null;
  reopenCount: number;
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

export interface TicketClosure {
  ticketId: string;
  resolutionOutcome: string;
  closeReason: string;
  closedAt: string;
  closedByReference: string;
}

export type TicketReopenReason =
  | 'CUSTOMER_REPORTED_UNRESOLVED'
  | 'NEW_RELATED_EVIDENCE'
  | 'INCORRECT_RESOLUTION'
  | 'SERVICE_REGRESSION';

export interface TicketReopenRequest {
  reason: TicketReopenReason;
  note: string;
  expectedVersion: number;
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
  | 'ticket.reopen'
  | 'sla.manage'
  | 'satisfaction.read'
  | 'satisfaction.record';

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
  'ticket.reopen': 'customer_affairs.ticket.reopen',
  'sla.manage': 'customer_affairs.sla.manage',
  'satisfaction.read': 'customer_affairs.satisfaction.read',
  'satisfaction.record': 'customer_affairs.satisfaction.record',
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
  reopenTicket: '/api/v1/customer-affairs/tickets/:ticketId/reopen',
} as const;

export const leadSortFields = [
  'createdAt',
  'updatedAt',
  'nextActionAt',
  'priority',
] as const satisfies readonly LeadListQuery['sortBy'][];

export function hasCustomerAffairsPermission(
  grantedPermissions: readonly string[],
  action: CustomerAffairsAction,
): boolean {
  const required = customerAffairsPermissionMatrix[action];
  return grantedPermissions.includes(required);
}

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

function normalizePositiveInteger(
  value: number | undefined,
  fallback: number,
  maximum?: number,
): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  const normalized = Math.max(1, Math.trunc(value));
  return maximum === undefined ? normalized : Math.min(maximum, normalized);
}

export function normalizeTicketListQuery(
  input: Partial<TicketListQuery>,
): TicketListQuery {
  const sortBy = ticketSortFields.includes(input.sortBy as TicketSortField)
    ? (input.sortBy as TicketSortField)
    : 'updatedAt';

  return {
    search: input.search?.trim().slice(0, 100) ?? '',
    status: input.status ?? 'ALL',
    category: input.category ?? 'ALL',
    priority: input.priority ?? 'ALL',
    assigneeReference: input.assigneeReference?.trim() || null,
    slaState: input.slaState ?? 'ALL',
    overdueOnly: input.overdueOnly ?? false,
    sortBy,
    sortDirection: input.sortDirection === 'asc' ? 'asc' : 'desc',
    page: normalizePositiveInteger(input.page, DEFAULT_PAGE),
    pageSize: normalizePositiveInteger(
      input.pageSize,
      DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE,
    ),
  };
}

export function normalizeLeadListQuery(
  input: Partial<LeadListQuery>,
): LeadListQuery {
  const sortBy = leadSortFields.includes(
    input.sortBy as LeadListQuery['sortBy'],
  )
    ? (input.sortBy as LeadListQuery['sortBy'])
    : 'updatedAt';

  return {
    search: input.search?.trim().slice(0, 100) ?? '',
    stage: input.stage ?? 'ALL',
    priority: input.priority ?? 'ALL',
    assigneeReference: input.assigneeReference?.trim() || null,
    overdueOnly: input.overdueOnly ?? false,
    sortBy,
    sortDirection: input.sortDirection === 'asc' ? 'asc' : 'desc',
    page: normalizePositiveInteger(input.page, DEFAULT_PAGE),
    pageSize: normalizePositiveInteger(
      input.pageSize,
      DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE,
    ),
  };
}

export function createPaginatedResult<T>(
  data: readonly T[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedResult<T> {
  const normalizedTotal = Number.isFinite(total)
    ? Math.max(0, Math.trunc(total))
    : 0;
  const normalizedPage = normalizePositiveInteger(page, DEFAULT_PAGE);
  const normalizedPageSize = normalizePositiveInteger(
    pageSize,
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
  );

  return {
    data,
    total: normalizedTotal,
    page: normalizedPage,
    pageSize: normalizedPageSize,
    totalPages: Math.ceil(normalizedTotal / normalizedPageSize),
  };
}
