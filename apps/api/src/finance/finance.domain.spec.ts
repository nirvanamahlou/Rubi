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

function fxLine(
  direction: 'DEBIT' | 'CREDIT',
  approvalStatus: 'DRAFT' | 'APPROVED' | 'REJECTED',
  overrides: Partial<NonNullable<JournalLineInput['exchangeRate']>> = {},
): JournalLineInput {
  return {
    accountReference: `preview-fx-account-${direction.toLowerCase()}`,
    direction,
    transactionAmount: Money.from({ amount: '10', currencyCode: 'USD' }),
    baseAmount: Money.from({ amount: '5000000', currencyCode: 'IRR' }),
    dimension,
    exchangeRate: {
      baseCurrencyCode: 'USD',
      quoteCurrencyCode: 'IRR',
      rate: '500000',
      sourceReference: 'preview-approved-rate-001',
      validAt: '2026-08-24T10:00:00.000Z',
      expiresAt: '2026-08-24T14:00:00.000Z',
      approvalStatus,
      approvedByReference:
        approvalStatus === 'APPROVED' ? 'actor-preview-approver-001' : null,
      ...overrides,
    },
  };
}

function expectFinanceErrorCode(action: () => void, code: string): void {
  try {
    action();
    throw new Error('Expected FinanceDomainError.');
  } catch (error) {
    expect(error).toBeInstanceOf(FinanceDomainError);
    expect((error as FinanceDomainError).code).toBe(code);
  }
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
        makerPermissions: [],
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
          makerPermissions: [],
        },
      ),
    ).toMatchObject({ status: 'BLOCKED', allowed: false });
  });

  it('maps valid checks and manager exceptions only to CONDITIONAL release', () => {
    const validCheckFacts = {
      fullySettled: false,
      approvedCreditAvailable: false,
      approvedPaymentPlanActive: false,
      validCheckAvailable: true,
    };
    const validCheck = {
      basis: 'VALID_CHECK' as const,
      reason: 'چک معتبر و کنترل‌شده نمایشی',
      makerReference: 'actor-preview-001',
      secondApproverReference: null,
      exceptionExpiresAt: null,
      now: '2026-08-24T12:00:00.000Z',
      makerPermissions: [] as readonly string[],
    };
    expect(
      evaluateFinancialRelease(validCheckFacts, {
        ...validCheck,
        requestedStatus: 'CONDITIONAL',
      }),
    ).toMatchObject({ status: 'CONDITIONAL', allowed: true });
    expect(
      evaluateFinancialRelease(validCheckFacts, {
        ...validCheck,
        requestedStatus: 'APPROVED',
      }),
    ).toMatchObject({ status: 'BLOCKED', allowed: false });

    const managerException = {
      basis: 'MANAGER_EXCEPTION' as const,
      reason: 'استثنای مدیر با دلیل تفصیلی کاملاً نمایشی',
      makerReference: 'actor-preview-001',
      secondApproverReference: 'actor-preview-002',
      exceptionExpiresAt: '2026-08-24T13:00:00.000Z',
      now: '2026-08-24T12:00:00.000Z',
      makerPermissions: ['finance.financial_release.override'],
    };
    expect(
      evaluateFinancialRelease(validCheckFacts, {
        ...managerException,
        requestedStatus: 'CONDITIONAL',
      }),
    ).toMatchObject({ status: 'CONDITIONAL', allowed: true });
    expect(
      evaluateFinancialRelease(validCheckFacts, {
        ...managerException,
        requestedStatus: 'APPROVED',
      }),
    ).toMatchObject({ status: 'BLOCKED', allowed: false });
  });

  it('allows APPROVED release only for full settlement or sufficient approved credit', () => {
    const request = {
      requestedStatus: 'APPROVED' as const,
      reason: 'مبنای مالی تاییدشده و کاملاً نمایشی',
      makerReference: 'actor-preview-001',
      secondApproverReference: null,
      exceptionExpiresAt: null,
      now: '2026-08-24T12:00:00.000Z',
      makerPermissions: [] as readonly string[],
    };
    expect(
      evaluateFinancialRelease(
        {
          fullySettled: true,
          approvedCreditAvailable: false,
          approvedPaymentPlanActive: false,
          validCheckAvailable: false,
        },
        { ...request, basis: 'FULL_SETTLEMENT' },
      ),
    ).toMatchObject({ status: 'APPROVED', allowed: true });
    expect(
      evaluateFinancialRelease(
        {
          fullySettled: false,
          approvedCreditAvailable: true,
          approvedPaymentPlanActive: false,
          validCheckAvailable: false,
        },
        { ...request, basis: 'APPROVED_CREDIT' },
      ),
    ).toMatchObject({ status: 'APPROVED', allowed: true });
  });

  it('rejects invalid and expired manager exception timestamps', () => {
    const facts = {
      fullySettled: false,
      approvedCreditAvailable: false,
      approvedPaymentPlanActive: false,
      validCheckAvailable: false,
    };
    const request = {
      requestedStatus: 'CONDITIONAL' as const,
      basis: 'MANAGER_EXCEPTION' as const,
      reason: 'استثنای مدیر با دلیل تفصیلی کاملاً نمایشی',
      makerReference: 'actor-preview-001',
      secondApproverReference: 'actor-preview-002',
      now: '2026-08-24T12:00:00.000Z',
      makerPermissions: ['finance.financial_release.override'],
    };
    expect(
      evaluateFinancialRelease(facts, {
        ...request,
        exceptionExpiresAt: 'not-a-date',
      }),
    ).toMatchObject({ status: 'BLOCKED', allowed: false });
    expect(
      evaluateFinancialRelease(facts, {
        ...request,
        exceptionExpiresAt: '2026-08-24T11:59:59.999Z',
      }),
    ).toMatchObject({ status: 'BLOCKED', allowed: false });
  });

  it('rejects non-approved, expired and invalid FX snapshots for posting', () => {
    const journal = (
      debit: JournalLineInput,
      credit: JournalLineInput,
    ): JournalEntry =>
      new JournalEntry(
        'journal-preview-fx',
        'legal-entity-preview-001',
        'period-preview-001',
        '2026-08-24T12:00:00.000Z',
        'سند ارزی کاملاً نمایشی',
        [debit, credit],
        null,
        'APPROVED',
        1,
      );

    expectFinanceErrorCode(
      () =>
        journal(
          fxLine('DEBIT', 'DRAFT'),
          fxLine('CREDIT', 'DRAFT'),
        ).validateForPosting(),
      'FX_SNAPSHOT_NOT_APPROVED',
    );
    expectFinanceErrorCode(
      () =>
        journal(
          fxLine('DEBIT', 'REJECTED'),
          fxLine('CREDIT', 'REJECTED'),
        ).validateForPosting(),
      'FX_SNAPSHOT_NOT_APPROVED',
    );
    expectFinanceErrorCode(
      () =>
        journal(
          fxLine('DEBIT', 'APPROVED', {
            expiresAt: '2026-08-24T11:59:59.999Z',
          }),
          fxLine('CREDIT', 'APPROVED', {
            expiresAt: '2026-08-24T11:59:59.999Z',
          }),
        ).validateForPosting(),
      'FX_SNAPSHOT_EXPIRED',
    );
    expectFinanceErrorCode(
      () =>
        journal(
          fxLine('DEBIT', 'APPROVED', { validAt: 'not-a-date' }),
          fxLine('CREDIT', 'APPROVED', { validAt: 'not-a-date' }),
        ).validateForPosting(),
      'FX_SNAPSHOT_INVALID',
    );
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
        makerPermissions: [],
      },
    );
    expect(result.allowed).toBe(false);
    expect(result.status).toBe('BLOCKED');
    expect(result.reasons).toHaveLength(4);
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
