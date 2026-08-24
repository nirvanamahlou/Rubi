import { describe, expect, it } from 'vitest';

import {
  evaluateSLAPolicy,
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

describe('customer affairs SLA and controlled reopen policies', () => {
  it('maps an approaching response deadline to at-risk and escalation', () => {
    expect(
      evaluateSLAPolicy({
        openedAt: '2026-08-24T08:00:00.000Z',
        now: '2026-08-24T08:50:00.000Z',
        firstRespondedAt: null,
        resolvedAt: null,
        paused: false,
        policy,
      }),
    ).toMatchObject({
      state: 'AT_RISK',
      escalationLevel: 2,
      firstResponseDueAt: '2026-08-24T09:00:00.000Z',
      resolutionDueAt: '2026-08-24T12:00:00.000Z',
    });
  });

  it('maps a breached deadline to level-three escalation', () => {
    expect(
      evaluateSLAPolicy({
        openedAt: '2026-08-24T08:00:00.000Z',
        now: '2026-08-24T09:01:00.000Z',
        firstRespondedAt: null,
        resolvedAt: null,
        paused: false,
        policy,
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
