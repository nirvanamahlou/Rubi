import { describe, expect, it } from 'vitest';
import type { SalesBalance } from '@nora/contracts';
import { calculateContractPaymentShare } from './contract-payment-share';

const balance: SalesBalance = {
  amount: '192000000',
  currencyCode: 'IRR',
  confirmedPaid: '32000000',
  pendingFinance: '10000000',
  outstanding: '160000000',
};

describe('contract payment share', () => {
  it('shows the entered amount as an exact share of the contract total', () => {
    expect(calculateContractPaymentShare(balance, '48000000')).toEqual({
      entered: '48000000',
      percentOfTotal: '25',
      remainingAfterConfirmation: '112000000',
      overpayment: '0',
    });
  });

  it('keeps decimal calculations exact above the JavaScript safe integer limit', () => {
    expect(
      calculateContractPaymentShare(
        {
          ...balance,
          amount: '9007199254740993.12',
          outstanding: '9007199254740993.12',
        },
        '4503599627370496.56',
      ),
    ).toMatchObject({
      percentOfTotal: '50',
      remainingAfterConfirmation: '4503599627370496.56',
    });
  });

  it('separates an overpayment from the zero projected remainder', () => {
    expect(calculateContractPaymentShare(balance, '170000000')).toMatchObject({
      percentOfTotal: '88.5',
      remainingAfterConfirmation: '0',
      overpayment: '10000000',
    });
  });

  it('does not invent a percentage before a valid amount is entered', () => {
    expect(calculateContractPaymentShare(balance, '')).toMatchObject({
      entered: null,
      percentOfTotal: null,
      remainingAfterConfirmation: '160000000',
      overpayment: '0',
    });
  });
});
