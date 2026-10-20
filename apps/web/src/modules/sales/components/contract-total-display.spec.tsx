import { expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { TicketOfferV1 } from '@nora/contracts';
import { emptySalesForm } from '../model/sales-form';
import { ContractTotalPrices } from './contract-total-prices';
import { ContractServiceSummary } from './contract-service-summary';

it('shows Gregorian English travel dates for a foreign route in the contract summary', () => {
  const html = renderToStaticMarkup(
    <ContractServiceSummary
      state={{
        ...emptySalesForm,
        destinationCountryCode: 'TR',
        serviceKinds: ['FLIGHT', 'HOTEL'],
        tripType: 'ONE_WAY',
        ticket: {
          ...emptySalesForm.ticket,
          outboundDepartureAt: '2026-10-23T17:50:00Z',
        },
        hotel: {
          ...emptySalesForm.hotel,
          checkIn: '2026-10-23',
          checkOut: '2026-10-30',
        },
      }}
    />,
  );
  expect(html).toContain('23 Oct 2026');
  expect(html).toContain('30 Oct 2026');
  expect(html).not.toContain('۱۴۰۵');
});

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

it('renders a separate foreign agreed price for each room within the contract total', () => {
  const html = renderToStaticMarkup(
    <ContractTotalPrices
      state={{
        ...emptySalesForm,
        serviceKinds: ['HOTEL'],
        hotel: {
          ...emptySalesForm.hotel,
          rooms: [
            {
              ordinal: 1,
              roomTypeId: 'a',
              roomTypeNameSnapshot: 'Double',
              adults: 2,
              childAges: [],
              agreedPrice: { currencyCode: 'USD', amount: '100.25' },
            },
            {
              ordinal: 2,
              roomTypeId: 'b',
              roomTypeNameSnapshot: 'Single',
              adults: 1,
              childAges: [],
              agreedPrice: { currencyCode: 'USD', amount: '60.50' },
            },
          ],
        },
        contractPrices: [{ currencyCode: 'USD', amount: '160.75' }],
      }}
      currencies={[
        { code: 'USD', name: 'Dollar', status: 'active' },
        { code: 'IRR', name: 'Rial', status: 'active' },
      ]}
      onRoomPricesChange={vi.fn()}
      onChange={vi.fn()}
    />,
  );
  expect(html).toContain('aria-label="مبلغ اتاق 1"');
  expect(html).toContain('aria-label="مبلغ اتاق 2"');
  expect(html).toContain('100.25');
  expect(html).toContain('60.50');
  expect(html).toContain('160.75');
});

it('allows selecting IRR as the negotiated room currency', () => {
  const rooms = [
    {
      ordinal: 1,
      roomTypeId: 'room',
      roomTypeNameSnapshot: 'Standard',
      adults: 1,
      childAges: [],
      agreedPrice: { amount: '500', currencyCode: 'USD' },
    },
  ];
  const change = vi.fn();
  const view = ContractTotalPrices({
    state: {
      ...emptySalesForm,
      serviceKinds: ['HOTEL'],
      hotel: { ...emptySalesForm.hotel, rooms },
    },
    currencies: [
      { code: 'IRR', name: 'Rial', status: 'active' },
      { code: 'USD', name: 'Dollar', status: 'active' },
    ],
    onChange: vi.fn(),
    onRoomPricesChange: change,
  });
  const selector =
    view.props.children[1].props.children[2][0].props.children[1];
  expect(
    selector.props.currencies.map((c: { code: string }) => c.code),
  ).toContain('IRR');
  selector.props.onChange('IRR');
  expect(change).toHaveBeenCalledWith([
    { ...rooms[0], agreedPrice: { amount: '500', currencyCode: 'IRR' } },
  ]);
});
