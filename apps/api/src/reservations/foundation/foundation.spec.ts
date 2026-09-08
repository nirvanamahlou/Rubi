import { describe, expect, it } from 'vitest';
import {
  permissions,
  type Actor,
  type SalesReservationRequestV1,
  type TicketOfferReferenceV1,
} from './contracts';
import {
  execute,
  intake,
  validateRequest,
  type CommandContext,
  type ExecutionCommand,
} from './execution';
import {
  deliveryDecision,
  groupManifest,
  hotelDraft,
  hotelTransition,
  insuranceDraft,
  insuranceResult,
  manifestTransition,
  netPurchase,
  planInsuranceAttempt as planAttempt,
  proposeCost,
  UnconfiguredHotelSupplier,
  UnconfiguredSamanProvider,
  type ManifestMember,
} from './operations';

const planInsuranceAttempt = (...args: Parameters<typeof planAttempt>) =>
  planAttempt(args[0], args[1], args[2], args[3], args[4], 'CONFIGURED');
const now = '2026-09-08T09:00:00.000Z';
const actor: Actor = {
  actorId: 'test-actor',
  authenticated: true,
  branchIds: ['branch-a'],
  permissions,
  issuer: {
    mode: 'SINGLE',
    legalEntityId: 'issuer-a',
    active: true,
    brandingSnapshotId: 'brand-v1',
    brandingVersion: 1,
  },
};
function request(): SalesReservationRequestV1 {
  return {
    version: 1,
    requestId: 'request-test',
    contractId: 'contract-test',
    contractNumber: 'TEST-001',
    contractVersion: 1,
    branchId: 'branch-a',
    legalEntityId: 'issuer-a',
    salesCounterId: 'counter-test',
    customerId: 'customer-test',
    customerDisplayName: 'Test customer',
    passengers: [
      {
        passengerId: 'passenger-test',
        customerId: null,
        displayName: 'Test passenger',
        informationComplete: true,
      },
    ],
    services: [
      {
        serviceLineId: 'flight-test',
        kind: 'FLIGHT',
        offerId: 'offer-test',
        passengerIds: ['passenger-test'],
        segments: [
          {
            segmentId: 'segment-test',
            originId: 'origin-test',
            destinationId: 'destination-test',
            departureAt: '2026-09-10T09:00:00.000Z',
            carrierId: 'carrier-test',
            transportNumber: 'TEST-01',
          },
        ],
      },
      {
        serviceLineId: 'hotel-test',
        kind: 'HOTEL',
        passengerIds: ['passenger-test'],
        segments: [],
        hotel: {
          hotelId: 'hotel-ref',
          checkIn: '2026-09-10T12:00:00.000Z',
          checkOut: '2026-09-12T12:00:00.000Z',
          rooms: [
            {
              roomId: 'room-test',
              roomTypeId: 'room-type-test',
              passengerIds: ['passenger-test'],
            },
          ],
          passengerRequests: '',
        },
      },
      {
        serviceLineId: 'insurance-test',
        kind: 'INSURANCE',
        passengerIds: ['passenger-test'],
        segments: [],
        insurance: {
          countryId: 'country-test',
          startsAt: '2026-09-10T00:00:00.000Z',
          endsAt: '2026-09-12T00:00:00.000Z',
          planId: 'plan-test',
        },
      },
    ],
    priority: 'NORMAL',
    dueAt: '2026-09-09T09:00:00.000Z',
    createdAt: now,
  };
}
const offer: TicketOfferReferenceV1 = {
  offerId: 'offer-test',
  version: 1,
  branchId: 'branch-a',
  active: true,
  companyOwned: true,
  availableCapacity: 1,
  checkedAt: now,
  allocation: {
    contractId: 'contract-test',
    serviceLineId: 'flight-test',
    passengerIds: ['passenger-test'],
  },
};
function ctx(version: number, key = `key-${version}`): CommandContext {
  return { actor, now, expectedVersion: version, idempotencyKey: key };
}
function started() {
  let op = intake(request(), actor, now);
  for (const command of [
    { type: 'REVIEW' },
    { type: 'MARK_READY', offers: [offer] },
    {
      type: 'ASSIGN',
      assigneeId: 'staff-test',
      assigneeBranchIds: ['branch-a'],
    },
    { type: 'START' },
  ] as ExecutionCommand[])
    op = execute(op, command, ctx(op.version));
  return op;
}
function readyTicket() {
  let op = started();
  op = execute(
    op,
    {
      type: 'TICKET_DRAFT',
      operationId: 'ticket-test',
      serviceLineId: 'flight-test',
      passengerId: 'passenger-test',
      segmentId: 'segment-test',
    },
    ctx(op.version),
  );
  return execute(
    op,
    { type: 'TICKET_READY', operationId: 'ticket-test' },
    ctx(op.version),
  );
}
const issue: ExecutionCommand = {
  type: 'TICKET_ISSUE',
  operationId: 'ticket-test',
  internalCode: 'internal-test',
  offer,
};

describe('reservation execution policies', () => {
  it('clones intake snapshots and follows the request state machine', () => {
    const input = request();
    const op = intake(input, actor, now);
    input.contractNumber = 'changed';
    expect(op.snapshot.contractNumber).toBe('TEST-001');
    expect(started().status).toBe('IN_PROGRESS');
    expect(() => execute(op, { type: 'START' }, ctx(op.version))).toThrow(
      'INVALID_TRANSITION',
    );
  });
  it.each(['UNAUTHORIZED', 'FORBIDDEN'] as const)('denies %s', (code) => {
    const denied =
      code === 'UNAUTHORIZED'
        ? { ...actor, authenticated: false }
        : { ...actor, permissions: [] };
    expect(() => intake(request(), denied, now)).toThrow(code);
  });
  it('denies cross-branch access and assignee scope', () => {
    expect(() =>
      intake(request(), { ...actor, branchIds: ['branch-b'] }, now),
    ).toThrow('FORBIDDEN');
    const op = started();
    expect(() =>
      execute(
        op,
        { type: 'ASSIGN', assigneeId: 'staff-test', assigneeBranchIds: [] },
        ctx(op.version),
      ),
    ).toThrow('ASSIGNEE_SCOPE');
  });
  it('returns defects to Sales without editing the snapshot', () => {
    const op = intake(request(), actor, now);
    const result = execute(
      op,
      { type: 'RETURN_TO_SALES', reasonCode: 'SERVICE_CORRECTION' },
      ctx(op.version),
    );
    expect(result.status).toBe('RETURNED_TO_SALES');
    expect(result.snapshot).toEqual(op.snapshot);
  });
  it('rejects incomplete passengers and unavailable capacity', () => {
    const input = request();
    input.passengers = [
      { ...input.passengers[0]!, informationComplete: false },
    ];
    const op = execute(intake(input, actor, now), { type: 'REVIEW' }, ctx(1));
    expect(() =>
      execute(op, { type: 'MARK_READY', offers: [offer] }, ctx(op.version)),
    ).toThrow('MISSING_PASSENGER_DATA');
    const good = execute(
      intake(request(), actor, now),
      { type: 'REVIEW' },
      ctx(1),
    );
    expect(() =>
      execute(
        good,
        { type: 'MARK_READY', offers: [{ ...offer, active: false }] },
        ctx(good.version),
      ),
    ).toThrow('OFFER_UNAVAILABLE');
  });
  it('issues company internal confirmation without inventing an official ticket', () => {
    const op = readyTicket();
    const result = execute(op, issue, ctx(op.version));
    expect(result.tickets[0]?.status).toBe('ISSUED');
    expect(result.tickets[0]?.official).toBeUndefined();
    expect(result.tickets[0]?.issuer?.brandingSnapshotId).toBe('brand-v1');
  });
  it('replays exactly and rejects a new-key duplicate or altered-key payload', () => {
    const op = readyTicket();
    const context = ctx(op.version);
    const issued = execute(op, issue, context);
    expect(execute(issued, issue, context)).toEqual(issued);
    expect(() =>
      execute(issued, issue, ctx(issued.version, 'different-key')),
    ).toThrow('DUPLICATE_ISSUANCE');
    expect(() =>
      execute(issued, { ...issue, internalCode: 'changed' }, context),
    ).toThrow('IDEMPOTENCY_CONFLICT');
    expect(() =>
      execute(issued, issue, {
        ...context,
        actor: { ...actor, permissions: [] },
      }),
    ).toThrow('FORBIDDEN');
  });
  it('rejects duplicate passenger/segment drafts with different operation IDs', () => {
    const op = readyTicket();
    expect(() =>
      execute(
        op,
        {
          type: 'TICKET_DRAFT',
          operationId: 'other-ticket',
          serviceLineId: 'flight-test',
          passengerId: 'passenger-test',
          segmentId: 'segment-test',
        },
        ctx(op.version),
      ),
    ).toThrow('DUPLICATE_ISSUANCE');
  });
  it('rejects stale versions and never mutates the input', () => {
    const op = readyTicket();
    const copy = structuredClone(op);
    expect(() => execute(op, issue, ctx(1))).toThrow('CONFLICT');
    expect(op).toEqual(copy);
  });
  it('denies ALL and inactive or different issuer contexts', () => {
    const op = readyTicket();
    expect(() =>
      execute(op, issue, {
        ...ctx(op.version),
        actor: { ...actor, issuer: { mode: 'ALL' } },
      }),
    ).toThrow('ALL_CONTEXT_FORBIDDEN');
    expect(() =>
      execute(op, issue, {
        ...ctx(op.version),
        actor: {
          ...actor,
          issuer: {
            mode: 'SINGLE',
            legalEntityId: 'issuer-other',
            active: true,
            brandingSnapshotId: 'brand',
            brandingVersion: 1,
          },
        },
      }),
    ).toThrow('ISSUER_MISMATCH');
  });
  it('requires confirmed capacity and provider evidence for third-party offers', () => {
    const op = readyTicket();
    const { allocation: _, ...unallocated } = offer;
    void _;
    expect(() =>
      execute(op, { ...issue, offer: unallocated }, ctx(op.version)),
    ).toThrow('CAPACITY_ALLOCATION_REQUIRED');
    expect(() =>
      execute(
        op,
        { ...issue, offer: { ...offer, companyOwned: false } },
        ctx(op.version),
      ),
    ).toThrow('PROVIDER_EVIDENCE_REQUIRED');
  });
  it('requires Stop permission and reason, and prevents issuing stopped tickets', () => {
    const op = readyTicket();
    const command = {
      type: 'TICKET_STOP' as const,
      operationId: 'ticket-test',
      reason: 'Supplier delay',
    };
    expect(() =>
      execute(op, command, {
        ...ctx(op.version),
        actor: { ...actor, permissions: ['reservations.read'] },
      }),
    ).toThrow('FORBIDDEN');
    expect(() =>
      execute(op, { ...command, reason: ' ' }, ctx(op.version)),
    ).toThrow('STOP_REASON_REQUIRED');
    const stopped = execute(op, command, ctx(op.version));
    expect(stopped.tickets[0]?.status).toBe('STOPPED');
    expect(JSON.stringify(stopped.timeline)).not.toContain('Supplier delay');
    expect(() => execute(stopped, issue, ctx(stopped.version))).toThrow(
      'DUPLICATE_ISSUANCE',
    );
  });
  it('validates UTC calendar dates and immutable passenger room allocation', () => {
    const bad = request();
    bad.createdAt = '2026-02-30T09:00:00.000Z';
    expect(() => validateRequest(bad)).toThrow('VALIDATION');
    const badRoom = request();
    badRoom.services = badRoom.services.map((s) =>
      s.hotel ? { ...s, hotel: { ...s.hotel, rooms: [] } } : s,
    );
    expect(() => validateRequest(badRoom)).toThrow('VALIDATION');
  });
});

describe('travel operations and release', () => {
  it.each([
    ['0.3', '0.1', '0', '0.2'],
    ['100.00', '0', '0', '100'],
    ['9007199254740993.01', '0.01', '0.1', '9007199254740993.1'],
  ])(
    'calculates exact Decimal %s - %s + %s',
    (gross, discount, fees, expected) => {
      const money = (amount: string) => ({ amount, currencyCode: 'USD' });
      expect(
        netPurchase(money(gross), money(discount), money(fees)).amount,
      ).toBe(expected);
    },
  );
  it('rejects mixed currency, exponent, negative and excess discount', () => {
    const money = (amount: string) => ({ amount, currencyCode: 'USD' });
    expect(() => netPurchase(money('1'), money('2'), money('0'))).toThrow(
      'DISCOUNT_EXCEEDS_PURCHASE',
    );
    expect(() => netPurchase(money('1e3'), money('0'), money('0'))).toThrow(
      'INVALID_DECIMAL',
    );
    expect(() => netPurchase(money('-1'), money('0'), money('0'))).toThrow(
      'INVALID_DECIMAL',
    );
    expect(() =>
      netPurchase(money('1'), { amount: '0', currencyCode: 'IRR' }, money('0')),
    ).toThrow('CURRENCY_MISMATCH');
  });
  it('publishes only a referenced cost proposal', () => {
    const money = { amount: '1', currencyCode: 'USD' };
    const result = proposeCost(
      started(),
      {
        serviceLineId: 'hotel-test',
        supplierId: 'supplier-test',
        initial: money,
        discount: { ...money, amount: '0' },
        fees: { ...money, amount: '0' },
      },
      actor,
      now,
    );
    expect(result.contractId).toBe('contract-test');
    expect(result.net.amount).toBe('1');
    expect(result.occurredAt).toBe(now);
  });
  it('requires correlated supplier confirmation and records branded voucher intent', () => {
    const op = started();
    let hotel = hotelDraft(
      op,
      {
        id: 'hotel-op',
        serviceLineId: 'hotel-test',
        hotel: { id: 'hotel-ref', kind: 'HOTEL', active: true },
        supplier: { id: 'agent-test', kind: 'AGENT', active: true },
        signText: '',
      },
      actor,
    );
    expect(() =>
      hotelTransition(
        op,
        hotel,
        { type: 'VOUCHER', requestId: 'voucher-test' },
        ctx(hotel.version),
      ),
    ).toThrow('SUPPLIER_CONFIRMATION_REQUIRED');
    hotel = hotelTransition(
      op,
      hotel,
      { type: 'SENT', communicationReference: 'communication-test' },
      ctx(hotel.version),
    );
    expect(() =>
      hotelTransition(
        op,
        hotel,
        {
          type: 'CONFIRM',
          communicationReference: 'wrong',
          confirmationReference: 'confirmed',
        },
        ctx(hotel.version),
      ),
    ).toThrow('SUPPLIER_CORRELATION_MISMATCH');
    hotel = hotelTransition(
      op,
      hotel,
      {
        type: 'CONFIRM',
        communicationReference: 'communication-test',
        confirmationReference: 'confirmed',
      },
      ctx(hotel.version),
    );
    const voucher = hotelTransition(
      op,
      hotel,
      { type: 'VOUCHER', requestId: 'voucher-test' },
      ctx(hotel.version),
    );
    expect(voucher.voucher?.delivery).toBe('BLOCKED_UNTIL_FINANCE_RELEASE');
    expect(voucher.voucher?.issuer.brandingVersion).toBe(1);
  });
  const doc = {
    documentId: 'doc-test',
    contractId: 'contract-test',
    branchId: 'branch-a',
    issued: true,
  };
  const release = {
    version: 1 as const,
    projectionVersion: 1,
    contractId: 'contract-test',
    branchId: 'branch-a',
    documentIds: ['doc-test'],
    status: 'APPROVED' as const,
    checkedAt: now,
    expiresAt: null,
  };
  it.each(['BLOCKED', 'CONDITIONAL'] as const)(
    'denies and audits delivery for %s',
    (status) => {
      const result = deliveryDecision(doc, { ...release, status }, actor, now);
      expect(result.allowed).toBe(false);
      expect(result.audit.outcome).toBe('DENIED');
    },
  );
  it('allows only fresh, matching, unexpired APPROVED release and permissions', () => {
    expect(deliveryDecision(doc, release, actor, now).allowed).toBe(true);
    for (const projection of [
      null,
      { ...release, documentIds: [] },
      { ...release, checkedAt: '2026-09-08T08:00:00.000Z' },
      { ...release, expiresAt: now },
      { ...release, branchId: 'branch-b' },
    ])
      expect(deliveryDecision(doc, projection, actor, now).allowed).toBe(false);
    expect(
      deliveryDecision(doc, release, { ...actor, permissions: [] }, now).audit
        .reasonCode,
    ).toBe('FORBIDDEN');
    expect(
      deliveryDecision(doc, release, { ...actor, authenticated: false }, now)
        .audit.actorId,
    ).toBe('anonymous');
  });
  it('keeps real providers explicitly unconfigured', async () => {
    expect(await new UnconfiguredSamanProvider().submit()).toEqual({
      status: 'NOT_CONFIGURED',
    });
    expect(await new UnconfiguredHotelSupplier().send()).toEqual({
      status: 'NOT_CONFIGURED',
    });
  });
  it('uses bounded insurance retry with the same key and reconciles ambiguous outcomes', () => {
    const op = started();
    const draft = insuranceDraft(
      op,
      {
        operationId: 'insurance-op',
        idempotencyKey: 'insurance-key',
        serviceLineId: 'insurance-test',
        passengerId: 'passenger-test',
      },
      actor,
    );
    expect(() => planAttempt(op, draft, actor, now, 1)).toThrow(
      'NOT_CONFIGURED',
    );
    const claim = planInsuranceAttempt(op, draft, actor, now, 1);
    expect(claim.outbox.input.idempotencyKey).toBe('insurance-key');
    expect(() =>
      planInsuranceAttempt(op, claim.next, actor, now, claim.next.version),
    ).toThrow('INVALID_TRANSITION');
    expect(
      insuranceResult(
        claim.next,
        { status: 'UNKNOWN' },
        now,
        claim.next.version,
      ).status,
    ).toBe('SUBMITTED');
    const failed = insuranceResult(
      claim.next,
      { status: 'FAILED', retryable: true, reasonCode: 'UNAVAILABLE' },
      now,
      claim.next.version,
    );
    expect(() =>
      planInsuranceAttempt(op, failed, actor, now, failed.version),
    ).toThrow('RETRY_NOT_DUE');
    const retry = planInsuranceAttempt(
      op,
      failed,
      actor,
      failed.nextAttemptAt!,
      failed.version,
    );
    expect(retry.outbox.input).toEqual(claim.outbox.input);
    expect(() =>
      planInsuranceAttempt(
        op,
        { ...failed, attempts: 3 },
        actor,
        failed.nextAttemptAt!,
        failed.version,
      ),
    ).toThrow('RETRY_EXHAUSTED');
    const issued = insuranceResult(
      retry.next,
      {
        status: 'ISSUED',
        policyNumber: 'TEST-POLICY',
        providerReference: 'TEST-PROVIDER',
      },
      failed.nextAttemptAt!,
      retry.next.version,
    );
    expect(() =>
      planInsuranceAttempt(op, issued, actor, now, issued.version),
    ).toThrow('INVALID_TRANSITION');
  });
  it('groups company manifests with immutable template version and actor/time history', () => {
    const member: ManifestMember = {
      contractId: 'contract-test',
      branchId: 'branch-a',
      serviceLineId: 'flight-test',
      passengerId: 'passenger-test',
      segmentId: 'segment-test',
      originId: 'origin-test',
      destinationId: 'destination-test',
      departureAt: now,
      carrierId: 'carrier-test',
      transportNumber: 'TEST-01',
      legalEntityId: 'issuer-a',
      companyOwned: true,
    };
    const template = {
      templateId: 'template-test',
      carrierId: 'carrier-test',
      version: 3,
      active: true,
    };
    const groups = groupManifest(
      [
        member,
        { ...member, passengerId: 'passenger-two' },
        {
          ...member,
          passengerId: 'passenger-three',
          transportNumber: 'TEST-02',
        },
      ],
      [template],
      actor,
    );
    expect(groups.map((g) => g.members.length).sort()).toEqual([1, 2]);
    template.version = 4;
    let manifest = groups[0]!;
    expect(manifest.template.version).toBe(3);
    for (const target of [
      'VALIDATED',
      'READY',
      'SENT',
      'ACKNOWLEDGED',
    ] as const)
      manifest = manifestTransition(
        manifest,
        target,
        actor,
        now,
        manifest.version,
      );
    expect(manifest.history[2]).toMatchObject({
      actorId: actor.actorId,
      occurredAt: now,
      to: 'SENT',
    });
    expect(() =>
      groupManifest([{ ...member, companyOwned: false }], [template], actor),
    ).toThrow('COMPANY_CAPACITY_REQUIRED');
    expect(() => groupManifest([member, member], [template], actor)).toThrow(
      'DUPLICATE_MANIFEST_MEMBER',
    );
    expect(() => groupManifest([member], [], actor)).toThrow(
      'TEMPLATE_UNAVAILABLE',
    );
  });
});

it('does not cancel an in-progress request with unresolved hotel/insurance operations', () => {
  const op = started();
  expect(() => execute(op, { type: 'CANCEL' }, ctx(op.version))).toThrow(
    'ACTIVE_OPERATIONS_REQUIRE_RECONCILIATION',
  );
});
it('increments insurance projection version when provider correlation is first recorded', () => {
  const op = started();
  const draft = insuranceDraft(
    op,
    {
      operationId: 'insurance-op',
      idempotencyKey: 'insurance-key',
      serviceLineId: 'insurance-test',
      passengerId: 'passenger-test',
    },
    actor,
  );
  const submitted = planInsuranceAttempt(
    op,
    draft,
    actor,
    now,
    draft.version,
  ).next;
  const recorded = insuranceResult(
    submitted,
    { status: 'SUBMITTED', providerReference: 'provider-one' },
    now,
    submitted.version,
  );
  expect(recorded.version).toBe(submitted.version + 1);
  expect(() =>
    insuranceResult(
      recorded,
      {
        status: 'ISSUED',
        providerReference: 'provider-other',
        policyNumber: 'test-policy',
      },
      now,
      recorded.version,
    ),
  ).toThrow('PROVIDER_CORRELATION_MISMATCH');
});
it('rejects hotel operation reuse across contracts', () => {
  const op = started();
  const hotel = hotelDraft(
    op,
    {
      id: 'hotel-op',
      serviceLineId: 'hotel-test',
      hotel: { id: 'hotel-ref', kind: 'HOTEL', active: true },
      supplier: { id: 'agent-test', kind: 'AGENT', active: true },
      signText: '',
    },
    actor,
  );
  const other = {
    ...op,
    snapshot: { ...op.snapshot, contractId: 'other-contract' },
  };
  expect(() =>
    hotelTransition(
      other,
      hotel,
      { type: 'SENT', communicationReference: 'communication-test' },
      ctx(hotel.version),
    ),
  ).toThrow('ALLOCATION_MISMATCH');
});
