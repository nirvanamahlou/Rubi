import type {
  Escalation,
  LeadActivity,
  LeadDraft,
  LeadListQuery,
  LeadStage,
  LeadSummary,
  QualificationResult,
  Satisfaction,
  SupportTicketDraft,
  SupportTicketSummary,
  TicketStatus,
} from './customer-affairs.contracts';

export interface CustomerAffairsActorContext {
  actorReference: string;
  branchReference: string;
  permissions: readonly string[];
}

export interface CustomerAffairsApplicationPort {
  listLeads(
    query: LeadListQuery,
    actor: CustomerAffairsActorContext,
  ): Promise<readonly LeadSummary[]>;
  getLead(
    leadId: string,
    actor: CustomerAffairsActorContext,
  ): Promise<LeadSummary | null>;
  createLead(
    draft: LeadDraft,
    actor: CustomerAffairsActorContext,
  ): Promise<LeadSummary>;
  updateLead(
    leadId: string,
    draft: LeadDraft,
    actor: CustomerAffairsActorContext,
  ): Promise<LeadSummary>;
  transitionLead(
    leadId: string,
    target: LeadStage,
    reason: string,
    actor: CustomerAffairsActorContext,
  ): Promise<LeadSummary>;
  qualifyLead(
    leadId: string,
    actor: CustomerAffairsActorContext,
  ): Promise<QualificationResult>;
  proposeSalesHandoff(
    leadId: string,
    actor: CustomerAffairsActorContext,
  ): Promise<{ proposalReference: string }>;
  addLeadActivity(
    leadId: string,
    activity: Omit<LeadActivity, 'id' | 'leadId' | 'actorReference'>,
    actor: CustomerAffairsActorContext,
  ): Promise<LeadActivity>;
  listTickets(
    actor: CustomerAffairsActorContext,
  ): Promise<readonly SupportTicketSummary[]>;
  createTicket(
    draft: SupportTicketDraft,
    actor: CustomerAffairsActorContext,
  ): Promise<SupportTicketSummary>;
  updateTicket(
    ticketId: string,
    draft: SupportTicketDraft,
    actor: CustomerAffairsActorContext,
  ): Promise<SupportTicketSummary>;
  transitionTicket(
    ticketId: string,
    target: TicketStatus,
    reason: string,
    actor: CustomerAffairsActorContext,
  ): Promise<SupportTicketSummary>;
  escalateTicket(
    ticketId: string,
    escalation: Omit<Escalation, 'id' | 'ticketId' | 'escalatedAt'>,
    actor: CustomerAffairsActorContext,
  ): Promise<Escalation>;
  recordSatisfaction(
    ticketId: string,
    satisfaction: Omit<Satisfaction, 'ticketId' | 'submittedAt'>,
    actor: CustomerAffairsActorContext,
  ): Promise<Satisfaction>;
}
