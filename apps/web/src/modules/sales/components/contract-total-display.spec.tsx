import { expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { TicketOfferV1 } from '@nora/contracts';
import { emptySalesForm } from '../model/sales-form';
import { ContractTotalPrices } from './contract-total-prices';
import { ContractServiceSummary } from './contract-service-summary';

it('renders one total per currency without a price row for each passenger', () => {
  const html = renderToStaticMarkup(
    <ContractTotalPrices
      state={{
        ...emptySalesForm,
        passengers: [
          {
            customerId: 'person',
            displayName: 'Synthetic Passenger',
            birthDate: '2000-01-01',
          },
        ],
        contractPrices: [
          { currencyCode: 'IRR', amount: '2500000' },
          { currencyCode: 'USD', amount: '10.1254' },
        ],
      }}
      currencies={[
        { code: 'IRR', name: 'Rial', status: 'active' },
        { code: 'USD', name: 'Dollar', status: 'active' },
      ]}
      onChange={vi.fn()}
    />,
  );
  expect(html).toContain('value="2,500,000"');
  expect(html).toContain('value="10.1254"');
  expect(html).toContain('﷼');
  expect(html).toContain('$');
  expect(html).not.toContain('Synthetic Passenger');
});

it('summarizes selected flights, hotel and the actual transfer detail keys without catalog prices', () => {
  const html = renderToStaticMarkup(
    <ContractServiceSummary
      state={{
        ...emptySalesForm,
        serviceKinds: ['FLIGHT', 'HOTEL', 'TRANSFER'],
        tripType: 'ONE_WAY',
        customerName: 'Synthetic Buyer',
        passengers: [
          {
            customerId: 'person',
            displayName: 'Synthetic Passenger',
            birthDate: '2000-01-01',
          },
        ],
        outboundOffer: {
          id: 'offer',
          originId: 'a',
          destinationId: 'b',
          carrierName: 'Synthetic Airline',
          serviceNumber: 'XY1',
          cabinClassCode: 'ECONOMY',
          departureAt: '2099-10-01T10:00:00Z',
          arrivalAt: '2099-10-01T12:00:00Z',
          standaloneSalePrice: {
            revision: 1,
            amount: '999999999999',
            currencyCode: 'USD',
          },
        } as TicketOfferV1,
        hotel: {
          ...emptySalesForm.hotel,
          name: 'Synthetic Hotel',
          roomCount: 1,
          doubleRoomCount: 1,
          checkIn: '2099-10-01',
          checkOut: '2099-10-04',
          guestCustomerIds: ['person'],
        },
        serviceDetails: {
          'TRANSFER-OUTBOUND': {
            pickup: 'Synthetic Airport',
            dropoff: 'Synthetic Lobby',
            date: '2099-10-01',
          },
        },
      }}
      origin="Synthetic Origin"
      destination="Synthetic Destination"
      roomType="Synthetic Room"
    />,
  );
  for (const text of [
    'Synthetic Buyer',
    'Synthetic Airline',
    'XY1',
    'Synthetic Hotel',
    'Synthetic Room',
    'Synthetic Airport',
    'Synthetic Lobby',
    'شب',
  ])
    expect(html).toContain(text);
  expect(html).not.toContain('999999999999');
});
