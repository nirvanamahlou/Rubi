import { describe, expect, it } from 'vitest';
import type { TicketOfferV1 } from '@nora/contracts';
import {
  emptySalesForm,
  salesPayload,
  type SalesFormState,
} from './sales-form';
import { ticketOnlySaleDefaults } from './ticket-only-sale-defaults';

const offer: TicketOfferV1 = {
  id: 'OUT',
  version: 1,
  branchId: 'branch',
  originId: 'origin',
  destinationId: 'destination',
  departureAt: '2099-10-01T08:00:00.000Z',
  arrivalAt: '2099-10-01T10:00:00.000Z',
  carrierName: 'Carrier',
  serviceNumber: 'OUT',
  cabinClassCode: 'ECONOMY',
  totalCapacity: 20,
  remainingCapacity: 20,
  status: 'ACTIVE',
  standaloneSalePrice: { revision: 1, amount: '100.25', currencyCode: 'IRR' },
};
const draft = (): SalesFormState => ({
  ...emptySalesForm,
  serviceKinds: ['FLIGHT'],
  outboundOffer: offer,
  ticket: {
    ...emptySalesForm.ticket,
    outboundOfferId: offer.id,
    outboundDepartureAt: offer.departureAt,
    outboundArrivalAt: offer.arrivalAt,
  },
  servicePricing: {},
});
const price = (state: SalesFormState) =>
  state.servicePricing!['flight-outbound']![0]!;

describe('new ticket-only catalog sale defaults', () => {
  it('preserves an entered legacy draft amount even when its old day sale mirrored the agreement', () => {
    const initial = ticketOnlySaleDefaults(draft());
    const entered = {
      ...price(initial),
      daySale: { basis: 'TOTAL' as const, amount: '90' },
      agreed: { basis: 'TOTAL' as const, amount: '90' },
    };
    const state = ticketOnlySaleDefaults({
      ...initial,
      catalogSalePricing: {},
      servicePricing: { 'flight-outbound': [entered] },
    });
    expect(price(state).daySale.amount).toBe('100.25');
    expect(price(state).agreed.amount).toBe('90');
  });
  it('defaults both prices to the catalog fare and sends the same quote in the payload', () => {
    const state = ticketOnlySaleDefaults(draft());
    expect(price(state).daySale.amount).toBe('100.25');
    expect(price(state).agreed.amount).toBe('100.25');
    const flight = salesPayload(state).services.find(
      (service) => service.clientKey === 'flight-outbound',
    )!;
    expect(flight.pricing?.[0]?.daySale.amount).toBe('100.25');
    expect(flight.metadata?.catalogSaleQuoteAmount).toBe('100.25');
  });

  it.each(['90', '', '0'])(
    'keeps editable negotiated value %s and restores the actual day sale',
    (amount) => {
      const initial = ticketOnlySaleDefaults(draft());
      const stale = {
        ...price(initial),
        daySale: { basis: 'TOTAL' as const, amount },
        agreed: { basis: 'TOTAL' as const, amount },
      };
      const state = ticketOnlySaleDefaults({
        ...initial,
        servicePricing: { 'flight-outbound': [stale] },
      });
      expect(price(state).daySale.amount).toBe('100.25');
      expect(price(state).agreed.amount).toBe(amount);
    },
  );

  it('updates a default when seated passengers change but preserves a negotiated total and excludes infants', () => {
    const initial = ticketOnlySaleDefaults(draft());
    const composition = { adults: 2, children: 1, infants: 1 };
    expect(
      price(
        ticketOnlySaleDefaults({
          ...initial,
          passengerComposition: composition,
        }),
      ).agreed.amount,
    ).toBe('300.75');
    const negotiated = {
      ...price(initial),
      agreed: { basis: 'TOTAL' as const, amount: '85' },
    };
    const state = ticketOnlySaleDefaults({
      ...initial,
      passengerComposition: composition,
      servicePricing: { 'flight-outbound': [negotiated] },
    });
    expect(price(state).daySale.amount).toBe('300.75');
    expect(price(state).agreed.amount).toBe('85');
  });

  it('uses the combined round-trip fare rather than adding the two one-way fares', () => {
    const state = ticketOnlySaleDefaults({
      ...draft(),
      tripType: 'ROUND_TRIP',
      outboundOffer: {
        ...offer,
        roundTripSalePrices: [
          {
            returnOfferId: 'RET',
            revision: 1,
            amount: '175.0001',
            currencyCode: 'IRR',
          },
        ],
      },
      returnOffer: { ...offer, id: 'RET' },
      ticket: {
        ...emptySalesForm.ticket,
        outboundOfferId: 'OUT',
        returnOfferId: 'RET',
      },
    });
    const prices = Object.values(state.servicePricing!).flat();
    expect(prices.map((row) => row.daySale.amount)).toEqual([
      '87.5',
      '87.5001',
    ]);
    expect(prices.map((row) => row.agreed.amount)).toEqual(['87.5', '87.5001']);
  });

  it('uses the available seat tiers with exact decimal totals', () => {
    const state = ticketOnlySaleDefaults({
      ...draft(),
      passengerComposition: { adults: 2, children: 0, infants: 0 },
      outboundOffer: {
        ...offer,
        remainingCapacity: 2,
        standaloneSalePrice: {
          revision: 2,
          amount: '100.25',
          currencyCode: 'IRR',
          tiers: [
            { seatCount: 19, amount: '100.25' },
            { seatCount: 1, amount: '120.5' },
          ],
        },
      },
    });
    expect(price(state).daySale.amount).toBe('220.75');
  });

  it('does not reuse a negotiated value in another currency', () => {
    const initial = ticketOnlySaleDefaults(draft());
    const state = ticketOnlySaleDefaults({
      ...initial,
      outboundOffer: {
        ...offer,
        standaloneSalePrice: { revision: 2, amount: '10', currencyCode: 'USD' },
      },
    });
    expect(price(state).currencyCode).toBe('USD');
    expect(price(state).agreed.amount).toBe('10');
  });

  it('leaves unpriced tickets and mixed-service contracts unchanged', () => {
    const unpriced = ticketOnlySaleDefaults({
      ...draft(),
      outboundOffer: { ...offer, standaloneSalePrice: null },
    });
    expect(unpriced.servicePricing).toEqual({});
    for (const serviceKinds of [
      ['FLIGHT', 'HOTEL'],
      ['FLIGHT', 'INSURANCE'],
    ] as SalesFormState['serviceKinds'][]) {
      const mixed = { ...draft(), serviceKinds };
      expect(ticketOnlySaleDefaults(mixed)).toBe(mixed);
    }
  });

  it('does not throw when a restored draft contains an empty previous day-sale value', () => {
    const initial = ticketOnlySaleDefaults(draft());
    const previous = {
      ...price(initial),
      daySale: { basis: 'TOTAL' as const, amount: '' },
    };
    expect(() =>
      ticketOnlySaleDefaults({
        ...initial,
        catalogSalePricing: {},
        servicePricing: { 'flight-outbound': [previous] },
      }),
    ).not.toThrow();
  });
});
