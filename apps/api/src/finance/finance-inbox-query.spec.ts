import { describe, expect, it } from 'vitest';
import type { AuthenticatedActor, FinanceInboxItemV1 } from '@nora/contracts';
import { decimalUnits, filterFinanceInbox, validateInboxQuery } from './finance-inbox-query';
const actor = { branchIds: ['branch-a'] } as AuthenticatedActor;
const item = { id: 'case', source: 'HR', kind: 'PAYROLL_REQUEST', status: 'APPROVED', branchReference: 'branch-a', title: 'حقوق کارکنان', partyDisplaySnapshot: 'علی كريمی', amount: { amount: '9007199254740993.125', currencyCode: 'IRR' }, createdAt: '2026-10-03T20:30:00.000Z', dueAt: '2026-10-05T20:29:59.999Z' } as FinanceInboxItemV1;
describe('Exact Finance inbox filters', () => {
  it('keeps approved payroll open for payment but closes completed HR referrals', () => {
    expect(filterFinanceInbox([item], { status: 'OPEN' })).toHaveLength(1);
    expect(filterFinanceInbox([{ ...item, kind: 'HR_REFERRAL' }], { status: 'CLOSED' })).toHaveLength(1);
  });
  it('filters exact large decimal money, person normalization, branch, currency and Tehran day boundaries', () => {
    expect(filterFinanceInbox([item], { person: 'کریم', branchId: 'branch-a', currencyCode: 'IRR', minAmount: '9007199254740993.125', maxAmount: '9007199254740993.125', fromDate: '2026-10-04', toDate: '2026-10-04', dueFrom: '2026-10-05', dueTo: '2026-10-05' })).toHaveLength(1);
    expect(filterFinanceInbox([item], { maxAmount: '9007199254740993.1249' })).toHaveLength(0);
    expect(decimalUnits('9007199254740993.125')).toBe(900719925474099312500000n);
  });
  it.each([{ minAmount: '-1' }, { minAmount: '1e5' }, { minAmount: '20', maxAmount: '10' }, { fromDate: '2026-02-30' }, { pageSize: 101 }, { page: 0 }, { status: 'UNKNOWN' }, { currencyCode: 'irr' }])('rejects invalid filter %s', query => { expect(() => validateInboxQuery(query as never, actor)).toThrow(); });
  it('rejects unauthorized branch filters', () => { expect(() => validateInboxQuery({ branchId: 'branch-b' }, actor)).toThrow(); });
});
