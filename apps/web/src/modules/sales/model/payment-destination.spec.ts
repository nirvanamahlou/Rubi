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
    const bankPayment = {
      ...payment,
      method,
      currencyCode: method === 'BANK_TRANSFER' ? 'IRR' : payment.currencyCode,
    };
    const selectedAccount = {
      ...account,
      currencyCode: bankPayment.currencyCode,
    };
    expect(paymentDestinationIsValid(bankPayment, [], false, '')).toBe(false);
    const selected = { ...bankPayment, destinationAccountId: 'bank' };
    expect(
      paymentDestinationIsValid(selected, [selectedAccount], false, ''),
    ).toBe(true);
    expect(
      paymentDestinationIsValid(selected, [selectedAccount], true, ''),
    ).toBe(false);
    expect(
      paymentDestinationIsValid(selected, [selectedAccount], false, 'Failed'),
    ).toBe(false);
    expect(
      paymentDestinationIsValid(
        { ...selected, currencyCode: 'USD' },
        [selectedAccount],
        false,
        '',
      ),
    ).toBe(false);
  },
);

it.each(['EUR', 'USD', 'AED'])(
  'allows a %s bank transfer without an account even if account lookup fails',
  (currencyCode) => {
    const transfer = {
      ...payment,
      method: 'BANK_TRANSFER' as const,
      currencyCode,
    };
    for (const destinationAccountId of [undefined, null, '']) {
      expect(
        paymentDestinationIsValid(
          destinationAccountId === undefined
            ? transfer
            : { ...transfer, destinationAccountId },
          [],
          true,
          'Failed',
        ),
      ).toBe(true);
    }
    expect(
      paymentDestinationIsValid(
        { ...transfer, destinationAccountId: 'unknown' },
        [],
        false,
        '',
      ),
    ).toBe(false);
  },
);
