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

export class SLAPolicyValidationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'SLAPolicyValidationError';
  }
}

const UTC_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

function parseUtcTimestamp(value: string, field: string): number {
  const timestamp = Date.parse(value);
  const normalized = value.includes('.') ? value : value.replace('Z', '.000Z');
  if (
    !UTC_TIMESTAMP_PATTERN.test(value) ||
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString() !== normalized
  ) {
    throw new SLAPolicyValidationError(
      'INVALID_SLA_TIMESTAMP',
      `${field} must be a valid UTC ISO-8601 timestamp.`,
    );
  }
  return timestamp;
}

function validateSLAPolicy(policy: SLAPolicyProposal): void {
  if (
    !Number.isInteger(policy.firstResponseMinutes) ||
    policy.firstResponseMinutes <= 0
  ) {
    throw new SLAPolicyValidationError(
      'INVALID_FIRST_RESPONSE_WINDOW',
      'First-response minutes must be a positive integer.',
    );
  }
  if (
    !Number.isInteger(policy.resolutionMinutes) ||
    policy.resolutionMinutes <= policy.firstResponseMinutes
  ) {
    throw new SLAPolicyValidationError(
      'INVALID_RESOLUTION_WINDOW',
      'Resolution minutes must be an integer greater than first-response minutes.',
    );
  }
  if (
    !Number.isFinite(policy.atRiskPercent) ||
    policy.atRiskPercent <= 0 ||
    policy.atRiskPercent >= 100
  ) {
    throw new SLAPolicyValidationError(
      'INVALID_AT_RISK_PERCENT',
      'At-risk percent must be greater than 0 and less than 100.',
    );
  }

  const levels = [...policy.escalationLevels].sort(
    (left, right) => left.level - right.level,
  );
  if (
    levels.length !== 3 ||
    levels.some((item, index) => item.level !== index + 1)
  ) {
    throw new SLAPolicyValidationError(
      'INVALID_ESCALATION_LEVELS',
      'Escalation policy must define levels 1, 2 and 3 exactly once.',
    );
  }
  for (const level of levels) {
    if (
      !Number.isFinite(level.remainingPercent) ||
      level.remainingPercent < 0 ||
      level.remainingPercent > 100 ||
      !level.targetReference.trim()
    ) {
      throw new SLAPolicyValidationError(
        'INVALID_ESCALATION_THRESHOLD',
        'Escalation percentages and target references must be valid.',
      );
    }
  }
  if (!(
    levels[0]!.remainingPercent > levels[1]!.remainingPercent &&
    levels[1]!.remainingPercent > levels[2]!.remainingPercent
  )) {
    throw new SLAPolicyValidationError(
      'NON_DETERMINISTIC_ESCALATION_THRESHOLDS',
      'Escalation remaining percentages must strictly decrease by level.',
    );
  }
}

function addMinutes(timestamp: number, minutes: number): string {
  return new Date(timestamp + minutes * 60_000).toISOString();
}

export function evaluateSLAPolicy(input: {
  openedAt: string;
  now: string;
  firstRespondedAt: string | null;
  resolvedAt: string | null;
  paused: boolean;
  policy: SLAPolicyProposal;
}): SLAEvaluation {
  validateSLAPolicy(input.policy);

  const openedAt = parseUtcTimestamp(input.openedAt, 'openedAt');
  const now = parseUtcTimestamp(input.now, 'now');
  const firstRespondedAt =
    input.firstRespondedAt === null
      ? null
      : parseUtcTimestamp(input.firstRespondedAt, 'firstRespondedAt');
  const resolvedAt =
    input.resolvedAt === null
      ? null
      : parseUtcTimestamp(input.resolvedAt, 'resolvedAt');

  if (
    now < openedAt ||
    (firstRespondedAt !== null &&
      (firstRespondedAt < openedAt || firstRespondedAt > now)) ||
    (resolvedAt !== null &&
      (resolvedAt < openedAt ||
        resolvedAt > now ||
        firstRespondedAt === null ||
        resolvedAt < firstRespondedAt))
  ) {
    throw new SLAPolicyValidationError(
      'INVALID_SLA_TIMELINE',
      'SLA timestamps must form a valid chronological timeline.',
    );
  }

  const firstResponseDueAt = addMinutes(
    openedAt,
    input.policy.firstResponseMinutes,
  );
  const resolutionDueAt = addMinutes(openedAt, input.policy.resolutionMinutes);
  const state = calculateSLAState({
    now: input.now,
    firstResponseDueAt,
    resolutionDueAt,
    firstRespondedAt: input.firstRespondedAt,
    resolvedAt: input.resolvedAt,
    paused: input.paused,
    firstResponseWindowMinutes: input.policy.firstResponseMinutes,
    resolutionWindowMinutes: input.policy.resolutionMinutes,
    atRiskPercent: input.policy.atRiskPercent,
  });
  if (state === 'PAUSED' || state === 'MET') {
    return {
      state,
      escalationLevel: null,
      firstResponseDueAt,
      resolutionDueAt,
    };
  }

  const deadline = input.firstRespondedAt
    ? Date.parse(resolutionDueAt)
    : Date.parse(firstResponseDueAt);
  const windowMinutes = input.firstRespondedAt
    ? input.policy.resolutionMinutes
    : input.policy.firstResponseMinutes;
  const remainingPercent = ((deadline - now) / (windowMinutes * 60_000)) * 100;
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
