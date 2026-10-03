import { describe, expect, it } from 'vitest';

import {
  accountTreePreview,
  financeInboxPreviewRequests,
  multiplyDecimalAmounts,
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
  exchangeRateToIrr: '1',
  occurredAt: '2026-09-12T10:00:00.000Z',
  trackingReference: 'ref-1',
  feeAmount: '0',
  note: 'توضیح مالی معتبر برای بررسی',
  evidenceReviewed: true,
  idempotencyKey: 'finance:request:000001',
  expectedVersion: '1',
  paymentParts: [
    {
      id: 'part-1',
      amount: '60.25',
      trackingReference: 'pay-1',
      method: 'BANK_TRANSFER' as const,
    },
    {
      id: 'part-2',
      amount: '40',
      trackingReference: 'pay-2',
      method: 'CASH' as const,
    },
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
    expect(multiplyDecimalAmounts('4200.50', '70000')).toBe('294035000');
  });

  it('requires a positive daily FX snapshot for foreign settlements', () => {
    expect(
      validateFinanceActionDraft('PAYMENT_REQUEST', {
        ...valid,
        currencyCode: 'EUR',
        exchangeRateToIrr: '',
      }),
    ).toContain('نرخ روز هر واحد ارز به ریال الزامی است.');
    expect(
      validateFinanceActionDraft('RECEIPT_VERIFICATION', {
        ...valid,
        currencyCode: 'USD',
        exchangeRateToIrr: '69900',
      }),
    ).toEqual([]);
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

  it('requires a method per payment part and a number for checks', () => {
    expect(
      validateFinanceActionDraft(
        'PAYMENT_REQUEST',
        {
          ...valid,
          paymentParts: [
            { id: 'part-1', amount: '50', trackingReference: '', method: '' },
          ],
        },
        '100',
      ),
    ).toContain('روش هر ردیف پرداخت باید مشخص شود.');
    expect(
      validateFinanceActionDraft(
        'PAYMENT_REQUEST',
        {
          ...valid,
          paymentParts: [
            {
              id: 'part-1',
              amount: '50',
              trackingReference: '',
              method: 'CHECK',
            },
          ],
        },
        '100',
      ),
    ).toContain('برای پرداخت با چک، شماره چک الزامی است.');
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

  it('keeps the historical FX rate and rial equivalent on foreign payments', () => {
    for (const request of financeInboxPreviewRequests) {
      for (const payment of request.previousPayments) {
        expect(payment.exchangeRateToIrr).toMatch(/^\d+(?:\.\d+)?$/);
        expect(payment.rialEquivalent).toBe(
          multiplyDecimalAmounts(payment.amount, payment.exchangeRateToIrr),
        );
      }
    }
  });

  it('requires detailed rejection and correction reasons', () => {
    expect(validateFinanceDecision('کوتاه')).not.toBeNull();
    expect(validateFinanceDecision('دلیل کامل برای برگشت درخواست')).toBeNull();
  });
});
