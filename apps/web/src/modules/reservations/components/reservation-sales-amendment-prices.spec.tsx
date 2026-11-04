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
          legacyServicePartiesV2: JSON.stringify({
            'insurance-extra': { adults: 2, children: 1, infants: 0 },
          }),
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
    hotelSelection: {
      rooms: [
        {
          ordinal: 1,
          roomTypeId: 'room',
          roomTypeNameSnapshot: 'Family',
          adults: 2,
          childAges: [4],
          agreedPrice: { amount: '45', currencyCode: 'EUR' },
        },
      ],
    },
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
  expect(html).toContain('value="1,100"');
  expect(html).not.toContain('value="45"');
  expect(html).toContain('بزرگسال 1');
  expect(html).toContain('کودک 1');
  expect(html).toContain('رده سنی');
  expect(html).not.toContain('قیمت اتاق');
  expect(html).not.toContain('ارز اتاق');
  expect(html).not.toContain('value="100"');
  expect(html).toContain('مبلغ کل قرارداد');
  expect(html).toContain('قیمت ریالی');
});

it('shows passenger price, discount and commission together without old room currency controls', () => {
  const contract = {
    id: 'contract',
    version: 1,
    customerId: 'buyer',
    payerCustomerId: 'buyer',
    assignedUserId: null,
    tripType: 'ONE_WAY',
    originId: 'a',
    destinationId: 'b',
    departureDate: '2099-01-01',
    servicesDetail: [
      {
        clientKey: 'hotel',
        kind: 'HOTEL',
        metadata: {
          passengerPackagePricingVersion: 1,
          passengerTotalPricesV1: JSON.stringify({
            p: [{ amount: '100', currencyCode: 'USD' }],
          }),
          passengerDeductionsV1: JSON.stringify({
            p: {
              discount: { amount: '10', currencyCode: 'USD' },
              commission: { amount: '5', currencyCode: 'USD' },
            },
          }),
        },
      },
    ],
    passengersDetail: [
      {
        customerId: 'p',
        displayNameSnapshot: 'SYNTHETIC PASSENGER',
        ageCategory: 'ADT',
        birthDate: '1990-01-01',
        agreedPrices: [{ amount: '85', currencyCode: 'USD' }],
        serviceClientKeys: ['hotel'],
      },
    ],
    hotelSelection: {
      rooms: [
        {
          ordinal: 1,
          roomTypeNameSnapshot: 'OLD ROOM',
          adults: 1,
          childAges: [],
        },
      ],
    },
    priceComponents: [
      { type: 'BASE', title: 'Total', amount: '85', currencyCode: 'USD' },
    ],
  } as unknown as SalesContractDetail;
  const html = renderToStaticMarkup(
    <ReservationSalesAmendment
      contract={contract}
      section="PRICES"
      onSaved={vi.fn()}
    />,
  );
  expect(html).toContain('<table');
  for (const text of [
    'SYNTHETIC PASSENGER',
    'قیمت ریالی',
    'قیمت ارزی',
    'تخفیف',
    'کمیسیون',
  ])
    expect(html).toContain(text);
  expect(html).toContain('value="100"');
  expect(html).toContain('value="10"');
  expect(html).toContain('value="5"');
  expect(html).not.toContain('ارز اتاق');
  expect(html).not.toContain('قیمت اتاق');
});
