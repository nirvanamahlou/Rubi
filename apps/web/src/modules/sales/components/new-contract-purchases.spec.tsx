import { expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SalesContractCreateRequest } from '@nora/contracts';
import { NewContractPurchases } from './new-contract-purchases';
vi.mock(
  '@/modules/reservations/components/reservation-floating-flight-purchase',
  () => ({
    ReservationFloatingFlightPurchase: ({
      serviceClientKey,
    }: {
      serviceClientKey: string;
    }) => <p>{serviceClientKey}</p>,
  }),
);
vi.mock('@/modules/reservations/components/hotel-stay-purchase', () => ({
  HotelStayPurchase: ({ stayKey }: { stayKey: string }) => <p>{stayKey}</p>,
}));
const input = {
  customerId: 'p',
  passengers: [],
  ticketSelections: [],
  priceComponents: [],
  services: [
    {
      kind: 'FLIGHT',
      clientKey: 'flight-outbound',
      metadata: { contractFlightVersion: 1 },
    },
    {
      kind: 'FLIGHT',
      clientKey: 'flight-return',
      metadata: { contractFlightVersion: 1 },
    },
  ],
} as unknown as SalesContractCreateRequest;
it('shows the selected floating legs and excludes a company leg', () => {
  let html = renderToStaticMarkup(
    <NewContractPurchases input={input} onStage={() => {}} />,
  );
  expect(html).toContain('flight-outbound');
  expect(html).toContain('flight-return');
  html = renderToStaticMarkup(
    <NewContractPurchases
      input={{ ...input, services: input.services.slice(0, 1) }}
      onStage={() => {}}
    />,
  );
  expect(html).not.toContain('flight-return');
  expect(
    renderToStaticMarkup(
      <NewContractPurchases
        input={{
          ...input,
          services: [
            { kind: 'FLIGHT', clientKey: 'company', titleSnapshot: 'Company' },
          ],
        }}
        onStage={() => {}}
      />,
    ),
  ).toBe('');
});

it('shows the hotel purchase form for an explicitly floating hotel-only contract', () => {
  const hotelInput = {
    ...input,
    services: [
      {
        kind: 'HOTEL',
        clientKey: 'hotel-only',
        titleSnapshot: 'Hotel',
        metadata: { purchaseSupplyType: 'FLOATING' },
      },
    ],
    hotelSelection: {
      serviceClientKey: 'hotel-only',
      hotelId: 'hotel',
      hotelNameSnapshot: 'SYNTH HOTEL',
    },
  } as unknown as SalesContractCreateRequest;
  const html = renderToStaticMarkup(
    <NewContractPurchases input={hotelInput} onStage={() => {}} />,
  );
  expect(html).toContain('خرید قرارداد شناوری');
  expect(html).toContain('hotel-only');
  expect(html).not.toContain('flight-outbound');
  expect(
    renderToStaticMarkup(
      <NewContractPurchases
        input={{
          ...hotelInput,
          services: [{ ...hotelInput.services[0]!, metadata: {} }],
        }}
        onStage={() => {}}
      />,
    ),
  ).not.toContain('خرید قرارداد شناوری');
});
