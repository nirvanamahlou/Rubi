/** Tasks-owned policy. No persistence or HTTP endpoint is registered by this slice. */
export const requestStates = [
  'DRAFT',
  'SUBMITTED',
  'ROUTED',
  'IN_PROGRESS',
  'WAITING_FOR_INFORMATION',
  'WAITING_FOR_APPROVAL',
  'COMPLETED',
  'CLOSED',
  'REJECTED',
  'CANCELLED',
] as const;
export type RequestState = (typeof requestStates)[number];
export type RequestAction =
  | 'submit'
  | 'claim'
  | 'assign'
  | 'route'
  | 'respond'
  | 'ask_information'
  | 'provide_information'
  | 'request_approval'
  | 'approve'
  | 'complete'
  | 'close'
  | 'reopen'
  | 'reject'
  | 'cancel'
  | 'change_due';
export interface RequestActor {
  userId: string;
  active: boolean;
  branchIds: readonly string[];
  permissions: readonly string[];
  /** Trusted current HR resolution; never accepted from a command DTO. */
  unitIds: readonly string[];
  supervisedUnitIds: readonly string[];
}
export interface RequestSnapshot {
  id: string;
  trackingNumber: string;
  branchId: string;
  senderId: string;
  unitId: string | null;
  recipientId: string | null;
  assigneeId: string | null;
  approverId: string | null;
  state: RequestState;
  version: number;
  kind: 'GENERAL' | 'SPECIALIZED';
  dueAt: string | null;
  result: string | null;
  domainActionId: string | null;
}
export interface RequestCommand {
  action: RequestAction;
  expectedVersion: number;
  reason?: string;
  text?: string;
  dueAt?: string;
  destination?: { unitId: string | null; recipientId: string | null };
  assigneeId?: string;
}
export interface VerifiedReferences {
  /** Supplied only by a live owner port after scope/reference validation. */
  destination?: { unitId: string | null; recipientId: string | null };
  assigneeId?: string;
  approverId?: string;
  /** Owner-port evidence, never a browser checkbox. Bound to the current version. */
  cancellation?: {
    requestId: string;
    version: number;
    approvedByResponsibleParty: boolean;
    domainOperationSettled: boolean;
  };
  domainAction?: { id: string; requestId: string; successful: boolean };
}
export class RequestPolicyError extends Error {
  constructor(
    public readonly code:
      | 'FORBIDDEN'
      | 'NOT_FOUND'
      | 'CONCURRENT_MODIFICATION'
      | 'INVALID_TRANSITION'
      | 'VALIDATION_ERROR',
    public readonly currentAssigneeId?: string | null,
  ) {
    super(code);
  }
}
const permission = (actor: RequestActor, action: string) =>
  actor.permissions.includes(`workbench.requests.${action}`);
const member = (r: RequestSnapshot, a: RequestActor) =>
  r.unitId !== null && a.unitIds.includes(r.unitId);
const supervisor = (r: RequestSnapshot, a: RequestActor) =>
  r.unitId !== null && a.supervisedUnitIds.includes(r.unitId);
const terminal = (s: RequestState) =>
  ['CLOSED', 'CANCELLED', 'REJECTED'].includes(s);

export function canReadRequest(r: RequestSnapshot, a: RequestActor): boolean {
  if (
    !a.active ||
    !a.permissions.includes('workbench.access') ||
    !a.branchIds.includes(r.branchId)
  )
    return false;
  if (r.state === 'DRAFT')
    return a.userId === r.senderId && permission(a, 'read_own');
  return (
    (permission(a, 'read_own') &&
      [r.senderId, r.recipientId, r.assigneeId, r.approverId].includes(
        a.userId,
      )) ||
    (permission(a, 'queue.read') && (member(r, a) || supervisor(r, a)))
  );
}

function requireText(value: string | undefined, limit = 4000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > limit)
    throw new RequestPolicyError('VALIDATION_ERROR');
  return value.trim();
}
function utc(value: string | undefined): string {
  if (
    !value ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  )
    throw new RequestPolicyError('VALIDATION_ERROR');
  return value;
}

/** Returns a proposal; only an atomic repository CAS may commit it with audit/outbox. */
export function decideRequest(
  r: RequestSnapshot,
  a: RequestActor,
  command: RequestCommand,
  verified: VerifiedReferences = {},
): RequestSnapshot {
  if (!canReadRequest(r, a)) throw new RequestPolicyError('NOT_FOUND');
  if (
    !Number.isSafeInteger(command.expectedVersion) ||
    command.expectedVersion < 1
  )
    throw new RequestPolicyError('VALIDATION_ERROR');
  if (command.expectedVersion !== r.version)
    throw new RequestPolicyError('CONCURRENT_MODIFICATION', r.assigneeId);
  const next = { ...r, version: r.version + 1 };
  const owner = a.userId === r.assigneeId;
  const sender = a.userId === r.senderId;
  const allow = (condition: boolean) => {
    if (!condition) throw new RequestPolicyError('FORBIDDEN');
  };
  const state = (...states: RequestState[]) => {
    if (!states.includes(r.state))
      throw new RequestPolicyError('INVALID_TRANSITION');
  };
  const destination = () => {
    const d = command.destination;
    if (
      !d ||
      (!d.unitId && !d.recipientId) ||
      !verified.destination ||
      verified.destination.unitId !== d.unitId ||
      verified.destination.recipientId !== d.recipientId
    )
      throw new RequestPolicyError('VALIDATION_ERROR');
    next.unitId = d.unitId;
    next.recipientId = d.recipientId;
    next.assigneeId = d.recipientId;
    next.approverId = null;
  };
  switch (command.action) {
    case 'submit':
      allow(sender && permission(a, 'create'));
      state('DRAFT');
      destination();
      next.state = 'SUBMITTED';
      break;
    case 'claim':
      allow(member(r, a) && permission(a, 'claim'));
      state('SUBMITTED', 'ROUTED');
      if (r.assigneeId !== null)
        throw new RequestPolicyError('CONCURRENT_MODIFICATION', r.assigneeId);
      next.assigneeId = a.userId;
      next.state = 'IN_PROGRESS';
      break;
    case 'assign':
      allow(supervisor(r, a) && permission(a, 'assign'));
      state('SUBMITTED', 'ROUTED', 'IN_PROGRESS');
      requireText(command.reason, 1000);
      if (!command.assigneeId || verified.assigneeId !== command.assigneeId)
        throw new RequestPolicyError('VALIDATION_ERROR');
      next.assigneeId = command.assigneeId;
      next.state = 'IN_PROGRESS';
      break;
    case 'route':
      allow((owner || supervisor(r, a)) && permission(a, 'route'));
      state('SUBMITTED', 'ROUTED', 'IN_PROGRESS', 'WAITING_FOR_INFORMATION');
      requireText(command.reason, 1000);
      destination();
      next.state = 'ROUTED';
      break;
    case 'respond':
      allow(owner && permission(a, 'respond'));
      state('SUBMITTED', 'ROUTED', 'IN_PROGRESS');
      requireText(command.text);
      next.state = 'IN_PROGRESS';
      break;
    case 'ask_information':
      allow(owner && permission(a, 'respond'));
      state('IN_PROGRESS');
      requireText(command.text);
      next.state = 'WAITING_FOR_INFORMATION';
      break;
    case 'provide_information':
      allow(sender && permission(a, 'respond'));
      state('WAITING_FOR_INFORMATION');
      requireText(command.text);
      next.state = 'IN_PROGRESS';
      break;
    case 'request_approval':
      allow(owner && permission(a, 'respond'));
      state('IN_PROGRESS');
      if (!verified.approverId)
        throw new RequestPolicyError('VALIDATION_ERROR');
      next.approverId = verified.approverId;
      next.state = 'WAITING_FOR_APPROVAL';
      break;
    case 'approve':
      allow(a.userId === r.approverId && permission(a, 'approve'));
      state('WAITING_FOR_APPROVAL');
      next.state = 'IN_PROGRESS';
      next.approverId = null;
      break;
    case 'complete':
      allow(owner && permission(a, 'respond'));
      state('IN_PROGRESS');
      next.result = requireText(command.text);
      if (r.kind === 'SPECIALIZED') {
        const reference = verified.domainAction;
        if (
          !reference?.id ||
          !reference.successful ||
          reference.requestId !== r.id
        )
          throw new RequestPolicyError('VALIDATION_ERROR');
        next.domainActionId = reference.id;
      }
      next.state = 'COMPLETED';
      break;
    case 'close':
      allow(sender && permission(a, 'close'));
      state('COMPLETED');
      next.state = 'CLOSED';
      break;
    case 'reopen':
      allow(sender && permission(a, 'reopen'));
      state('COMPLETED', 'CLOSED');
      requireText(command.reason, 1000);
      next.state = r.assigneeId ? 'IN_PROGRESS' : 'ROUTED';
      next.result = null;
      next.domainActionId = null;
      next.approverId = null;
      break;
    case 'reject':
      allow((owner || supervisor(r, a)) && permission(a, 'respond'));
      state('SUBMITTED', 'ROUTED', 'IN_PROGRESS', 'WAITING_FOR_APPROVAL');
      requireText(command.reason, 1000);
      next.state = 'REJECTED';
      break;
    case 'cancel':
      allow(sender && permission(a, 'create'));
      state(
        'DRAFT',
        'SUBMITTED',
        'ROUTED',
        'IN_PROGRESS',
        'WAITING_FOR_INFORMATION',
        'WAITING_FOR_APPROVAL',
      );
      requireText(command.reason, 1000);
      if (
        [
          'IN_PROGRESS',
          'WAITING_FOR_INFORMATION',
          'WAITING_FOR_APPROVAL',
        ].includes(r.state) ||
        r.kind === 'SPECIALIZED'
      ) {
        const evidence = verified.cancellation;
        if (
          !evidence ||
          evidence.requestId !== r.id ||
          evidence.version !== r.version ||
          ([
            'IN_PROGRESS',
            'WAITING_FOR_INFORMATION',
            'WAITING_FOR_APPROVAL',
          ].includes(r.state) &&
            !evidence.approvedByResponsibleParty) ||
          (r.kind === 'SPECIALIZED' && !evidence.domainOperationSettled)
        )
          throw new RequestPolicyError('VALIDATION_ERROR');
      }
      next.state = 'CANCELLED';
      break;
    case 'change_due':
      allow((owner || supervisor(r, a)) && permission(a, 'change_due'));
      if (terminal(r.state) || r.state === 'COMPLETED')
        throw new RequestPolicyError('INVALID_TRANSITION');
      requireText(command.reason, 1000);
      next.dueAt = utc(command.dueAt);
      break;
    default:
      throw new RequestPolicyError('VALIDATION_ERROR');
  }
  return next;
}

export interface SlaSnapshot {
  policyId: string;
  version: number;
  calendarVersion: string;
  firstResponseBudgetMs: number;
  resolutionBudgetMs: number;
  atRiskFraction: number;
  pauseForInformation: boolean;
}
/** Calendar adapter provides working milliseconds, with no overlap between intervals. */
export function evaluateSla(
  policy: SlaSnapshot,
  elapsedWorkingMs: number,
  waitingInformationWorkingMs: number,
  firstHumanResponseWorkingMs: number | null,
) {
  if (
    !policy.policyId ||
    !policy.calendarVersion ||
    !Number.isSafeInteger(policy.version) ||
    policy.version < 1 ||
    !Number.isFinite(policy.atRiskFraction) ||
    policy.atRiskFraction <= 0 ||
    policy.atRiskFraction >= 1 ||
    ![policy.firstResponseBudgetMs, policy.resolutionBudgetMs].every(
      (n) => Number.isFinite(n) && n > 0,
    ) ||
    ![elapsedWorkingMs, waitingInformationWorkingMs].every(
      (n) => Number.isFinite(n) && n >= 0,
    ) ||
    waitingInformationWorkingMs > elapsedWorkingMs ||
    (firstHumanResponseWorkingMs !== null &&
      (!Number.isFinite(firstHumanResponseWorkingMs) ||
        firstHumanResponseWorkingMs < 0 ||
        firstHumanResponseWorkingMs > elapsedWorkingMs))
  )
    throw new RequestPolicyError('VALIDATION_ERROR');
  const resolution =
    elapsedWorkingMs -
    (policy.pauseForInformation ? waitingInformationWorkingMs : 0);
  const status = (elapsed: number, budget: number) =>
    elapsed >= budget
      ? 'BREACHED'
      : elapsed >= budget * policy.atRiskFraction
        ? 'AT_RISK'
        : 'ON_TRACK';
  return {
    firstResponse: status(
      firstHumanResponseWorkingMs ?? elapsedWorkingMs,
      policy.firstResponseBudgetMs,
    ),
    resolution: status(resolution, policy.resolutionBudgetMs),
    resolutionWorkingMs: resolution,
  };
}
