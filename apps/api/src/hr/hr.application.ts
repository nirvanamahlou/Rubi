import type {
  EmploymentContract,
  LeaveRequest,
  PerformanceReview,
} from './hr.entities';
import {
  assertIssuer,
  assertMutation,
  makerChecker,
  performanceScore,
  requireInvariant,
  transitionLeave,
  utc,
  validateMoney,
  validatePeriod,
  validateReason,
} from './hr.domain';
import { authorize, type HrActor, type HrTarget } from './hr.policy';
import type { MutationContext } from './hr.ports';

/** Pure command preparation only. Phase B must recheck scope/version and write audit/history
 * atomically. Returning a proposed entity is not persistence or a successful API mutation.
 */
export function prepareLeaveDecision(
  actor: HrActor,
  target: HrTarget,
  request: LeaveRequest,
  next: 'APPROVED' | 'REJECTED',
  context: MutationContext,
  now: string,
): LeaveRequest {
  authorize(actor, 'hr.leave.approve', target);
  requireInvariant(request.employeeId === target.employeeId, 'FORBIDDEN');
  assertMutation(
    context.expectedVersion,
    request.version,
    context.idempotencyKey,
  );
  utc(now);
  return {
    ...transitionLeave(request, next, actor, context.reason),
    updatedAt: now,
  };
}
export function prepareContractActivation(
  actor: HrActor,
  target: HrTarget,
  contract: EmploymentContract,
  issuer: { selection: 'ALL' | 'SPECIFIC'; issuerLegalEntityId?: string },
  context: MutationContext,
  now: string,
): EmploymentContract {
  authorize(actor, 'hr.contract.manage', target);
  requireInvariant(target.employeeId === contract.employeeId, 'FORBIDDEN');
  assertMutation(
    context.expectedVersion,
    contract.version,
    context.idempotencyKey,
  );
  validateReason(context.reason);
  makerChecker(contract.makerUserId, actor.userId);
  assertIssuer(issuer);
  requireInvariant(
    issuer.issuerLegalEntityId === contract.issuerLegalEntityId,
    'FORBIDDEN',
  );
  validatePeriod(contract);
  validateMoney(contract.agreed);
  contract.benefits.forEach(validateMoney);
  requireInvariant(
    contract.status === 'DRAFT' &&
      utc(contract.startsAt) <= utc(now) &&
      utc(now) < utc(contract.endsAt),
    'CONFLICT',
  );
  if (contract.probationEndsAt)
    requireInvariant(
      utc(contract.probationEndsAt) >= utc(contract.startsAt) &&
        utc(contract.probationEndsAt) <= utc(contract.endsAt),
    );
  return {
    ...contract,
    status: 'ACTIVE',
    version: contract.version + 1,
    updatedAt: now,
  };
}
export function prepareReviewFinalization(
  actor: HrActor,
  target: HrTarget,
  review: PerformanceReview,
  context: MutationContext,
  now: string,
): { review: PerformanceReview; score: number } {
  authorize(actor, 'hr.performance.manage', target);
  requireInvariant(
    target.employeeId === review.employeeId &&
      actor.employeeId !== review.employeeId,
    'FORBIDDEN',
  );
  makerChecker(review.makerUserId, actor.userId);
  assertMutation(
    context.expectedVersion,
    review.version,
    context.idempotencyKey,
  );
  validateReason(context.reason);
  validatePeriod(review);
  utc(now);
  requireInvariant(review.status === 'MANAGER_REVIEW', 'CONFLICT');
  return {
    review: {
      ...review,
      status: 'FINAL',
      version: review.version + 1,
      updatedAt: now,
    },
    score: performanceScore(review.criteria),
  };
}
