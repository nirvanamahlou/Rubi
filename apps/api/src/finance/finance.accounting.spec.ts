import { describe, expect, it } from 'vitest';

import {
  assertAccountCanBeDeactivatedOrDeleted,
  assertAllocationsWithinAmount,
  authorizeJournalPosting,
  validateChartAccount,
  validatePaymentCompletion,
  validateReceiptConfirmation,
  validateRequestDecision,
  type ChartAccountDefinition,
} from './finance.accounting';

const group: ChartAccountDefinition = {
  id: 'g1',
  code: '1',
  title: 'دارایی‌ها',
  level: 'GROUP',
  parentReference: null,
  nature: 'DEBIT',
  permanent: true,
  control: false,
  postingAllowed: false,
  active: true,
  transactionCount: 0,
  version: 1,
};

describe('finance accounting invariants', () => {
  it('enforces the account hierarchy and posting leaf', () => {
    expect(() => validateChartAccount(group, null)).not.toThrow();
    expect(() =>
      validateChartAccount(
        {
          ...group,
          id: 'g2',
          code: '11',
          level: 'GENERAL',
          parentReference: group.id,
        },
        group,
      ),
    ).not.toThrow();
    expect(() =>
      validateChartAccount(
        {
          ...group,
          code: '2',
          level: 'DETAIL',
          parentReference: group.id,
          postingAllowed: true,
        },
        group,
      ),
    ).toThrowError(/immediately higher/);
  });

  it('prevents deleting an account with turnover', () => {
    expect(() =>
      assertAccountCanBeDeactivatedOrDeleted(
        { ...group, transactionCount: 1 },
        'DELETE',
      ),
    ).toThrowError(/turnover/);
    expect(() =>
      assertAccountCanBeDeactivatedOrDeleted(
        { ...group, transactionCount: 1 },
        'DEACTIVATE',
      ),
    ).not.toThrow();
  });

  it('blocks posting in a closed period and self approval', () => {
    const base = {
      makerReference: 'maker',
      checkerReference: 'checker',
      checkerPermissions: ['finance.journal.post'],
      expectedVersion: 2,
      actualVersion: 2,
      fiscalPeriodStatus: 'OPEN' as const,
    };
    expect(() => authorizeJournalPosting(base)).not.toThrow();
    expect(() =>
      authorizeJournalPosting({ ...base, fiscalPeriodStatus: 'CLOSED' }),
    ).toThrowError(/open fiscal period/);
    expect(() =>
      authorizeJournalPosting({ ...base, checkerReference: 'maker' }),
    ).toThrowError(/Maker/);
  });

  it('requires destination/source accounts and maker-checker', () => {
    const common = {
      actualAmount: '100.50',
      currencyCode: 'IRR',
      makerReference: 'maker',
      checkerReference: 'checker',
      expectedVersion: 1,
      actualVersion: 1,
    };
    expect(() =>
      validateReceiptConfirmation({
        ...common,
        destinationAccountReference: '',
        actuallyReceivedAt: '2026-09-12T10:00:00.000Z',
        receiptReviewed: true,
        checkerPermissions: ['finance.receipt.approve'],
      }),
    ).toThrowError(/destination account/);
    expect(() =>
      validatePaymentCompletion({
        ...common,
        sourceAccountReference: '',
        partyReference: 'supplier:1',
        paidAt: '2026-09-12T10:00:00.000Z',
        checkerPermissions: ['finance.payment.approve'],
      }),
    ).toThrowError(/source account/);
  });

  it('rejects over-allocation and reasonless decisions', () => {
    expect(() =>
      assertAllocationsWithinAmount({
        availableAmount: '100',
        allocationAmounts: ['60', '40'],
      }),
    ).not.toThrow();
    expect(() =>
      assertAllocationsWithinAmount({
        availableAmount: '100',
        allocationAmounts: ['60', '40.01'],
      }),
    ).toThrowError(/exceed/);
    expect(() =>
      validateRequestDecision({ status: 'REJECTED', reason: 'کوتاه' }),
    ).toThrowError(/reason/);
  });
});
