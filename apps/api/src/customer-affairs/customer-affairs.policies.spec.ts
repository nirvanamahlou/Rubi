import { describe, expect, it } from 'vitest';

import {
  evaluateSLAPolicy,
  SLAPolicyValidationError,
  validateTicketClosure,
  validateTicketReopen,
  type SLAPolicyProposal,
} from './customer-affairs.policies';

const policy: SLAPolicyProposal = {
  version: 'customer-affairs.sla-policy.v1-proposal',
  priority: 'HIGH',
  firstResponseMinutes: 60,
  resolutionMinutes: 240,
  atRiskPercent: 20,
  escalationLevels: [
    { level: 1, remainingPercent: 50, targetReference: 'support-lead' },
    { level: 2, remainingPercent: 20, targetReference: 'branch-manager' },
    { level: 3, remainingPercent: 0, targetReference: 'operations-manager' },
  ],
};

const baseEvaluation = {
  openedAt: '2026-08-24T08:00:00.000Z',
  now: '2026-08-24T08:30:00.000Z',
  firstRespondedAt: null,
  resolvedAt: null,
  paused: false,
  policy,
} as const;

describe('customer affairs SLA and controlled reopen policies', () => {
  it('changes the SLA state when policy.atRiskPercent changes', () => {
    const input = { ...baseEvaluation, now: '2026-08-24T08:48:00.000Z' };
    expect(
      evaluateSLAPolicy({
        ...input,
        policy: { ...policy, atRiskPercent: 25 },
      }).state,
    ).toBe('AT_RISK');
    expect(
      evaluateSLAPolicy({
        ...input,
        policy: { ...policy, atRiskPercent: 15 },
      }).state,
    ).toBe('ON_TRACK');
  });

  it('uses firstResponseMinutes as the first-response risk window', () => {
    expect(
      evaluateSLAPolicy({
        ...baseEvaluation,
        now: '2026-08-24T08:50:00.000Z',
        policy: { ...policy, atRiskPercent: 10 },
      }),
    ).toMatchObject({
      state: 'ON_TRACK',
      firstResponseDueAt: '2026-08-24T09:00:00.000Z',
      resolutionDueAt: '2026-08-24T12:00:00.000Z',
    });
  });

  it('uses resolutionMinutes and the resolution deadline after first response', () => {
    expect(
      evaluateSLAPolicy({
        ...baseEvaluation,
        now: '2026-08-24T11:20:00.000Z',
        firstRespondedAt: '2026-08-24T08:30:00.000Z',
      }),
    ).toMatchObject({
      state: 'AT_RISK',
      escalationLevel: 2,
      resolutionDueAt: '2026-08-24T12:00:00.000Z',
    });
  });

  it('rejects invalid policy percentages, windows and escalation ordering', () => {
    for (const invalidPolicy of [
      { ...policy, atRiskPercent: 0 },
      { ...policy, atRiskPercent: 100 },
      { ...policy, firstResponseMinutes: 0 },
      { ...policy, resolutionMinutes: 60 },
      {
        ...policy,
        escalationLevels: [
          { level: 1 as const, remainingPercent: 20, targetReference: 'one' },
          { level: 2 as const, remainingPercent: 20, targetReference: 'two' },
          { level: 3 as const, remainingPercent: 0, targetReference: 'three' },
        ],
      },
    ]) {
      expect(() =>
        evaluateSLAPolicy({ ...baseEvaluation, policy: invalidPolicy }),
      ).toThrowError(SLAPolicyValidationError);
    }
  });

  it('rejects invalid or chronologically impossible timestamps', () => {
    expect(() =>
      evaluateSLAPolicy({ ...baseEvaluation, openedAt: 'not-a-timestamp' }),
    ).toThrowError(/valid UTC ISO-8601/);
    expect(() =>
      evaluateSLAPolicy({
        ...baseEvaluation,
        now: '2026-08-24T07:59:00.000Z',
      }),
    ).toThrowError(/chronological timeline/);
    expect(() =>
      evaluateSLAPolicy({
        ...baseEvaluation,
        firstRespondedAt: '2026-02-30T08:30:00.000Z',
      }),
    ).toThrowError(/valid UTC ISO-8601/);
  });

  it('keeps breached SLA at escalation level three', () => {
    expect(
      evaluateSLAPolicy({
        ...baseEvaluation,
        now: '2026-08-24T09:01:00.000Z',
      }),
    ).toMatchObject({ state: 'BREACHED', escalationLevel: 3 });
  });

  it('requires permission, a terminal status, version and audit note to reopen', () => {
    expect(
      validateTicketReopen(
        {
          currentStatus: 'CLOSED',
          reopenCount: 0,
          maxReopenCount: 2,
          hasPermission: true,
          currentVersion: 4,
        },
        {
          reason: 'CUSTOMER_REPORTED_UNRESOLVED',
          note: 'Synthetic customer reports the issue is unresolved.',
          expectedVersion: 4,
        },
      ),
    ).toEqual({ allowed: true, reason: null });
    expect(
      validateTicketReopen(
        {
          currentStatus: 'CLOSED',
          reopenCount: 0,
          maxReopenCount: 2,
          hasPermission: false,
          currentVersion: 4,
        },
        {
          reason: 'NEW_RELATED_EVIDENCE',
          note: 'Synthetic new evidence.',
          expectedVersion: 4,
        },
      ).reason,
    ).toBe('TICKET_REOPEN_PERMISSION_REQUIRED');
  });

  it('requires a resolved ticket, outcome and close reason', () => {
    expect(
      validateTicketClosure({
        status: 'RESOLVED',
        resolutionOutcome: 'Synthetic issue resolved.',
        closeReason: 'Synthetic completion.',
      }),
    ).toBe(true);
  });
});
