import { describe, expect, it } from 'vitest';

import {
  accountTreePreview,
  financeInboxPreviewRequests,
  remainingAfterAmount,
  sumDecimalAmounts,
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
  paymentParts: [
    { id: 'part-1', amount: '60.25', trackingReference: 'pay-1' },
    { id: 'part-2', amount: '40', trackingReference: 'pay-2' },
  ],
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
    expect(validateFinanceActionDraft('PAYMENT_REQUEST', valid, '150')).toEqual(
      [],
    );
  });

  it('keeps the finance note optional', () => {
    expect(
      validateFinanceActionDraft(
        'PAYMENT_REQUEST',
        { ...valid, note: '' },
        '150',
      ),
    ).toEqual([]);
  });

  it('sums partial payments without converting money to Number', () => {
    expect(sumDecimalAmounts(['4200.50', '799.50'])).toBe('5000');
    expect(remainingAfterAmount('5000', '4200.50')).toBe('799.5');
  });

  it('rejects missing partial rows and overpayment against contract balance', () => {
    expect(
      validateFinanceActionDraft(
        'PAYMENT_REQUEST',
        { ...valid, paymentParts: [] },
        '100',
      ),
    ).toContain('حداقل یک ردیف پرداخت با مبلغ Decimal مثبت لازم است.');
    expect(
      validateFinanceActionDraft('PAYMENT_REQUEST', valid, '100'),
    ).toContain('جمع مبلغ از مانده قرارداد بیشتر است.');
  });

  it('offers a posting account in every preview request currency', () => {
    for (const request of financeInboxPreviewRequests) {
      expect(
        accountTreePreview.some(
          (account) =>
            account.active &&
            account.postingAllowed &&
            account.currencyCode === request.currencyCode,
        ),
      ).toBe(true);
    }
  });

  it('requires detailed rejection and correction reasons', () => {
    expect(validateFinanceDecision('کوتاه')).not.toBeNull();
    expect(validateFinanceDecision('دلیل کامل برای برگشت درخواست')).toBeNull();
  });
});
