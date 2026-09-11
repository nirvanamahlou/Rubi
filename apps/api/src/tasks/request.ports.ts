import type {
  RequestActor,
  RequestCommand,
  RequestSnapshot,
  SlaSnapshot,
  VerifiedReferences,
} from './request.domain';

/** Proposed tasks.requests.v1, not published until producer/consumer review. */
export interface RequestDirectoryPort {
  resolveActor(userId: string): Promise<RequestActor>;
  validateReferences(
    actor: RequestActor,
    current: RequestSnapshot,
    command: RequestCommand,
  ): Promise<VerifiedReferences>;
}
export interface RequestUnitOfWorkPort {
  /** Scope idempotency to actor + operation + key. Same key/different payload => 409.
   * Reauthorize even a replay. Lock actor/HR membership or validate a revision token
   * in the same transaction. CAS id+branch+version (+assignee IS NULL for claim).
   * Persist response/reason, history, destination and assignment changes, SLA snapshot,
   * command receipt and privacy-safe outbox atomically. Roll back everything on failure.
   * A lost CAS returns current authorized assignee, never a cross-scope snapshot.
   */
  execute(input: {
    actorUserId: string;
    requestId: string;
    idempotencyKey: string;
    command: RequestCommand;
  }): Promise<{ snapshot: RequestSnapshot; replayed: boolean }>;
}
export interface RequestQueryPort {
  /** Owner must resolve current IAM/HR scope before list AND count; no caller-supplied actor. */
  list(
    actorUserId: string,
    query: {
      view:
        | 'received'
        | 'unit'
        | 'sent'
        | 'routed'
        | 'approvals'
        | 'waiting'
        | 'closed'
        | 'drafts';
      search: string;
      cursor: string | null;
      limit: number;
    },
  ): Promise<{ items: RequestSnapshot[]; nextCursor: string | null }>;
  today(actorUserId: string): Promise<{
    waitingForMe: number;
    waitingForOthers: number;
    dueToday: number;
    overdue: number;
    approvals: number;
    items: RequestSnapshot[];
  }>;
}
export interface RequestSlaPolicyPort {
  snapshot(
    kind: string,
    priority: string,
    branchId: string,
  ): Promise<SlaSnapshot>;
  workingMilliseconds(
    fromUtc: string,
    toUtc: string,
    calendarVersion: string,
  ): Promise<number>;
}
export interface DomainActionReferencePort {
  /** Read-only validation. Never execute a financial, issuance, access or HR action. */
  validate(
    actorUserId: string,
    requestId: string,
    referenceId: string,
  ): Promise<NonNullable<VerifiedReferences['domainAction']>>;
}
