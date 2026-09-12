export const CUSTOMER_AFFAIRS_CONTRACT_VERSION = 'customer-affairs.v1' as const;

export const CUSTOMER_AFFAIRS_PERMISSIONS = {
  leadRead: 'customer_affairs.lead.read',
  leadCreate: 'customer_affairs.lead.create',
  leadUpdate: 'customer_affairs.lead.update',
  leadQualify: 'customer_affairs.lead.qualify',
  handoffPropose: 'customer_affairs.lead.handoff.propose',
  handoffRespond: 'customer_affairs.lead.handoff.respond',
  ticketRead: 'customer_affairs.ticket.read',
  ticketCreate: 'customer_affairs.ticket.create',
  ticketUpdate: 'customer_affairs.ticket.update',
  ticketAssign: 'customer_affairs.ticket.assign',
  ticketEscalate: 'customer_affairs.ticket.escalate',
  ticketClose: 'customer_affairs.ticket.close',
  ticketReopen: 'customer_affairs.ticket.reopen',
  slaManage: 'customer_affairs.sla.manage',
  satisfactionRead: 'customer_affairs.satisfaction.read',
  satisfactionRecord: 'customer_affairs.satisfaction.record',
  correctiveActionManage: 'customer_affairs.corrective_action.manage',
  auditRead: 'customer_affairs.audit.read',
  export: 'customer_affairs.export',
} as const;

export type CustomerAffairsLeadStage =
  | 'NEW'
  | 'CONTACTED'
  | 'QUALIFYING'
  | 'NURTURE'
  | 'QUALIFIED'
  | 'HANDOFF_PROPOSED'
  | 'HANDED_OFF'
  | 'LOST';
export type CustomerAffairsPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type CustomerAffairsTicketPriority =
  CustomerAffairsPriority | 'CRITICAL';
export type CustomerAffairsTicketStatus =
  | 'NEW'
  | 'TRIAGED'
  | 'IN_PROGRESS'
  | 'WAITING_CUSTOMER'
  | 'WAITING_EXTERNAL'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REOPENED'
  | 'CANCELLED';

export interface CustomerAffairsMoneyInput {
  minimum?: string | null;
  maximum?: string | null;
  currencyCode?: string | null;
  basis?: 'TOTAL' | 'PER_PERSON' | null;
  unknownReason?: string | null;
}

export interface CustomerAffairsLeadInput {
  title: string;
  sourceReference: string;
  inboundChannel:
    'PHONE' | 'WEBSITE' | 'REFERRAL' | 'WALK_IN' | 'SOCIAL' | 'OTHER';
  contactOccurredAt: string;
  travelNeed: string;
  originReference?: string | null;
  destinationReference?: string | null;
  travelStart?: string | null;
  travelEnd?: string | null;
  datePrecision?: 'EXACT' | 'RANGE' | 'FLEXIBLE' | 'UNKNOWN';
  dateFlexibility?: string | null;
  passengerCount: number;
  passengerComposition?: {
    adults: number;
    children: number;
    infants: number;
    childAges?: number[];
  };
  requestedServices?: string[];
  budget?: CustomerAffairsMoneyInput | null;
  specialPreferences?: string | null;
  contactFingerprint?: string | null;
  customerId?: string | null;
  priority: CustomerAffairsPriority;
  assigneeUserId?: string | null;
  queueCode?: string | null;
  nextAction: string;
  nextActionAt: string;
  expectedVersion?: number;
}

export interface CustomerAffairsLeadView extends CustomerAffairsLeadInput {
  id: string;
  trackingNumber: string;
  branchId: string;
  stage: CustomerAffairsLeadStage;
  qualification: Record<string, unknown> | null;
  lostReason: string | null;
  lostNote: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  duplicateWarnings: Array<{
    id: string;
    trackingNumber: string;
    title: string;
  }>;
}

export interface CustomerAffairsTicketReference {
  type:
    | 'SALES_CONTRACT'
    | 'RESERVATION'
    | 'PASSENGER'
    | 'TICKET_DOCUMENT'
    | 'VOUCHER_DOCUMENT'
    | 'INVOICE'
    | 'PAYMENT'
    | 'OTHER';
  id: string;
  label?: string;
}

export interface CustomerAffairsTicketInput {
  subject: string;
  description: string;
  channel: 'PHONE' | 'WEBSITE' | 'EMAIL' | 'CHAT' | 'WALK_IN' | 'OTHER';
  contactOccurredAt: string;
  category: string;
  serviceType?: string | null;
  impact: 'LOW' | 'NORMAL' | 'HIGH';
  urgency: 'LOW' | 'NORMAL' | 'HIGH';
  priority: CustomerAffairsTicketPriority;
  customerId?: string | null;
  customerOwnerUserId?: string | null;
  executionOwnerUserId?: string | null;
  executionUnit?: string | null;
  references?: CustomerAffairsTicketReference[];
  nextAction: string;
  nextActionAt: string;
  expectedVersion?: number;
}

export interface CustomerAffairsTicketView extends CustomerAffairsTicketInput {
  id: string;
  trackingNumber: string;
  branchId: string;
  status: CustomerAffairsTicketStatus;
  slaPolicyVersion: string;
  firstResponseDueAt: string;
  resolutionDueAt: string;
  firstRespondedAt: string | null;
  resolvedAt: string | null;
  firstResponseBreachedAt: string | null;
  resolutionBreachedAt: string | null;
  escalationLevel: number | null;
  resolutionOutcome: string | null;
  closeReason: string | null;
  closedAt: string | null;
  reopenCount: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerAffairsTimelineInput {
  type:
    | 'CALL'
    | 'MESSAGE'
    | 'MEETING'
    | 'NOTE'
    | 'CUSTOMER_REPLY'
    | 'ASSIGNMENT'
    | 'STATUS_CHANGE'
    | 'ESCALATION'
    | 'REFERRAL';
  outcome?: string | null;
  summary: string;
  customerVisible?: boolean;
  channel?: string | null;
  recipientReference?: string | null;
  templateVersion?: string | null;
  deliveryStatus?: 'PENDING' | 'DELIVERED' | 'FAILED' | null;
  deliveryKey?: string | null;
  documentVersionIds?: string[];
  occurredAt?: string;
}

export interface CustomerAffairsTimelineView extends CustomerAffairsTimelineInput {
  id: string;
  actorUserId: string;
  occurredAt: string;
}

export interface CustomerAffairsHandoffView {
  id: string;
  leadId: string;
  packageVersion: number;
  status: 'WAITING_SALES' | 'ACCEPTED' | 'RETURNED' | 'REJECTED';
  salesContractId: string | null;
  responseReason: string | null;
  createdAt: string;
  respondedAt: string | null;
}

export interface CustomerAffairsReferralInput {
  destinationModule: string;
  destinationUnit?: string | null;
  assignedUserId?: string | null;
  title: string;
  description: string;
  dueAt: string;
}

export interface CustomerAffairsListResponse<T> {
  data: T[];
  meta: { total: number; page: number; pageSize: number };
}

export interface CustomerAffairsDashboard {
  leads: { open: number; overdue: number; waitingSales: number };
  tickets: {
    open: number;
    overdue: number;
    breached: number;
    correctiveActions: number;
  };
}
