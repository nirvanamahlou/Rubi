import type { HrResources, PersonnelDocument } from './hr.entities';
import type {
  HrActor,
  HrAuditEvent,
  HrPermission,
  HrTarget,
} from './hr.policy';
import { authorize } from './hr.policy';
import { requireInvariant, utc } from './hr.domain';

export const HR_CONTRACT_VERSION = 'hr.proposal.v1' as const;
export const HR_PERSISTENCE_STATUS = 'BLOCKED_FOR_MIGRATION_HANDOFF' as const;
export type HrResource = keyof HrResources;
/** Default read DTOs exclude sensitive contract, review and pay data entirely. */
export type HrReadModel<K extends HrResource> = Omit<
  HrResources[K],
  | 'agreed'
  | 'benefits'
  | 'money'
  | 'criteria'
  | 'selfAssessment'
  | 'managerAssessment'
  | 'improvementPlan'
  | 'documentId'
  | 'resumeDocumentId'
  | 'certificateDocumentId'
  | 'profileDocumentId'
  | 'receiptDocumentId'
  | 'attachmentDocumentId'
> & { sensitive: 'MASKED' };
export interface HrQuery {
  search?: string;
  status?: string;
  branchId: string;
  page: number;
  pageSize: number;
  sort: 'createdAt' | 'updatedAt';
  direction: 'asc' | 'desc';
}
export interface MutationContext {
  expectedVersion: number;
  idempotencyKey: string;
  reason: string;
  traceId: string;
}
export interface Page<T> {
  items: readonly T[];
  total: number;
  page: number;
  pageSize: number;
}
/** Proposal: one typed port for EVERY resource; implementation waits for migration handoff.
 * Implementations must scope before pagination, authorize again at commit, atomically persist
 * version + history + audit + outbox + idempotency receipt, and reject key/body mismatches.
 * There is deliberately no hard-delete method. Private fields use the separate reveal port.
 */
export type HrApplicationPorts = {
  [K in HrResource]: {
    list(actor: HrActor, query: HrQuery): Promise<Page<HrReadModel<K>>>;
    get(actor: HrActor, id: string): Promise<HrReadModel<K>>;
    create(
      actor: HrActor,
      input: Omit<HrResources[K], 'id' | 'version' | 'createdAt' | 'updatedAt'>,
      context: MutationContext,
    ): Promise<HrReadModel<K>>;
    update(
      actor: HrActor,
      id: string,
      input: Partial<
        Omit<HrResources[K], 'id' | 'version' | 'createdAt' | 'updatedAt'>
      >,
      context: MutationContext,
    ): Promise<HrReadModel<K>>;
  };
};
export interface HrTransactionPort {
  commit(command: {
    resource: HrResource;
    id: string;
    expectedVersion: number;
    idempotencyKey: string;
    fingerprint: string;
    audit: HrAuditEvent;
    event: {
      type: string;
      version: 1;
      aggregateId: string;
      occurredAt: string;
    };
  }): Promise<{ version: number; replayed: boolean }>;
}
export interface HrReferencePort {
  resolveBranch(
    actor: HrActor,
    id: string,
  ): Promise<{ id: string; active: boolean }>;
  resolveMasterReference(
    actor: HrActor,
    kind: 'COUNTRY' | 'CITY' | 'BANK' | 'INSURANCE',
    id: string,
  ): Promise<{ id: string; active: boolean }>;
  resolveUser(
    actor: HrActor,
    id: string,
  ): Promise<{ id: string; active: boolean }>;
}
/** Adapter must consume Documents public contract, never a repository/storage key. */
export interface HrDocumentsPort {
  inspect(
    actor: HrActor,
    documentId: string,
  ): Promise<{
    id: string;
    scan: 'CLEAN' | 'PENDING' | 'INFECTED';
    authorized: boolean;
  }>;
  openAuthorized(
    actor: HrActor,
    documentId: string,
    reason: string,
  ): Promise<void>;
}
export async function openPersonnelDocument(
  actor: HrActor,
  target: HrTarget,
  link: PersonnelDocument,
  reason: string,
  documents: HrDocumentsPort,
): Promise<void> {
  authorize(actor, 'hr.documents.read', target);
  requireInvariant(link.employeeId === target.employeeId, 'FORBIDDEN');
  requireInvariant(reason.trim().length >= 10 && reason.trim().length <= 500);
  const file = await documents.inspect(actor, link.documentId);
  requireInvariant(
    file.id === link.documentId && file.authorized && file.scan === 'CLEAN',
    'FORBIDDEN',
  );
  // Documents must recheck scan, permission and audit at open time to avoid a TOCTOU bypass.
  await documents.openAuthorized(actor, link.documentId, reason);
}
export function mayDisposeDocument(
  link: PersonnelDocument,
  policy: { approved: boolean; retainUntil: string } | null,
  now: string,
): boolean {
  if (link.legalHold || !policy?.approved || !link.retentionPolicyId)
    return false;
  return utc(policy.retainUntil) <= utc(now);
}
export interface HrOutputPort {
  request(input: {
    actor: HrActor;
    permission: HrPermission;
    format: 'PDF' | 'XLSX';
    issuerLegalEntityId: string;
    resource: HrResource;
    ids: readonly string[];
    context: MutationContext;
  }): Promise<{ jobId: string }>;
}
export interface HrFinancePort {
  submitApprovedInput(input: {
    employeeId: string;
    approvalId: string;
    periodId: string;
    components: readonly {
      amount: string;
      currencyCode: string;
      kind: 'BENEFIT' | 'DEDUCTION' | 'AGREED_PAY';
    }[];
    idempotencyKey: string;
  }): Promise<{ receiptId: string }>;
}
export const proposedHttpContract = {
  version: HR_CONTRACT_VERSION,
  active: false,
  basePath: '/api/v1/hr',
  collection: { methods: ['GET', 'POST'], path: '/:resource' },
  record: { methods: ['GET', 'PATCH'], path: '/:resource/:id' },
  actions: [
    'status',
    'submit',
    'approve',
    'reject',
    'renew',
    'convert',
    'reveal',
  ],
  errors: [
    'UNAUTHORIZED',
    'FORBIDDEN',
    'INVALID',
    'CONFLICT',
    'DEPENDENCY_UNAVAILABLE',
  ],
  requiredMutationHeaders: ['Idempotency-Key', 'If-Match'],
} as const;
