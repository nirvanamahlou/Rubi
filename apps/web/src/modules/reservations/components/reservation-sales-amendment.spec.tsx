import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SalesContractDetail } from '@nora/contracts';
import { ReservationSalesAmendment } from './reservation-sales-amendment';
const contract = {
  id: 'contract',
  version: 1,
  customerId: 'buyer',
  payerCustomerId: 'buyer',
  tripType: 'ONE_WAY',
  originId: 'origin',
  destinationId: 'destination',
  departureDate: '2027-01-01',
  returnNotBefore: null,
  servicesDetail: [
    {
      clientKey: 'hotel',
      kind: 'HOTEL',
      titleSnapshot: 'Synthetic Hotel',
      status: 'SELECTED',
    },
  ],
  passengersDetail: [
    {
      customerId: 'a',
      displayNameSnapshot: 'Synthetic A',
      ageCategory: 'ADT',
      birthDate: '1990-01-01',
      serviceClientKeys: ['hotel'],
    },
    {
      customerId: 'b',
      displayNameSnapshot: 'Synthetic B',
      ageCategory: 'ADT',
      birthDate: '1990-01-01',
      serviceClientKeys: ['hotel'],
    },
  ],
  ticketSelections: [],
  priceComponents: [
    { type: 'BASE', title: 'Sale', amount: '100', currencyCode: 'USD' },
  ],
  hotelSelection: {
    hotelId: 'hotel-id',
    hotelNameSnapshot: 'Synthetic Hotel',
    cityId: 'destination',
    serviceClientKey: 'hotel',
    roomTypeId: 'type-id',
    roomCount: 1,
    occupancy: 2,
    checkInDate: '2027-01-01',
    checkOutDate: '2027-01-03',
    inventoryStatus: 'NEEDS_RESERVATION_CONFIRMATION',
    rooms: [
      {
        ordinal: 1,
        roomTypeId: 'type-id',
        roomTypeNameSnapshot: 'Saved Deluxe',
        adults: 2,
        childAges: [],
        roomCategory: 'DOUBLE',
      },
    ],
  },
} as unknown as SalesContractDetail;
it('exposes add/remove alongside the contract room category in the correction tab', () => {
  const html = renderToStaticMarkup(
    <ReservationSalesAmendment
      contract={contract}
      requestId="request"
      section="CORRECTION"
      onSaved={() => undefined}
    />,
  );
  expect(html).toContain('افزودن مسافر');
  expect(html).toContain('تعداد مسافران قرارداد');
  expect(html).not.toContain('قیمت کل مسافر');
  expect(html).toContain('Saved Deluxe');
  expect(html).toContain('Double');
});
it('makes aggregate passenger completion reachable from the empty correction tab', () => {
  const anonymous = {
    ...contract,
    passengersDetail: [],
    servicesDetail: contract.servicesDetail.map((s) => ({
      ...s,
      metadata: {
        legacyServicePartiesV2: JSON.stringify({
          hotel: { adults: 2, children: 0, infants: 0 },
        }),
      },
    })),
  };
  const html = renderToStaticMarkup(
    <ReservationSalesAmendment
      contract={anonymous}
      requestId="request"
      section="CORRECTION"
      onSaved={() => undefined}
    />,
  );
  expect(html).toContain('افزودن مسافر');
  expect(html).not.toContain('>حذف مسافر<');
});
it('keeps saved room types and categories visible in the hotel editor before master-data fetching finishes', () => {
  const html = renderToStaticMarkup(
    <ReservationSalesAmendment
      contract={contract}
      section="HOTEL"
      onSaved={() => undefined}
    />,
  );
  expect(html).toContain('Saved Deluxe');
  expect(html).toContain('Double');
  expect(html).toContain('دسته‌بندی اتاق');
});
