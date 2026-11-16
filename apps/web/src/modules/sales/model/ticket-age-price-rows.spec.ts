import { it, expect } from 'vitest';
import { ticketPriceRows } from './ticket-price-rows';
import type { TicketOfferV1 } from '@nora/contracts';
it('retains independent child and infant base prices when reopening a standalone or paired price row', () => {
  const offer = {
    id: 'out',
    cabinClassCode: 'ECONOMY',
    baseStandaloneSalePrice: {
      amount: '100',
      childAmount: '60',
      infantAmount: '10',
      currencyCode: 'IRR',
      revision: 1,
    },
    baseRoundTripSalePrices: [
      {
        returnOfferId: 'back',
        amount: '200',
        childAmount: '90',
        infantAmount: '15',
        currencyCode: 'IRR',
        revision: 2,
      },
    ],
  } as unknown as TicketOfferV1;
  const rows = ticketPriceRows([offer]);
  expect(rows[0]!.base).toMatchObject({
    childAmount: '60',
    infantAmount: '10',
  });
  expect(rows[1]!.base).toMatchObject({
    childAmount: '90',
    infantAmount: '15',
  });
});
