import { describe, expect, it } from 'vitest';
import type { FinanceInboxItemV1 } from '@nora/contracts';
import { inTehranDateRange, isActionablePayment } from './inbox-filters';

describe('Finance inbox filters', () => {
  it('includes the whole Tehran end day and excludes the next midnight', () => {
    expect(
      inTehranDateRange('2026-10-04T20:29:59.999Z', '2026-10-04', '2026-10-04'),
    ).toBe(true);
    expect(
      inTehranDateRange('2026-10-04T20:30:00.000Z', '2026-10-04', '2026-10-04'),
    ).toBe(false);
    expect(
      inTehranDateRange('2026-10-03T20:30:00.000Z', '2026-10-04', '2026-10-04'),
    ).toBe(true);
    expect(
      inTehranDateRange('2026-10-03T20:29:59.999Z', '2026-10-04', '2026-10-04'),
    ).toBe(false);
  });
  it('handles unbounded, reversed and invalid ranges safely', () => {
    expect(inTehranDateRange('2026-10-04T10:00:00Z', '', '')).toBe(true);
    expect(
      inTehranDateRange('2026-10-04T10:00:00Z', '2026-10-05', '2026-10-04'),
    ).toBe(false);
    expect(inTehranDateRange('invalid', '', '')).toBe(false);
  });
  it('never counts referrals, returns or unapproved invoices as actionable payments', () => {
    const item = {
      kind: 'PAYMENT_REQUEST',
      amount: { amount: '10', currencyCode: 'IRR' },
      status: 'READY_FOR_PAYMENT',
    } as FinanceInboxItemV1;
    expect(isActionablePayment(item)).toBe(true);
    expect(isActionablePayment({ ...item, status: 'PAYING' })).toBe(true);
    expect(isActionablePayment({ ...item, status: 'UNDER_REVIEW' })).toBe(
      false,
    );
    expect(isActionablePayment({ ...item, kind: 'HR_REFERRAL' })).toBe(false);
    expect(isActionablePayment({ ...item, kind: 'RETURN_CORRECTION' })).toBe(
      false,
    );
    expect(isActionablePayment({ ...item, amount: null })).toBe(false);
  });
});
