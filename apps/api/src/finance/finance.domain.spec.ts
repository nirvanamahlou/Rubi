import { describe, expect, it } from 'vitest';

import {
  assertExpectedVersion,
  assertFinancePermission,
  canTransitionCheck,
  evaluateFinancialRelease,
  JournalEntry,
  validateIdempotencyContract,
  validateMakerChecker,
  type JournalLineInput,
} from './finance.domain';
import { FinanceDomainError, Money } from './finance.money';

const dimension = {
  partyReference: null,
  costCenterReference: null,
  projectReference: null,
  contractReference: null,
  tourReference: null,
  routeReference: null,
  serviceReference: null,
  sellerReference: null,
};

function line(direction: 'DEBIT' | 'CREDIT', amount: string): JournalLineInput {
  return {
    accountReference: `preview-account-${direction.toLowerCase()}`,
    direction,
    transactionAmount: Money.from({ amount, currencyCode: 'IRR' }),
    baseAmount: Money.from({ amount, currencyCode: 'IRR' }),
    dimension,
    exchangeRate: null,
  };
}

describe('finance domain foundation', () => {
  it('accepts only balanced approved journal proposals', () => {
    const journal = new JournalEntry(
      'journal-preview-001',
      'legal-entity-preview-001',
      'period-preview-001',
      '2026-08-24T12:00:00.000Z',
      'سند متوازن کاملاً نمایشی',
      [line('DEBIT', '1250000'), line('CREDIT', '1250000')],
      null,
      'APPROVED',
      1,
    );
    expect(journal.balance().balanced).toBe(true);
    expect(() => journal.validateForPosting()).not.toThrow();
  });

  it('blocks unbalanced, unapproved and malformed journals', () => {
    const unbalanced = new JournalEntry(
      'journal-preview-002',
      'legal-entity-preview-001',
      'period-preview-001',
      '2026-08-24T12:00:00.000Z',
      'سند نامتوازن کاملاً نمایشی',
      [line('DEBIT', '10'), line('CREDIT', '9')],
      null,
      'APPROVED',
      1,
    );
    expect(() => unbalanced.validateForPosting()).toThrowError(
      /Debit and credit/,
    );
    expect(() =>
      new JournalEntry(
        'journal-preview-003',
        'legal-entity-preview-001',
        'period-preview-001',
        '2026-08-24T12:00:00.000Z',
        'سند تاییدنشده نمایشی',
        [line('DEBIT', '10'), line('CREDIT', '10')],
        null,
        'DRAFT',
        1,
      ).validateForPosting(),
    ).toThrowError(/approved journal/);
  });

  it('enforces direction-specific check lifecycles', () => {
    expect(canTransitionCheck('RECEIVABLE', 'RECEIVED', 'DEPOSITED')).toBe(
      true,
    );
    expect(canTransitionCheck('RECEIVABLE', 'RECEIVED', 'PAID')).toBe(false);
    expect(canTransitionCheck('PAYABLE', 'ISSUED', 'DELIVERED')).toBe(true);
    expect(canTransitionCheck('PAYABLE', 'ISSUED', 'CLEARED')).toBe(false);
    expect(canTransitionCheck('PAYABLE', 'PAID', 'DELIVERED')).toBe(false);
  });

  it('enforces deny-by-default permission and maker/checker separation', () => {
    expect(() => assertFinancePermission([], 'payment.create')).toThrowError(
      /deny-by-default/,
    );
    expect(() =>
      assertFinancePermission(['finance.payment.create'], 'payment.create'),
    ).not.toThrow();
    expect(() =>
      validateMakerChecker({
        makerReference: 'actor-preview-001',
        checkerReference: 'actor-preview-001',
        checkerPermissions: ['finance.payment.approve'],
        requiredCheckerPermission: 'finance.payment.approve',
      }),
    ).toThrowError(/Maker cannot approve/);
    expect(() =>
      validateMakerChecker({
        makerReference: 'actor-preview-001',
        checkerReference: 'actor-preview-002',
        checkerPermissions: ['finance.payment.approve'],
        requiredCheckerPermission: 'finance.payment.approve',
      }),
    ).not.toThrow();
  });

  it('evaluates settlement, credit, payment-plan and valid-check release bases', () => {
    const facts = {
      fullySettled: true,
      approvedCreditAvailable: false,
      approvedPaymentPlanActive: false,
      validCheckAvailable: false,
    };
    expect(
      evaluateFinancialRelease(facts, {
        requestedStatus: 'APPROVED',
        basis: 'FULL_SETTLEMENT',
        reason: 'تسویه کامل نمایشی',
        makerReference: 'actor-preview-001',
        secondApproverReference: null,
        exceptionExpiresAt: null,
        now: '2026-08-24T12:00:00.000Z',
      }),
    ).toMatchObject({ status: 'APPROVED', allowed: true });
    expect(
      evaluateFinancialRelease(
        { ...facts, fullySettled: false, approvedPaymentPlanActive: true },
        {
          requestedStatus: 'APPROVED',
          basis: 'APPROVED_PAYMENT_PLAN',
          reason: 'برنامه پرداخت نمایشی',
          makerReference: 'actor-preview-001',
          secondApproverReference: null,
          exceptionExpiresAt: null,
          now: '2026-08-24T12:00:00.000Z',
        },
      ),
    ).toMatchObject({ status: 'BLOCKED', allowed: false });
  });

  it('requires reason, future expiry and a distinct second approver for exceptions', () => {
    const result = evaluateFinancialRelease(
      {
        fullySettled: false,
        approvedCreditAvailable: false,
        approvedPaymentPlanActive: false,
        validCheckAvailable: false,
      },
      {
        requestedStatus: 'CONDITIONAL',
        basis: 'MANAGER_EXCEPTION',
        reason: 'کوتاه',
        makerReference: 'actor-preview-001',
        secondApproverReference: 'actor-preview-001',
        exceptionExpiresAt: '2026-08-24T11:00:00.000Z',
        now: '2026-08-24T12:00:00.000Z',
      },
    );
    expect(result.allowed).toBe(false);
    expect(result.status).toBe('BLOCKED');
    expect(result.reasons).toHaveLength(3);
    expect(result.requiresAudit).toBe(true);
  });

  it('enforces optimistic concurrency and idempotency contracts', () => {
    expect(() => assertExpectedVersion(3, 2)).toThrowError(/expectedVersion/);
    expect(() => assertExpectedVersion(3, 3)).not.toThrow();
    expect(() =>
      validateIdempotencyContract({
        key: 'finance:payment:preview-001',
        requestFingerprint: 'a'.repeat(64),
      }),
    ).not.toThrow();
    expect(() =>
      validateIdempotencyContract({
        key: 'short',
        requestFingerprint: 'not-a-digest',
      }),
    ).toThrowError(FinanceDomainError);
  });
});
