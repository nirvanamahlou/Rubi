import type {
  Actor,
  DecimalMoney,
  DocumentGenerationRequestV1,
  FinanceReleaseProjectionV1,
  HotelSupplierCommunicationPortV1,
  InsuranceSubmissionV1,
  ManifestTemplateV1,
  MasterDataTravelReferenceV1,
  ReservationPurchaseCostProposalV1,
  ReservationStatusEventV1,
  SamanInsuranceProviderPortV1,
} from './contracts';
import {
  authorize,
  fingerprint,
  fresh,
  issuerFor,
  lineFor,
  reference,
  requireValue,
  utc,
  type CommandContext,
  type Execution,
} from './execution';

// Exact decimal arithmetic, not binary floating point. No cross-module private import.
function decimal(value: string) {
  requireValue(
    typeof value === 'string' && /^(0|[1-9]\d{0,29})(\.\d{1,18})?$/.test(value),
    'INVALID_DECIMAL',
  );
  const [whole, fraction = ''] = value.split('.');
  return { coefficient: BigInt(`${whole}${fraction}`), scale: fraction.length };
}
export function netPurchase(
  initial: DecimalMoney,
  discount: DecimalMoney,
  fees: DecimalMoney,
): DecimalMoney {
  requireValue(/^[A-Z]{3}$/.test(initial.currencyCode), 'INVALID_CURRENCY');
  requireValue(
    initial.currencyCode === discount.currencyCode &&
      initial.currencyCode === fees.currencyCode,
    'CURRENCY_MISMATCH',
  );
  const parts = [initial, discount, fees].map((m) => decimal(m.amount));
  const scale = Math.max(...parts.map((p) => p.scale));
  const [gross, off, extra] = parts.map(
    (p) => p.coefficient * 10n ** BigInt(scale - p.scale),
  );
  requireValue(gross !== undefined && off !== undefined && extra !== undefined);
  requireValue(off <= gross, 'DISCOUNT_EXCEEDS_PURCHASE');
  const raw = (gross - off + extra).toString().padStart(scale + 1, '0');
  const amount = scale
    ? `${raw.slice(0, -scale)}.${raw.slice(-scale)}`.replace(/\.?0+$/, '')
    : raw;
  return { amount: amount || '0', currencyCode: initial.currencyCode };
}
export function proposeCost(
  execution: Execution,
  input: Omit<
    ReservationPurchaseCostProposalV1,
    'version' | 'contractId' | 'net' | 'actorId' | 'occurredAt'
  >,
  actor: Actor,
  now: string,
): ReservationPurchaseCostProposalV1 {
  authorize(actor, execution.snapshot.branchId, 'reservations.cost.manage');
  lineFor(execution, input.serviceLineId);
  reference(input.supplierId);
  utc(now);
  if (input.fxReference) {
    requireValue(decimal(input.fxReference.rate).coefficient > 0n);
    reference(input.fxReference.sourceId);
    utc(input.fxReference.validAt);
  }
  return {
    ...structuredClone(input),
    version: 1,
    contractId: execution.snapshot.contractId,
    net: netPurchase(input.initial, input.discount, input.fees),
    actorId: actor.actorId,
    occurredAt: now,
  };
}
export interface HotelOperation {
  id: string;
  version: number;
  contractId: string;
  branchId: string;
  serviceLineId: string;
  supplierId: string;
  form: NonNullable<ReturnType<typeof lineFor>['hotel']>;
  leaderId: string | null;
  signText: string;
  status:
    'DRAFT' | 'SENT' | 'SUPPLIER_CONFIRMED' | 'REJECTED' | 'VOUCHER_READY';
  communicationReference?: string;
  confirmationReference?: string;
  voucher?: DocumentGenerationRequestV1;
  receipts: { key: string; fingerprint: string }[];
  timeline: ReservationStatusEventV1[];
}
function activeRef(
  ref: MasterDataTravelReferenceV1,
  kind: MasterDataTravelReferenceV1['kind'],
  id?: string,
) {
  reference(ref.id);
  requireValue(
    ref.active && ref.kind === kind && (!id || ref.id === id),
    'REFERENCE_UNAVAILABLE',
  );
}
export function hotelDraft(
  execution: Execution,
  input: {
    id: string;
    serviceLineId: string;
    hotel: MasterDataTravelReferenceV1;
    supplier: MasterDataTravelReferenceV1;
    leader?: MasterDataTravelReferenceV1;
    signText: string;
  },
  actor: Actor,
): HotelOperation {
  authorize(actor, execution.snapshot.branchId, 'reservations.hotel.request');
  requireValue(execution.status === 'IN_PROGRESS', 'INVALID_TRANSITION');
  reference(input.id);
  const line = lineFor(execution, input.serviceLineId);
  requireValue(line.kind === 'HOTEL' && line.hotel);
  activeRef(input.hotel, 'HOTEL', line.hotel.hotelId);
  activeRef(input.supplier, 'AGENT');
  if (input.leader) activeRef(input.leader, 'LEADER');
  requireValue(input.signText.length <= 200);
  return {
    id: input.id,
    version: 1,
    contractId: execution.snapshot.contractId,
    branchId: execution.snapshot.branchId,
    serviceLineId: line.serviceLineId,
    supplierId: input.supplier.id,
    form: structuredClone(line.hotel),
    leaderId: input.leader?.id ?? null,
    signText: input.signText,
    status: 'DRAFT',
    receipts: [],
    timeline: [],
  };
}
export type HotelCommand =
  | { type: 'SENT'; communicationReference: string }
  | {
      type: 'CONFIRM';
      communicationReference: string;
      confirmationReference: string;
    }
  | { type: 'REJECT'; communicationReference: string }
  | { type: 'VOUCHER'; requestId: string };
/** Input evidence is resolved from authenticated supplier communication, not raw browser claims. */
export function hotelTransition(
  execution: Execution,
  hotel: HotelOperation,
  command: HotelCommand,
  ctx: CommandContext,
): HotelOperation {
  authorize(
    ctx.actor,
    execution.snapshot.branchId,
    command.type === 'VOUCHER'
      ? 'reservations.issue.voucher'
      : command.type === 'SENT'
        ? 'reservations.hotel.request'
        : 'reservations.hotel.confirm',
  );
  requireValue(execution.status === 'IN_PROGRESS', 'INVALID_TRANSITION');
  requireValue(
    hotel.contractId === execution.snapshot.contractId &&
      hotel.branchId === execution.snapshot.branchId,
    'ALLOCATION_MISMATCH',
  );
  const line = lineFor(execution, hotel.serviceLineId);
  requireValue(
    line.kind === 'HOTEL' &&
      line.hotel &&
      fingerprint(line.hotel) === fingerprint(hotel.form),
    'ALLOCATION_MISMATCH',
  );
  utc(ctx.now);
  reference(ctx.idempotencyKey);
  if (command.type === 'VOUCHER')
    issuerFor(ctx.actor, execution.snapshot.legalEntityId);
  const hash = fingerprint({ actorId: ctx.actor.actorId, command });
  const replay = hotel.receipts.find((r) => r.key === ctx.idempotencyKey);
  if (replay) {
    requireValue(hash === replay.fingerprint, 'IDEMPOTENCY_CONFLICT');
    return structuredClone(hotel);
  }
  requireValue(hotel.version === ctx.expectedVersion, 'CONFLICT');
  const next = structuredClone(hotel);
  if (command.type === 'SENT') {
    requireValue(hotel.status === 'DRAFT', 'INVALID_TRANSITION');
    reference(command.communicationReference);
    next.communicationReference = command.communicationReference;
    next.status = 'SENT';
  } else if (command.type === 'CONFIRM' || command.type === 'REJECT') {
    requireValue(
      hotel.status === 'SENT' &&
        command.communicationReference === hotel.communicationReference,
      'SUPPLIER_CORRELATION_MISMATCH',
    );
    next.status =
      command.type === 'CONFIRM' ? 'SUPPLIER_CONFIRMED' : 'REJECTED';
    if (command.type === 'CONFIRM') {
      reference(command.confirmationReference);
      next.confirmationReference = command.confirmationReference;
    }
  } else {
    requireValue(
      hotel.status === 'SUPPLIER_CONFIRMED' && hotel.confirmationReference,
      'SUPPLIER_CONFIRMATION_REQUIRED',
    );
    reference(command.requestId);
    next.status = 'VOUCHER_READY';
    next.voucher = {
      version: 1,
      requestId: command.requestId,
      contractId: execution.snapshot.contractId,
      serviceLineId: hotel.serviceLineId,
      kind: 'VOUCHER',
      operationId: hotel.id,
      issuer: issuerFor(ctx.actor, execution.snapshot.legalEntityId),
      delivery: 'BLOCKED_UNTIL_FINANCE_RELEASE',
    };
  }
  next.version++;
  next.receipts.push({ key: ctx.idempotencyKey, fingerprint: hash });
  next.timeline.push({
    version: 1,
    aggregateId: hotel.id,
    aggregateVersion: next.version,
    actorId: ctx.actor.actorId,
    occurredAt: ctx.now,
    action: `HOTEL_${command.type}`,
    from: hotel.status,
    to: next.status,
    outcome: 'ALLOWED',
  });
  return next;
}
export class UnconfiguredHotelSupplier implements HotelSupplierCommunicationPortV1 {
  async send(): Promise<{ status: 'NOT_CONFIGURED' }> {
    return { status: 'NOT_CONFIGURED' };
  }
}
export class UnconfiguredSamanProvider implements SamanInsuranceProviderPortV1 {
  readonly configuration = 'NOT_CONFIGURED' as const;
  async submit(): Promise<{ status: 'NOT_CONFIGURED' }> {
    return { status: 'NOT_CONFIGURED' };
  }
  async reconcile(): Promise<{ status: 'NOT_CONFIGURED' }> {
    return { status: 'NOT_CONFIGURED' };
  }
}
export interface InsuranceOperation {
  input: InsuranceSubmissionV1;
  version: number;
  status: 'PENDING' | 'SUBMITTED' | 'ISSUED' | 'FAILED' | 'CANCELLED';
  attempts: number;
  retryable: boolean;
  nextAttemptAt: string | null;
  providerReference?: string;
  policyNumber?: string;
}
export function insuranceDraft(
  execution: Execution,
  input: Pick<
    InsuranceSubmissionV1,
    'operationId' | 'idempotencyKey' | 'serviceLineId' | 'passengerId'
  >,
  actor: Actor,
): InsuranceOperation {
  authorize(actor, execution.snapshot.branchId, 'reservations.insurance.issue');
  issuerFor(actor, execution.snapshot.legalEntityId);
  requireValue(execution.status === 'IN_PROGRESS', 'INVALID_TRANSITION');
  reference(input.operationId);
  reference(input.idempotencyKey);
  const line = lineFor(execution, input.serviceLineId);
  requireValue(
    line.kind === 'INSURANCE' &&
      line.insurance &&
      line.passengerIds.includes(input.passengerId),
    'ALLOCATION_MISMATCH',
  );
  return {
    input: {
      ...input,
      ...line.insurance,
      contractId: execution.snapshot.contractId,
    },
    version: 1,
    status: 'PENDING',
    attempts: 0,
    retryable: false,
    nextAttemptAt: null,
  };
}
/** Returns a durable outbox intent; NEVER calls a provider before the caller atomically claims it. */
export function planInsuranceAttempt(
  execution: Execution,
  op: InsuranceOperation,
  actor: Actor,
  now: string,
  expectedVersion: number,
  configuration: SamanInsuranceProviderPortV1['configuration'] = 'NOT_CONFIGURED',
) {
  authorize(actor, execution.snapshot.branchId, 'reservations.insurance.issue');
  issuerFor(actor, execution.snapshot.legalEntityId);
  requireValue(execution.status === 'IN_PROGRESS', 'INVALID_TRANSITION');
  requireValue(
    op.input.contractId === execution.snapshot.contractId,
    'ALLOCATION_MISMATCH',
  );
  const expected = insuranceDraft(execution, op.input, actor);
  requireValue(
    fingerprint(expected.input) === fingerprint(op.input),
    'ALLOCATION_MISMATCH',
  );
  requireValue(op.version === expectedVersion, 'CONFLICT');
  utc(now);
  requireValue(
    op.status === 'PENDING' || (op.status === 'FAILED' && op.retryable),
    'INVALID_TRANSITION',
  );
  requireValue(configuration === 'CONFIGURED', 'NOT_CONFIGURED');
  requireValue(op.attempts < 3, 'RETRY_EXHAUSTED');
  requireValue(
    !op.nextAttemptAt || utc(now) >= utc(op.nextAttemptAt),
    'RETRY_NOT_DUE',
  );
  return {
    next: {
      ...structuredClone(op),
      version: op.version + 1,
      status: 'SUBMITTED' as const,
      attempts: op.attempts + 1,
      retryable: false,
      nextAttemptAt: null,
    },
    outbox: { type: 'SAMAN_SUBMIT' as const, input: structuredClone(op.input) },
  };
}
export function insuranceResult(
  op: InsuranceOperation,
  result: Awaited<ReturnType<SamanInsuranceProviderPortV1['submit']>>,
  now: string,
  expectedVersion: number,
): InsuranceOperation {
  requireValue(op.version === expectedVersion, 'CONFLICT');
  requireValue(op.status === 'SUBMITTED', 'INVALID_TRANSITION');
  utc(now);
  const next = structuredClone(op);
  if (
    result.status === 'NOT_CONFIGURED' ||
    result.status === 'UNKNOWN' ||
    result.status === 'SUBMITTED'
  ) {
    // Unknown outcomes stay submitted: reconcile; never blindly issue again.
    if (result.status === 'SUBMITTED') {
      reference(result.providerReference);
      requireValue(
        !next.providerReference ||
          next.providerReference === result.providerReference,
        'PROVIDER_CORRELATION_MISMATCH',
      );
      if (!next.providerReference) {
        next.providerReference = result.providerReference;
        next.version++;
      }
    }
    return next;
  }
  next.version++;
  if (result.status === 'ISSUED') {
    reference(result.providerReference);
    reference(result.policyNumber);
    requireValue(
      !next.providerReference ||
        next.providerReference === result.providerReference,
      'PROVIDER_CORRELATION_MISMATCH',
    );
    next.status = 'ISSUED';
    next.providerReference = result.providerReference;
    next.policyNumber = result.policyNumber;
  } else {
    next.status = 'FAILED';
    next.retryable = result.retryable && next.attempts < 3;
    next.nextAttemptAt = next.retryable
      ? new Date(utc(now) + 30_000 * 2 ** (next.attempts - 1)).toISOString()
      : null;
  }
  return next;
}
export interface DeliveryDocument {
  documentId: string;
  contractId: string;
  branchId: string;
  issued: boolean;
}
/** Returns audit even on denial. Caller must append it durably before returning a response. */
export function deliveryDecision(
  doc: DeliveryDocument,
  release: FinanceReleaseProjectionV1 | null,
  actor: Actor,
  now: string,
): {
  allowed: boolean;
  audit: ReservationStatusEventV1;
} {
  utc(now);
  let reasonCode = 'APPROVED';
  try {
    authorize(actor, doc.branchId, 'reservations.deliver');
    reference(doc.documentId);
    reference(doc.contractId);
    requireValue(doc.issued, 'DOCUMENT_NOT_ISSUED');
    requireValue(
      release &&
        release.version === 1 &&
        release.projectionVersion > 0 &&
        release.contractId === doc.contractId &&
        release.branchId === doc.branchId &&
        release.documentIds.includes(doc.documentId),
      'RELEASE_MISMATCH',
    );
    fresh(release.checkedAt, now);
    requireValue(
      release.status === 'APPROVED' &&
        (!release.expiresAt || utc(release.expiresAt) > utc(now)),
      'FINANCIAL_RELEASE_REQUIRED',
    );
  } catch (error) {
    reasonCode = error instanceof Error ? error.message : 'DENIED';
  }
  const allowed = reasonCode === 'APPROVED';
  return {
    allowed,
    audit: {
      version: 1,
      aggregateId: doc.documentId,
      aggregateVersion: 0,
      actorId: actor.authenticated ? actor.actorId : 'anonymous',
      occurredAt: now,
      action: 'DELIVERY',
      from: 'NOT_DELIVERED',
      to: allowed ? 'AUTHORIZED' : 'NOT_DELIVERED',
      outcome: allowed ? 'ALLOWED' : 'DENIED',
      reasonCode,
    },
  };
}
export interface ManifestMember {
  contractId: string;
  branchId: string;
  serviceLineId: string;
  passengerId: string;
  segmentId: string;
  originId: string;
  destinationId: string;
  departureAt: string;
  carrierId: string;
  transportNumber: string;
  legalEntityId: string;
  companyOwned: boolean;
}
export interface Manifest {
  key: string;
  version: number;
  template: ManifestTemplateV1;
  members: ManifestMember[];
  status: 'DRAFT' | 'VALIDATED' | 'READY' | 'SENT' | 'ACKNOWLEDGED';
  history: ReservationStatusEventV1[];
}
export function groupManifest(
  members: readonly ManifestMember[],
  templates: readonly ManifestTemplateV1[],
  actor: Actor,
): Manifest[] {
  const groups = new Map<string, Manifest>();
  const seen = new Set<string>();
  for (const member of members) {
    authorize(actor, member.branchId, 'reservations.manifest.manage');
    issuerFor(actor, member.legalEntityId);
    requireValue(member.companyOwned, 'COMPANY_CAPACITY_REQUIRED');
    utc(member.departureAt);
    [
      member.contractId,
      member.serviceLineId,
      member.passengerId,
      member.segmentId,
      member.originId,
      member.destinationId,
      member.carrierId,
    ].forEach(reference);
    const identity = fingerprint([
      member.contractId,
      member.serviceLineId,
      member.passengerId,
      member.segmentId,
    ]);
    requireValue(!seen.has(identity), 'DUPLICATE_MANIFEST_MEMBER');
    seen.add(identity);
    const key = fingerprint([
      member.branchId,
      member.originId,
      member.destinationId,
      member.departureAt,
      member.carrierId,
      member.transportNumber,
      member.legalEntityId,
    ]);
    const candidates = templates.filter(
      (t) => t.active && t.carrierId === member.carrierId,
    );
    requireValue(candidates.length === 1, 'TEMPLATE_UNAVAILABLE');
    const template = candidates[0];
    requireValue(template);
    reference(template.templateId);
    requireValue(
      Number.isSafeInteger(template.version) && template.version > 0,
    );
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        version: 1,
        template: { ...template },
        members: [],
        status: 'DRAFT',
        history: [],
      };
      groups.set(key, group);
    }
    group.members.push({ ...member });
  }
  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key));
}
export function manifestTransition(
  manifest: Manifest,
  target: Manifest['status'],
  actor: Actor,
  now: string,
  expectedVersion: number,
): Manifest {
  requireValue(manifest.members.length > 0);
  utc(now);
  manifest.members.forEach((m) => {
    authorize(actor, m.branchId, 'reservations.manifest.manage');
    issuerFor(actor, m.legalEntityId);
  });
  requireValue(manifest.version === expectedVersion, 'CONFLICT');
  const edges: Record<Manifest['status'], Manifest['status'] | null> = {
    DRAFT: 'VALIDATED',
    VALIDATED: 'READY',
    READY: 'SENT',
    SENT: 'ACKNOWLEDGED',
    ACKNOWLEDGED: null,
  };
  requireValue(edges[manifest.status] === target, 'INVALID_TRANSITION');
  const next = structuredClone(manifest);
  next.version++;
  next.status = target;
  next.history.push({
    version: 1,
    aggregateId: next.key,
    aggregateVersion: next.version,
    actorId: actor.actorId,
    occurredAt: now,
    action: `MANIFEST_${target}`,
    from: manifest.status,
    to: target,
    outcome: 'ALLOWED',
  });
  return next;
}
