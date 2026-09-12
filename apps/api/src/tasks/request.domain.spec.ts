import { describe, expect, it } from 'vitest';
import {
  canReadRequest,
  decideRequest,
  evaluateSla,
  RequestPolicyError,
  requestStates,
  type RequestActor,
  type RequestSnapshot,
} from './request.domain';

const permissions = [
  'workbench.access',
  ...[
    'read_own',
    'queue.read',
    'create',
    'claim',
    'assign',
    'route',
    'respond',
    'approve',
    'close',
    'reopen',
    'change_due',
  ].map((p) => `workbench.requests.${p}`),
];
const actor = (userId = 'agent'): RequestActor => ({
  userId,
  active: true,
  branchIds: ['branch'],
  permissions,
  unitIds: ['unit'],
  supervisedUnitIds: [],
});
const request = (): RequestSnapshot => ({
  id: 'request',
  trackingNumber: 'TEST-ONLY',
  senderId: 'sender',
  branchId: 'branch',
  unitId: 'unit',
  recipientId: null,
  assigneeId: null,
  approverId: null,
  state: 'SUBMITTED',
  version: 1,
  kind: 'GENERAL',
  dueAt: null,
  result: null,
  domainActionId: null,
});

describe('Tasks general request policy (no persistence)', () => {
  it('requires responsible-party consent after work starts and domain settlement for specialized cancellation', () => {
    const current = {
      ...request(),
      state: 'IN_PROGRESS' as const,
      assigneeId: 'agent',
    };
    const command = {
      action: 'cancel' as const,
      expectedVersion: 1,
      reason: 'لغو آزمایشی',
    };
    expect(() => decideRequest(current, actor('sender'), command)).toThrow(
      'VALIDATION_ERROR',
    );
    const cancellation = {
      requestId: current.id,
      version: 1,
      approvedByResponsibleParty: true,
      domainOperationSettled: false,
    };
    expect(
      decideRequest(current, actor('sender'), command, { cancellation }).state,
    ).toBe('CANCELLED');
    expect(() =>
      decideRequest(
        { ...current, kind: 'SPECIALIZED' },
        actor('sender'),
        command,
        { cancellation },
      ),
    ).toThrow('VALIDATION_ERROR');
    expect(() =>
      decideRequest(current, actor('sender'), command, {
        cancellation: { ...cancellation, version: 2 },
      }),
    ).toThrow('VALIDATION_ERROR');
  });
  it('models claim → response → completion → sender confirmation without changing source', () => {
    const initial = request();
    const claimed = decideRequest(initial, actor(), {
      action: 'claim',
      expectedVersion: 1,
    });
    const response = decideRequest(claimed, actor(), {
      action: 'respond',
      expectedVersion: 2,
      text: 'پاسخ آزمایشی',
    });
    const complete = decideRequest(response, actor(), {
      action: 'complete',
      expectedVersion: 3,
      text: 'نتیجه آزمایشی',
    });
    const closed = decideRequest(complete, actor('sender'), {
      action: 'close',
      expectedVersion: 4,
    });
    expect(closed).toMatchObject({
      state: 'CLOSED',
      version: 5,
      domainActionId: null,
    });
    expect(initial).toEqual(request());
  });
  it('submits only to a destination validated by the owner', () => {
    const draft = { ...request(), state: 'DRAFT' as const };
    const destination = { unitId: 'unit', recipientId: null };
    const command = {
      action: 'submit' as const,
      expectedVersion: 1,
      destination,
    };
    expect(() => decideRequest(draft, actor('sender'), command)).toThrow(
      'VALIDATION_ERROR',
    );
    expect(
      decideRequest(draft, actor('sender'), command, { destination }).state,
    ).toBe('SUBMITTED');
  });
  it('does not expose drafts to a unit supervisor', () => {
    expect(
      canReadRequest(
        { ...request(), state: 'DRAFT' },
        { ...actor(), supervisedUnitIds: ['unit'] },
      ),
    ).toBe(false);
  });
  it.each([
    { active: false },
    { branchIds: [] },
    { permissions: [] },
    { unitIds: [], supervisedUnitIds: [], userId: 'stranger' },
  ])('denies out-of-scope reads and commands: %j', (patch) => {
    const other = { ...actor(), ...patch };
    expect(canReadRequest(request(), other)).toBe(false);
    expect(() =>
      decideRequest(request(), other, { action: 'claim', expectedVersion: 1 }),
    ).toThrow('NOT_FOUND');
  });
  it('requires claim permission even for a visible queue', () => {
    expect(() =>
      decideRequest(
        request(),
        {
          ...actor(),
          permissions: permissions.filter((p) => !p.endsWith('.claim')),
        },
        { action: 'claim', expectedVersion: 1 },
      ),
    ).toThrow('FORBIDDEN');
  });
  it('returns authorized current owner on a stale version (not a database race test)', () => {
    const claimed = decideRequest(request(), actor(), {
      action: 'claim',
      expectedVersion: 1,
    });
    try {
      decideRequest(claimed, actor('second'), {
        action: 'claim',
        expectedVersion: 1,
      });
      expect.fail('stale command accepted');
    } catch (error) {
      expect(error).toBeInstanceOf(RequestPolicyError);
      expect(error).toMatchObject({
        code: 'CONCURRENT_MODIFICATION',
        currentAssigneeId: 'agent',
      });
    }
  });
  it('rejects unknown/malformed versions', () => {
    for (const expectedVersion of [NaN, 0, -1, 1.5, Infinity])
      expect(() =>
        decideRequest(request(), actor(), { action: 'claim', expectedVersion }),
      ).toThrow('VALIDATION_ERROR');
  });
  it.each(requestStates.filter((s) => s !== 'IN_PROGRESS'))(
    'cannot complete from %s',
    (state) => {
      const source = {
        ...request(),
        state,
        assigneeId: 'agent',
        senderId: 'agent',
      };
      expect(() =>
        decideRequest(source, actor(), {
          action: 'complete',
          expectedVersion: 1,
          text: 'نتیجه',
        }),
      ).toThrow('INVALID_TRANSITION');
      expect(source.state).toBe(state);
    },
  );
  it('requires result and a successful owner reference for specialized completion', () => {
    const current = {
      ...request(),
      state: 'IN_PROGRESS' as const,
      assigneeId: 'agent',
      kind: 'SPECIALIZED' as const,
    };
    const command = {
      action: 'complete' as const,
      expectedVersion: 1,
      text: 'نتیجه',
    };
    expect(() => decideRequest(current, actor(), command)).toThrow(
      'VALIDATION_ERROR',
    );
    expect(() =>
      decideRequest(current, actor(), command, {
        domainAction: { id: 'op', requestId: 'other', successful: true },
      }),
    ).toThrow();
    expect(() =>
      decideRequest(current, actor(), command, {
        domainAction: { id: 'op', requestId: current.id, successful: false },
      }),
    ).toThrow();
    expect(
      decideRequest(current, actor(), command, {
        domainAction: { id: 'op', requestId: current.id, successful: true },
      }).domainActionId,
    ).toBe('op');
    expect(() =>
      decideRequest(current, actor(), { ...command, text: ' ' }),
    ).toThrow();
  });
  it('requires sender identity to close even with all permissions', () => {
    expect(() =>
      decideRequest(
        { ...request(), state: 'COMPLETED', assigneeId: 'agent' },
        actor(),
        { action: 'close', expectedVersion: 1 },
      ),
    ).toThrow('FORBIDDEN');
  });
  it('requires reasons for route/reject/cancel/reopen and due change', () => {
    for (const action of [
      'route',
      'reject',
      'cancel',
      'change_due',
      'reopen',
    ] as const) {
      expect(() =>
        decideRequest(
          {
            ...request(),
            state: action === 'reopen' ? 'COMPLETED' : 'IN_PROGRESS',
            assigneeId: 'sender',
          },
          actor('sender'),
          { action, expectedVersion: 1 },
        ),
      ).toThrow('VALIDATION_ERROR');
    }
  });
  it('preserves tracking on routing and clears the previous assignee', () => {
    const destination = { unitId: 'second-unit', recipientId: null };
    const next = decideRequest(
      { ...request(), assigneeId: 'agent', state: 'IN_PROGRESS' },
      actor(),
      {
        action: 'route',
        expectedVersion: 1,
        reason: 'بررسی واحد دوم',
        destination,
      },
      { destination },
    );
    expect(next).toMatchObject({
      trackingNumber: 'TEST-ONLY',
      unitId: 'second-unit',
      assigneeId: null,
      state: 'ROUTED',
    });
  });
  it('allows the sender to reopen and invalidates prior completion evidence', () => {
    const next = decideRequest(
      {
        ...request(),
        state: 'CLOSED',
        assigneeId: 'agent',
        result: 'old',
        domainActionId: 'old',
      },
      actor('sender'),
      { action: 'reopen', expectedVersion: 1, reason: 'نیازمند اصلاح' },
    );
    expect(next).toMatchObject({
      state: 'IN_PROGRESS',
      result: null,
      domainActionId: null,
    });
  });
  it('only the designated approver can approve; approval cannot complete a domain action', () => {
    const current = {
      ...request(),
      state: 'WAITING_FOR_APPROVAL' as const,
      approverId: 'approver',
    };
    expect(() =>
      decideRequest(current, actor(), {
        action: 'approve',
        expectedVersion: 1,
      }),
    ).toThrow('FORBIDDEN');
    expect(
      decideRequest(current, actor('approver'), {
        action: 'approve',
        expectedVersion: 1,
      }),
    ).toMatchObject({
      state: 'IN_PROGRESS',
      domainActionId: null,
      approverId: null,
    });
  });
  it('rejects invalid UTC dates instead of normalizing them', () => {
    const current = {
      ...request(),
      assigneeId: 'agent',
      state: 'IN_PROGRESS' as const,
    };
    for (const dueAt of ['2026-02-30T00:00:00.000Z', 'tomorrow', '2026-09-11'])
      expect(() =>
        decideRequest(current, actor(), {
          action: 'change_due',
          expectedVersion: 1,
          reason: 'اصلاح',
          dueAt,
        }),
      ).toThrow();
  });
});

describe('versioned SLA with controlled working time', () => {
  const policy = {
    policyId: 'test-only',
    version: 1,
    calendarVersion: 'test-calendar-v1',
    firstResponseBudgetMs: 100,
    resolutionBudgetMs: 1000,
    atRiskFraction: 0.8,
    pauseForInformation: true,
  };
  it('pauses resolution only for permitted information waiting, not first response', () => {
    expect(evaluateSla(policy, 1000, 300, null)).toEqual({
      firstResponse: 'BREACHED',
      resolution: 'ON_TRACK',
      resolutionWorkingMs: 700,
    });
    expect(
      evaluateSla({ ...policy, pauseForInformation: false }, 1000, 300, 50)
        .resolution,
    ).toBe('BREACHED');
  });
  it('does not let automated notifications stop first-human-response timing', () => {
    expect(evaluateSla(policy, 90, 0, null).firstResponse).toBe('AT_RISK');
    expect(evaluateSla(policy, 900, 0, 50)).toMatchObject({
      firstResponse: 'ON_TRACK',
      resolution: 'AT_RISK',
    });
  });
  it('rejects invalid policy/time input', () => {
    expect(() => evaluateSla(policy, 100, 101, null)).toThrow();
    expect(() => evaluateSla(policy, 100, 0, 101)).toThrow();
    expect(() =>
      evaluateSla({ ...policy, atRiskFraction: NaN }, 100, 0, null),
    ).toThrow();
  });
});
