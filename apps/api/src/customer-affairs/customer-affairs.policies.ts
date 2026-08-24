import type {
  SLAState,
  TicketPriority,
  TicketReopenRequest,
  TicketStatus,
} from './customer-affairs.contracts';
import { calculateSLAState } from './customer-affairs.domain';

export interface SLAPolicyProposal {
  version: 'customer-affairs.sla-policy.v1-proposal';
  priority: TicketPriority;
  firstResponseMinutes: number;
  resolutionMinutes: number;
  atRiskPercent: number;
  escalationLevels: readonly {
    level: 1 | 2 | 3;
    remainingPercent: number;
    targetReference: string;
  }[];
}

export interface SLAEvaluation {
  state: SLAState;
  escalationLevel: 1 | 2 | 3 | null;
  firstResponseDueAt: string;
  resolutionDueAt: string;
}

function addMinutes(value: string, minutes: number): string {
  return new Date(Date.parse(value) + minutes * 60_000).toISOString();
}

export function evaluateSLAPolicy(input: {
  openedAt: string;
  now: string;
  firstRespondedAt: string | null;
  resolvedAt: string | null;
  paused: boolean;
  policy: SLAPolicyProposal;
}): SLAEvaluation {
  const firstResponseDueAt = addMinutes(
    input.openedAt,
    input.policy.firstResponseMinutes,
  );
  const resolutionDueAt = addMinutes(
    input.openedAt,
    input.policy.resolutionMinutes,
  );
  const state = calculateSLAState({
    now: input.now,
    firstResponseDueAt,
    resolutionDueAt,
    firstRespondedAt: input.firstRespondedAt,
    resolvedAt: input.resolvedAt,
    paused: input.paused,
  });
  if (state === 'PAUSED' || state === 'MET') {
    return {
      state,
      escalationLevel: null,
      firstResponseDueAt,
      resolutionDueAt,
    };
  }
  const now = Date.parse(input.now);
  const deadline = input.firstRespondedAt
    ? Date.parse(resolutionDueAt)
    : Date.parse(firstResponseDueAt);
  const totalWindow = input.firstRespondedAt
    ? input.policy.resolutionMinutes * 60_000
    : input.policy.firstResponseMinutes * 60_000;
  const remainingPercent = ((deadline - now) / Math.max(1, totalWindow)) * 100;
  const escalation = [...input.policy.escalationLevels]
    .sort((left, right) => left.remainingPercent - right.remainingPercent)
    .find((item) => remainingPercent <= item.remainingPercent);
  return {
    state,
    escalationLevel: state === 'BREACHED' ? 3 : (escalation?.level ?? null),
    firstResponseDueAt,
    resolutionDueAt,
  };
}

export interface TicketReopenContext {
  currentStatus: TicketStatus;
  reopenCount: number;
  maxReopenCount: number;
  hasPermission: boolean;
  currentVersion: number;
}

export function validateTicketReopen(
  context: TicketReopenContext,
  request: TicketReopenRequest,
): { allowed: boolean; reason: string | null } {
  if (!context.hasPermission)
    return { allowed: false, reason: 'TICKET_REOPEN_PERMISSION_REQUIRED' };
  if (!['RESOLVED', 'CLOSED', 'CANCELLED'].includes(context.currentStatus))
    return { allowed: false, reason: 'TICKET_STATUS_NOT_REOPENABLE' };
  if (request.expectedVersion !== context.currentVersion)
    return { allowed: false, reason: 'CONCURRENT_MODIFICATION' };
  if (context.reopenCount >= context.maxReopenCount)
    return { allowed: false, reason: 'TICKET_REOPEN_LIMIT_REACHED' };
  if (request.note.trim().length < 5)
    return { allowed: false, reason: 'TICKET_REOPEN_NOTE_REQUIRED' };
  return { allowed: true, reason: null };
}

export function validateTicketClosure(input: {
  status: TicketStatus;
  resolutionOutcome: string;
  closeReason: string;
}): boolean {
  return (
    input.status === 'RESOLVED' &&
    input.resolutionOutcome.trim().length >= 5 &&
    input.closeReason.trim().length >= 3
  );
}
