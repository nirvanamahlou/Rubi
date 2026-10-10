import { describe, expect, it } from 'vitest';
import { validateTicketOffer } from './ticket-public.service';
const base = {
  originId: '11111111-1111-4111-8111-111111111111',
  destinationId: '22222222-2222-4222-8222-222222222222',
  departureAt: '2099-10-01T10:00:00Z',
  arrivalAt: '2099-10-01T12:00:00Z',
  carrierName: 'Synthetic',
  serviceNumber: '1',
  cabinClassCode: 'ECONOMY',
  totalCapacity: 50,
};
describe('ticket supply and manual baggage', () => {
  it('accepts three supply types and nullable business allowance', () => {
    for (const supplyType of ['COMPANY', 'FLOATING', 'API'])
      expect(
        validateTicketOffer({
          ...base,
          supplyType,
          economyBaggageKg: '20.5',
          businessBaggageKg: null,
        }).supplyType,
      ).toBe(supplyType);
    expect(validateTicketOffer(base).supplyType).toBeUndefined();
  });
  it('rejects invalid classifications and negative, oversized or malformed weights', () => {
    expect(() =>
      validateTicketOffer({ ...base, supplyType: 'CHARTER' }),
    ).toThrow();
    for (const economyBaggageKg of ['-1', '10000', '9999.99', '20kg', '2.555'])
      expect(() =>
        validateTicketOffer({ ...base, economyBaggageKg }),
      ).toThrow();
  });
});
