import { expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SalesContractDetail } from '@nora/contracts';
import { ReservationSalesAmendment } from './reservation-sales-amendment';

it('edits the contract total rather than just the insurance surcharge for aggregate contracts', () => {
  const contract = {
    id: 'synthetic-contract',
    version: 1,
    customerId: 'buyer',
    payerCustomerId: 'buyer',
    assignedUserId: null,
    tripType: 'ONE_WAY',
    originId: 'a',
    destinationId: 'b',
    departureDate: '2099-01-01',
    returnNotBefore: null,
    servicesDetail: [
      {
        clientKey: 'insurance-extra',
        kind: 'OTHER',
        titleSnapshot: 'Synthetic surcharge',
        metadata: {
          contractPackagePricingVersion: 1,
          insuranceAgeSurcharge: true,
        },
        pricing: [
          {
            version: 1,
            currencyCode: 'IRR',
            daySale: { basis: 'TOTAL', amount: '100' },
            agreed: { basis: 'TOTAL', amount: '100' },
          },
        ],
      },
    ],
    passengersDetail: [],
    ticketSelections: [],
    hotelSelection: null,
    priceComponents: [
      {
        type: 'BASE',
        title: 'مبلغ کل قرارداد',
        currencyCode: 'IRR',
        amount: '1100',
      },
    ],
    fxSnapshot: null,
    pricingNotes: null,
    paymentTerms: null,
  } as unknown as SalesContractDetail;
  const html = renderToStaticMarkup(
    <ReservationSalesAmendment
      contract={contract}
      section="PRICES"
      onSaved={vi.fn()}
    />,
  );
  expect(html).toContain('value="1100"');
  expect(html).not.toContain('value="100"');
  expect(html).toContain('مبلغ کل قرارداد');
  expect(html).toContain('﷼');
});
