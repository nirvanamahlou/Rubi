import type { AuthenticatedActor } from '@rubi/contracts';
import type {
  Inventory,
  Product,
  ProductInput,
  Reference,
  ReferenceKind,
} from '../domain/catalog';

// ticket-catalog.v1-proposal: NOT a published shared contract or wired API.
export interface TicketActorContext {
  actor: AuthenticatedActor;
  branchId: string;
  traceId: string;
}
export type TicketAction = 'read' | 'create' | 'update' | 'status' | 'export';
export interface TicketAuthorizationPort {
  require(context: TicketActorContext, action: TicketAction): Promise<void>;
}
export class UnpublishedTicketAuthorization implements TicketAuthorizationPort {
  async require(
    context: TicketActorContext,
    _action: TicketAction,
  ): Promise<void> {
    if (!context.actor.userId || !context.actor.sessionId)
      throw new Error('UNAUTHORIZED');
    if (!context.actor.branchIds.includes(context.branchId))
      throw new Error('FORBIDDEN');
    // No published IAM ticket permissions exist. Even administrators fail closed.
    throw new Error('TICKET_PERMISSION_NOT_PUBLISHED: ' + _action);
  }
}
export interface TicketReferencePort {
  resolve(
    kind: ReferenceKind,
    id: string,
    context: TicketActorContext,
  ): Promise<
    | { status: 'available'; value: Reference; observedAt: string }
    | {
        status:
          'missing' | 'inactive' | 'unavailable' | 'forbidden' | 'unauthorized';
      }
  >;
}
export interface TicketQuery {
  search: string;
  status?: Product['status'];
  supplyType?: ProductInput['supplyType'];
  airlineId?: string;
  departureFrom?: string;
  departureTo?: string;
  sort: 'departureAt' | 'title' | 'updatedAt';
  direction: 'asc' | 'desc';
  page: number;
  pageSize: number;
}
export interface TicketExportProposal {
  context: TicketActorContext;
  filters: Omit<TicketQuery, 'page' | 'pageSize'>;
  format: 'xlsx' | 'csv' | 'pdf';
  locale: 'fa-IR';
  timezone: string;
  // Worker must reauthorize when executing and downloading.
}
export interface TicketInventoryCommand {
  context: TicketActorContext;
  productId: string;
  expectedVersion: number;
  idempotencyKey: string;
  reservationOperationId: string;
  allocationId: string;
  command:
    { action: 'hold'; quantity: number } | { action: 'confirm' | 'release' };
}
// Reservations calls this future port; no implementation or manually editable counters.
// Transaction must atomically claim version + idempotency fingerprint, write inventory,
// history and outbox; same key/different payload -> conflict, replay -> original result.
// Hold expiry/release of confirmed allocations requires Reservations policy handoff.
export interface TicketInventoryPort {
  execute(command: TicketInventoryCommand): Promise<Inventory>;
}
export interface TicketPersistenceProposal {
  create(
    context: TicketActorContext,
    input: ProductInput,
    idempotencyKey: string,
  ): Promise<Product>;
  revise(
    context: TicketActorContext,
    productId: string,
    input: ProductInput,
    expectedVersion: number,
    reason: string,
  ): Promise<Product>;
}
// Deliberately no in-memory repository advertised as durable persistence.
