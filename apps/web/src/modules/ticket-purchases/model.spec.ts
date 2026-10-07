import { it, expect } from 'vitest';
import type { TicketPurchaseInboxItemV1 } from '@nora/contracts';
import { purchaseSummary } from './model';
it('summarizes stages and exact separate-currency actual purchase/payment totals', () => {
  const row = (
    stage: string,
    code: string,
    invoice: string,
    paid: string,
    remaining: string,
  ) =>
    ({
      stage,
      cost: {
        currencyCode: code,
        invoiceAmount: invoice,
        paidAmount: paid,
        remainingAmount: remaining,
      },
    }) as TicketPurchaseInboxItemV1;
  const result = purchaseSummary([
    { stage: 'UNPRICED', cost: null } as TicketPurchaseInboxItemV1,
    row('PAYING', 'USD', '2510.002', '1000', '1510.002'),
    row('PAID', 'USD', '100.0001', '100.0001', '0'),
    row(
      'READY_FOR_PAYMENT',
      'IRR',
      '9007199254740993.0001',
      '0',
      '9007199254740993.0001',
    ),
  ]);
  expect(result).toMatchObject({
    unpriced: 1,
    pending: 2,
    paid: 1,
    totals: [
      {
        currencyCode: 'USD',
        invoice: '2610.0021',
        paid: '1100.0001',
        remaining: '1510.002',
      },
      { currencyCode: 'IRR', invoice: '9007199254740993.0001' },
    ],
  });
});
