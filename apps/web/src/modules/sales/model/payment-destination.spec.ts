import { expect, it } from 'vitest';
import type { SalesPaymentInput, SalesPaymentAccountV1 } from '@nora/contracts';
import { paymentDestinationIsValid } from './payment-destination';

const payment: SalesPaymentInput = {
  method: 'CASH',
  amount: '1',
  currencyCode: 'EUR',
  dueAt: '2026-11-04',
};
const account: SalesPaymentAccountV1 = {
  id: 'bank',
  title: 'Bank',
  currencyCode: 'EUR',
  kind: 'BANK',
  maskedIdentifier: null,
};
it('allows cash with no accounts even while account lookup loads or fails', () => {
  for (const [loading, error] of [
    [true, ''],
    [false, ''],
    [false, 'Failed'],
  ] as const)
    expect(paymentDestinationIsValid(payment, [], loading, error)).toBe(true);
});
it.each(['BANK_TRANSFER', 'POS', 'ONLINE_GATEWAY', 'CHECK'] as const)(
  'keeps account and currency validation for %s including a switch from cash',
  (method) => {
    const bankPayment = { ...payment, method };
    expect(paymentDestinationIsValid(bankPayment, [], false, '')).toBe(false);
    const selected = { ...bankPayment, destinationAccountId: 'bank' };
    expect(paymentDestinationIsValid(selected, [account], false, '')).toBe(
      true,
    );
    expect(paymentDestinationIsValid(selected, [account], true, '')).toBe(
      false,
    );
    expect(
      paymentDestinationIsValid(selected, [account], false, 'Failed'),
    ).toBe(false);
    expect(
      paymentDestinationIsValid(
        { ...selected, currencyCode: 'USD' },
        [account],
        false,
        '',
      ),
    ).toBe(false);
  },
);
