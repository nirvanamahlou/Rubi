import { expect, it } from 'vitest';
import type {
  FinanceInboxItemV1,
  FinanceSettlementAccountV1,
} from '@nora/contracts';
import { initialReceiptAccount } from './receipt-account';
const item = {
  branchReference: 'branch',
  amount: { currencyCode: 'IRR' },
  destinationAccountId: 'selected',
} as FinanceInboxItemV1;
const accounts = [
  { id: 'first', branchId: 'branch', currencyCode: 'IRR', isActive: true },
  { id: 'selected', branchId: 'branch', currencyCode: 'IRR', isActive: true },
] as FinanceSettlementAccountV1[];
it('prefers the declared account over the first account', () => {
  expect(initialReceiptAccount(item, accounts)).toBe('selected');
});
it('never silently substitutes another account if the declared account is inactive or incompatible', () => {
  for (const changed of [
    { isActive: false },
    { branchId: 'other' },
    { currencyCode: 'USD' },
  ])
    expect(
      initialReceiptAccount(item, [
        accounts[0]!,
        { ...accounts[1]!, ...changed },
      ]),
    ).toBe('');
  expect(initialReceiptAccount(item, [accounts[0]!])).toBe('');
});
it('preserves the previous default for old payments with no declared destination', () => {
  expect(
    initialReceiptAccount({ ...item, destinationAccountId: null }, accounts),
  ).toBe('first');
});
