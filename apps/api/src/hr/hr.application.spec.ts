import { describe, expect, it } from 'vitest';
import {
  prepareContractActivation,
  prepareLeaveDecision,
  prepareReviewFinalization,
} from './hr.application';
import { hrPermissions, type HrActor } from './hr.policy';
import type {
  EmploymentContract,
  LeaveRequest,
  PerformanceReview,
} from './hr.entities';
const now = '2026-09-05T00:00:00.000Z';
const base = {
  id: 'synthetic-record',
  version: 1,
  createdAt: now,
  updatedAt: now,
  startsAt: '2026-09-01T00:00:00.000Z',
  endsAt: '2026-10-01T00:00:00.000Z',
};
const target = {
  employeeId: 'synthetic-employee',
  branchId: 'synthetic-branch',
};
const actor: HrActor = {
  userId: 'synthetic-checker',
  employeeId: 'synthetic-manager',
  branchIds: [target.branchId],
  activeBranchId: target.branchId,
  permissions: hrPermissions,
  scope: 'HR',
  managedEmployeeIds: [target.employeeId],
};
const context = {
  expectedVersion: 1,
  idempotencyKey: 'synthetic-key-123456',
  reason: 'Synthetic review reason',
  traceId: 'synthetic-trace',
};
describe('HR command preparation (no persistence)', () => {
  it('rechecks permission, target and version before a leave decision', () => {
    const leave: LeaveRequest = {
      ...base,
      employeeId: target.employeeId,
      requesterUserId: 'synthetic-maker',
      kind: 'DAILY',
      status: 'PENDING',
    };
    expect(
      prepareLeaveDecision(actor, target, leave, 'APPROVED', context, now)
        .version,
    ).toBe(2);
    expect(() =>
      prepareLeaveDecision(
        { ...actor, permissions: [] },
        target,
        leave,
        'APPROVED',
        context,
        now,
      ),
    ).toThrow('FORBIDDEN');
    expect(() =>
      prepareLeaveDecision(
        actor,
        { ...target, employeeId: 'other' },
        leave,
        'APPROVED',
        context,
        now,
      ),
    ).toThrow('FORBIDDEN');
    expect(() =>
      prepareLeaveDecision(
        actor,
        target,
        leave,
        'APPROVED',
        { ...context, expectedVersion: 0 },
        now,
      ),
    ).toThrow('CONFLICT');
  });
  it('requires an active period, distinct checker and a matching specific issuer', () => {
    const contract: EmploymentContract = {
      ...base,
      employeeId: target.employeeId,
      number: 'SYNTHETIC',
      issuerLegalEntityId: 'synthetic-issuer',
      kind: 'FIXED',
      jobTitle: 'synthetic',
      workplace: 'synthetic',
      agreed: { amount: '100', currencyCode: 'IRR' },
      benefits: [],
      status: 'DRAFT',
      makerUserId: 'synthetic-maker',
    };
    const issuer = {
      selection: 'SPECIFIC' as const,
      issuerLegalEntityId: contract.issuerLegalEntityId,
    };
    expect(
      prepareContractActivation(actor, target, contract, issuer, context, now)
        .status,
    ).toBe('ACTIVE');
    expect(() =>
      prepareContractActivation(
        actor,
        target,
        contract,
        { selection: 'ALL' },
        context,
        now,
      ),
    ).toThrow('FORBIDDEN');
    expect(() =>
      prepareContractActivation(
        actor,
        target,
        contract,
        issuer,
        context,
        base.endsAt,
      ),
    ).toThrow('CONFLICT');
    expect(() =>
      prepareContractActivation(
        { ...actor, userId: contract.makerUserId },
        target,
        contract,
        issuer,
        context,
        now,
      ),
    ).toThrow('FORBIDDEN');
  });
  it('finalizes weighted review only once and refuses self review approval', () => {
    const review: PerformanceReview = {
      ...base,
      employeeId: target.employeeId,
      managerEmployeeId: 'synthetic-manager',
      makerUserId: 'synthetic-maker',
      criteria: [{ id: 'synthetic-criterion', weight: 100, score: 85 }],
      status: 'MANAGER_REVIEW',
    };
    expect(
      prepareReviewFinalization(actor, target, review, context, now).score,
    ).toBe(85);
    expect(() =>
      prepareReviewFinalization(
        { ...actor, employeeId: target.employeeId },
        target,
        review,
        context,
        now,
      ),
    ).toThrow('FORBIDDEN');
    expect(() =>
      prepareReviewFinalization(
        actor,
        target,
        { ...review, status: 'FINAL' },
        context,
        now,
      ),
    ).toThrow('CONFLICT');
  });
});
