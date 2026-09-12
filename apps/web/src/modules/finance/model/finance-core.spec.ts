import { describe, expect, it } from 'vitest';

import {
  validateFinanceActionDraft,
  validateFinanceDecision,
} from './finance-core';

const valid = {
  accountReference: 'financial-account:1',
  partyReference: 'supplier:1',
  actualAmount: '100.25',
  currencyCode: 'IRR',
  occurredAt: '2026-09-12T10:00:00.000Z',
  trackingReference: 'ref-1',
  feeAmount: '0',
  note: 'توضیح مالی معتبر برای بررسی',
  evidenceReviewed: true,
  idempotencyKey: 'finance:request:000001',
  expectedVersion: '1',
};

describe('finance inbox validation', () => {
  it('requires a destination account for receipt confirmation', () => {
    expect(
      validateFinanceActionDraft('RECEIPT_VERIFICATION', {
        ...valid,
        accountReference: '',
      }),
    ).toContain('انتخاب حساب مقصد الزامی است.');
  });

  it('requires a source account and party for payment', () => {
    const errors = validateFinanceActionDraft('PAYMENT_REQUEST', {
      ...valid,
      accountReference: '',
      partyReference: '',
    });
    expect(errors).toContain('انتخاب حساب مبدأ الزامی است.');
    expect(errors).toContain('طرف‌حساب معتبر برای پرداخت الزامی است.');
  });

  it('accepts only fully validated local drafts', () => {
    expect(validateFinanceActionDraft('PAYMENT_REQUEST', valid)).toEqual([]);
  });

  it('requires detailed rejection and correction reasons', () => {
    expect(validateFinanceDecision('کوتاه')).not.toBeNull();
    expect(validateFinanceDecision('دلیل کامل برای برگشت درخواست')).toBeNull();
  });
});
