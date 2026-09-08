import { createHash } from 'node:crypto';
import type {
  Actor,
  Permission,
  ReservationStatusEventV1,
  SalesReservationRequestV1,
  ServiceLine,
  TicketOfferReferenceV1,
} from './contracts';

export class ReservationError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'ReservationError';
  }
}
export function requireValue(
  condition: unknown,
  code = 'VALIDATION',
): asserts condition {
  if (!condition) throw new ReservationError(code);
}
export function reference(value: unknown): asserts value is string {
  requireValue(
    typeof value === 'string' &&
      /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(value),
  );
}
export function utc(value: string): number {
  requireValue(
    typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value),
  );
  const time = Date.parse(value);
  requireValue(Number.isFinite(time) && new Date(time).toISOString() === value);
  return time;
}
export function authorize(
  actor: Actor,
  branchId: string,
  permission: Permission,
): void {
  requireValue(actor?.authenticated && actor.actorId, 'UNAUTHORIZED');
  reference(actor.actorId);
  requireValue(
    actor.branchIds.includes(branchId) &&
      actor.permissions.includes(permission),
    'FORBIDDEN',
  );
}
export function issuerFor(actor: Actor, legalEntityId: string) {
  requireValue(actor.issuer.mode === 'SINGLE', 'ALL_CONTEXT_FORBIDDEN');
  requireValue(
    actor.issuer.active && actor.issuer.legalEntityId === legalEntityId,
    'ISSUER_MISMATCH',
  );
  reference(actor.issuer.legalEntityId);
  reference(actor.issuer.brandingSnapshotId);
  requireValue(
    Number.isSafeInteger(actor.issuer.brandingVersion) &&
      actor.issuer.brandingVersion > 0,
  );
  return { ...actor.issuer };
}
export function fresh(checkedAt: string, now: string, maxAgeMs = 60_000): void {
  const age = utc(now) - utc(checkedAt);
  requireValue(age >= 0 && age <= maxAgeMs, 'STALE_PROJECTION');
}
function unique(values: readonly string[]) {
  requireValue(new Set(values).size === values.length);
  values.forEach(reference);
}
export function validateRequest(request: SalesReservationRequestV1): void {
  requireValue(request.version === 1);
  [
    request.requestId,
    request.contractId,
    request.branchId,
    request.legalEntityId,
    request.salesCounterId,
    request.customerId,
  ].forEach(reference);
  requireValue(request.legalEntityId !== 'ALL');
  requireValue(
    Number.isSafeInteger(request.contractVersion) &&
      request.contractVersion > 0,
  );
  requireValue(
    request.contractNumber.trim().length > 0 &&
      request.contractNumber.length <= 100,
  );
  requireValue(['NORMAL', 'HIGH', 'URGENT'].includes(request.priority));
  requireValue(utc(request.dueAt) >= utc(request.createdAt));
  requireValue(
    request.passengers.length > 0 && request.passengers.length <= 1000,
  );
  requireValue(request.services.length > 0 && request.services.length <= 1000);
  unique(request.passengers.map((p) => p.passengerId));
  unique(request.services.map((s) => s.serviceLineId));
  for (const passenger of request.passengers) {
    requireValue(typeof passenger.informationComplete === 'boolean');
    requireValue(
      passenger.displayName.trim().length > 0 &&
        passenger.displayName.length <= 200,
    );
  }
  for (const line of request.services) {
    requireValue(
      ['FLIGHT', 'TRAIN', 'BUS', 'HOTEL', 'INSURANCE', 'OTHER'].includes(
        line.kind,
      ),
    );
    requireValue(line.passengerIds.length > 0);
    unique(line.passengerIds);
    requireValue(
      line.passengerIds.every((id) =>
        request.passengers.some((p) => p.passengerId === id),
      ),
    );
    unique(line.segments.map((s) => s.segmentId));
    if (['FLIGHT', 'TRAIN', 'BUS'].includes(line.kind)) {
      reference(line.offerId);
      requireValue(line.segments.length > 0);
    }
    for (const segment of line.segments) {
      [segment.originId, segment.destinationId, segment.carrierId].forEach(
        reference,
      );
      requireValue(segment.originId !== segment.destinationId);
      requireValue(
        segment.transportNumber.trim().length > 0 &&
          segment.transportNumber.length <= 40,
      );
      utc(segment.departureAt);
    }
    if (line.kind === 'HOTEL') {
      const hotel = line.hotel;
      requireValue(hotel);
      reference(hotel.hotelId);
      requireValue(utc(hotel.checkOut) > utc(hotel.checkIn));
      requireValue(hotel.rooms.length > 0);
      unique(hotel.rooms.map((r) => r.roomId));
      const assigned = hotel.rooms.flatMap((r) => [...r.passengerIds]);
      unique(assigned);
      requireValue(
        assigned.length === line.passengerIds.length &&
          assigned.every((id) => line.passengerIds.includes(id)),
      );
      hotel.rooms.forEach((r) => {
        reference(r.roomTypeId);
        requireValue(r.passengerIds.length > 0);
      });
      requireValue(hotel.passengerRequests.length <= 2000);
    }
    if (line.kind === 'INSURANCE') {
      const insurance = line.insurance;
      requireValue(insurance);
      reference(insurance.countryId);
      reference(insurance.planId);
      requireValue(utc(insurance.endsAt) > utc(insurance.startsAt));
    }
  }
}
export type RequestStatus =
  | 'NEW'
  | 'REVIEW'
  | 'RETURNED_TO_SALES'
  | 'READY'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';
export interface Ticket {
  operationId: string;
  serviceLineId: string;
  passengerId: string;
  segmentId: string;
  status: 'DRAFT' | 'READY' | 'ISSUED' | 'STOPPED' | 'CANCELLED';
  internalCode?: string;
  stopReason?: string;
  issuedAt?: string;
  issuer?: ReturnType<typeof issuerFor>;
  official?: { source: 'PROVIDER'; providerReference: string; number: string };
}
export interface Execution {
  snapshot: SalesReservationRequestV1;
  version: number;
  status: RequestStatus;
  assigneeId: string | null;
  tickets: Ticket[];
  timeline: ReservationStatusEventV1[];
  receipts: { key: string; fingerprint: string }[];
}
export function intake(
  request: SalesReservationRequestV1,
  actor: Actor,
  now: string,
): Execution {
  authorize(actor, request.branchId, 'reservations.create');
  validateRequest(request);
  utc(now);
  return {
    snapshot: structuredClone(request),
    version: 1,
    status: 'NEW',
    assigneeId: null,
    tickets: [],
    receipts: [],
    timeline: [
      {
        version: 1,
        aggregateId: request.requestId,
        aggregateVersion: 1,
        actorId: actor.actorId,
        occurredAt: now,
        action: 'INTAKE',
        from: 'NONE',
        to: 'NEW',
        outcome: 'ALLOWED',
      },
    ],
  };
}
export interface CommandContext {
  actor: Actor;
  now: string;
  expectedVersion: number;
  idempotencyKey: string;
}
export type ExecutionCommand =
  | { type: 'ASSIGN'; assigneeId: string; assigneeBranchIds: readonly string[] }
  | { type: 'REVIEW' }
  | {
      type: 'RETURN_TO_SALES';
      reasonCode:
        'MISSING_PASSENGER_DATA' | 'SERVICE_CORRECTION' | 'OFFER_UNAVAILABLE';
    }
  | { type: 'MARK_READY'; offers: readonly TicketOfferReferenceV1[] }
  | { type: 'START' }
  | { type: 'CANCEL' }
  | {
      type: 'TICKET_DRAFT';
      operationId: string;
      serviceLineId: string;
      passengerId: string;
      segmentId: string;
    }
  | { type: 'TICKET_READY'; operationId: string }
  | {
      type: 'TICKET_ISSUE';
      operationId: string;
      internalCode: string;
      offer: TicketOfferReferenceV1;
      official?: {
        source: 'PROVIDER';
        providerReference: string;
        number: string;
      };
    }
  | { type: 'TICKET_STOP'; operationId: string; reason: string }
  | { type: 'TICKET_CANCEL'; operationId: string };
const commandPermissions: Record<ExecutionCommand['type'], Permission> = {
  ASSIGN: 'reservations.assign',
  REVIEW: 'reservations.update',
  RETURN_TO_SALES: 'reservations.update',
  MARK_READY: 'reservations.update',
  START: 'reservations.update',
  CANCEL: 'reservations.update',
  TICKET_DRAFT: 'reservations.create',
  TICKET_READY: 'reservations.update',
  TICKET_ISSUE: 'reservations.issue.ticket',
  TICKET_STOP: 'reservations.stop.ticket',
  TICKET_CANCEL: 'reservations.update',
};
export function lineFor(
  execution: Execution,
  serviceLineId: string,
): ServiceLine {
  const line = execution.snapshot.services.find(
    (s) => s.serviceLineId === serviceLineId,
  );
  requireValue(line, 'SERVICE_NOT_FOUND');
  return line;
}
export function checkOffer(
  offer: TicketOfferReferenceV1,
  execution: Execution,
  line: ServiceLine,
  now: string,
) {
  requireValue(
    offer.offerId === line.offerId &&
      offer.branchId === execution.snapshot.branchId,
    'OFFER_MISMATCH',
  );
  requireValue(
    offer.active && Number.isSafeInteger(offer.version) && offer.version > 0,
    'OFFER_UNAVAILABLE',
  );
  fresh(offer.checkedAt, now);
  requireValue(
    Number.isSafeInteger(offer.availableCapacity) &&
      offer.availableCapacity >= 0,
  );
  const allocation = offer.allocation;
  const allocated =
    allocation?.contractId === execution.snapshot.contractId &&
    allocation.serviceLineId === line.serviceLineId &&
    line.passengerIds.every((p) => allocation.passengerIds.includes(p));
  requireValue(
    allocated || offer.availableCapacity >= line.passengerIds.length,
    'CAPACITY_UNAVAILABLE',
  );
  return allocated;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object')
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
export function fingerprint(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}
/** Pure plan only. Phase B must claim version + unique receipt and persist event atomically. */
export function execute(
  execution: Execution,
  command: ExecutionCommand,
  context: CommandContext,
): Execution {
  authorize(
    context.actor,
    execution.snapshot.branchId,
    commandPermissions[command.type],
  );
  utc(context.now);
  reference(context.idempotencyKey);
  requireValue(
    Number.isSafeInteger(context.expectedVersion) &&
      context.expectedVersion > 0,
  );
  if (command.type === 'TICKET_ISSUE')
    issuerFor(context.actor, execution.snapshot.legalEntityId);
  const hash = fingerprint({ actorId: context.actor.actorId, command });
  const receipt = execution.receipts.find(
    (r) => r.key === context.idempotencyKey,
  );
  if (receipt) {
    requireValue(receipt.fingerprint === hash, 'IDEMPOTENCY_CONFLICT');
    return structuredClone(execution);
  }
  requireValue(context.expectedVersion === execution.version, 'CONFLICT');
  requireValue(
    !['COMPLETED', 'CANCELLED'].includes(execution.status),
    'INVALID_TRANSITION',
  );
  const next = structuredClone(execution);
  let from: string = next.status;
  let to: string = next.status;
  switch (command.type) {
    case 'ASSIGN':
      reference(command.assigneeId);
      requireValue(
        command.assigneeBranchIds.includes(next.snapshot.branchId),
        'ASSIGNEE_SCOPE',
      );
      next.assigneeId = command.assigneeId;
      break;
    case 'REVIEW':
      requireValue(
        ['NEW', 'RETURNED_TO_SALES'].includes(next.status),
        'INVALID_TRANSITION',
      );
      next.status = 'REVIEW';
      break;
    case 'RETURN_TO_SALES':
      requireValue(
        ['NEW', 'REVIEW', 'READY'].includes(next.status),
        'INVALID_TRANSITION',
      );
      requireValue(
        [
          'MISSING_PASSENGER_DATA',
          'SERVICE_CORRECTION',
          'OFFER_UNAVAILABLE',
        ].includes(command.reasonCode),
      );
      next.status = 'RETURNED_TO_SALES';
      break;
    case 'MARK_READY':
      requireValue(next.status === 'REVIEW', 'INVALID_TRANSITION');
      requireValue(
        next.snapshot.passengers.every((p) => p.informationComplete),
        'MISSING_PASSENGER_DATA',
      );
      for (const line of next.snapshot.services.filter((s) =>
        ['FLIGHT', 'TRAIN', 'BUS'].includes(s.kind),
      )) {
        const offer = command.offers.find((o) => o.offerId === line.offerId);
        requireValue(offer, 'OFFER_UNAVAILABLE');
        checkOffer(offer, next, line, context.now);
      }
      next.status = 'READY';
      break;
    case 'START':
      requireValue(
        next.status === 'READY' && next.assigneeId,
        'INVALID_TRANSITION',
      );
      next.status = 'IN_PROGRESS';
      break;
    case 'CANCEL':
      requireValue(
        next.status !== 'IN_PROGRESS',
        'ACTIVE_OPERATIONS_REQUIRE_RECONCILIATION',
      );
      requireValue(
        next.tickets.every((t) => t.status !== 'ISSUED'),
        'ISSUED_DOCUMENT_EXISTS',
      );
      next.status = 'CANCELLED';
      break;
    case 'TICKET_DRAFT': {
      requireValue(next.status === 'IN_PROGRESS', 'INVALID_TRANSITION');
      reference(command.operationId);
      const line = lineFor(next, command.serviceLineId);
      requireValue(['FLIGHT', 'TRAIN', 'BUS'].includes(line.kind));
      requireValue(
        line.passengerIds.includes(command.passengerId) &&
          line.segments.some((s) => s.segmentId === command.segmentId),
        'ALLOCATION_MISMATCH',
      );
      requireValue(
        !next.tickets.some(
          (t) =>
            t.operationId === command.operationId ||
            (t.serviceLineId === command.serviceLineId &&
              t.passengerId === command.passengerId &&
              t.segmentId === command.segmentId),
        ),
        'DUPLICATE_ISSUANCE',
      );
      next.tickets.push({
        operationId: command.operationId,
        serviceLineId: command.serviceLineId,
        passengerId: command.passengerId,
        segmentId: command.segmentId,
        status: 'DRAFT',
      });
      from = 'NONE';
      to = 'DRAFT';
      break;
    }
    default: {
      requireValue(next.status === 'IN_PROGRESS', 'INVALID_TRANSITION');
      const ticket = next.tickets.find(
        (t) => t.operationId === command.operationId,
      );
      requireValue(ticket, 'TICKET_NOT_FOUND');
      from = ticket.status;
      if (command.type === 'TICKET_READY') {
        requireValue(ticket.status === 'DRAFT', 'INVALID_TRANSITION');
        ticket.status = 'READY';
      } else if (command.type === 'TICKET_STOP') {
        requireValue(
          ['DRAFT', 'READY'].includes(ticket.status),
          'INVALID_TRANSITION',
        );
        requireValue(
          command.reason.trim().length >= 3 && command.reason.length <= 500,
          'STOP_REASON_REQUIRED',
        );
        ticket.status = 'STOPPED';
        ticket.stopReason = command.reason.trim();
      } else if (command.type === 'TICKET_CANCEL') {
        requireValue(
          ['DRAFT', 'READY', 'STOPPED'].includes(ticket.status),
          'INVALID_TRANSITION',
        );
        ticket.status = 'CANCELLED';
      } else {
        requireValue(ticket.status === 'READY', 'DUPLICATE_ISSUANCE');
        const allocated = checkOffer(
          command.offer,
          next,
          lineFor(next, ticket.serviceLineId),
          context.now,
        );
        requireValue(allocated, 'CAPACITY_ALLOCATION_REQUIRED');
        reference(command.internalCode);
        requireValue(
          !next.tickets.some((t) => t.internalCode === command.internalCode),
          'DUPLICATE_ISSUANCE',
        );
        requireValue(
          command.offer.companyOwned || command.official,
          'PROVIDER_EVIDENCE_REQUIRED',
        );
        if (command.official) {
          requireValue(command.official.source === 'PROVIDER');
          reference(command.official.providerReference);
          reference(command.official.number);
          ticket.official = { ...command.official };
        }
        ticket.status = 'ISSUED';
        ticket.internalCode = command.internalCode;
        ticket.issuedAt = context.now;
        ticket.issuer = issuerFor(context.actor, next.snapshot.legalEntityId);
      }
      to = ticket.status;
    }
  }
  if (!command.type.startsWith('TICKET_')) to = next.status;
  next.version += 1;
  next.timeline.push({
    version: 1,
    aggregateId: next.snapshot.requestId,
    aggregateVersion: next.version,
    actorId: context.actor.actorId,
    occurredAt: context.now,
    action: command.type,
    from,
    to,
    outcome: 'ALLOWED',
    ...(command.type === 'RETURN_TO_SALES'
      ? { reasonCode: command.reasonCode }
      : {}),
  });
  next.receipts.push({ key: context.idempotencyKey, fingerprint: hash });
  return next;
}
