import { describe, expect, it } from 'vitest';
import { validateTourDeparture, validateTourPackage } from './tour-policy';
const id = '00000000-0000-4000-8000-000000000001';
const second = '00000000-0000-4000-8000-000000000002';
const pack = {
  name: 'تور آزمایشی',
  originId: id,
  destinationId: second,
  hotelIds: [],
  transferOutbound: true,
  transferReturn: true,
  visa: false,
};
const departure = {
  packageId: id,
  packageVersion: 1,
  startsOn: '2099-10-01',
  endsOn: '2099-10-08',
  outboundOfferId: id,
  returnOfferId: second,
};
describe('tour inputs', () => {
  it('converts Toman to exact canonical IRR without mutating input', () => {
    const input = {
      ...pack,
      details: {
        version: 1,
        basePrice: { amount: '123.4567', currency: 'IRT' },
      },
    };
    expect(validateTourPackage(input).details?.basePrice).toEqual({
      amount: '1234.567',
      currency: 'IRR',
    });
    expect(input.details.basePrice.currency).toBe('IRT');
  });
  it('preserves optional tour copy, exact decimal prices and ordered relative itinerary', () => {
    const details = {
      version: 1,
      summary: 'تور نمونه',
      description: 'معرفی تور',
      requiredDocuments: 'پاسپورت',
      services: 'هتل',
      installmentTerms: 'دو قسط',
      refundRules: 'طبق شرایط',
      durationDays: 8,
      rating: 4.5,
      originAirportCode: 'IKA',
      transport: 'FLIGHT',
      ticketIncluded: true,
      basePrice: { amount: '123456789012345.1234', currency: 'IRR' },
      flightPrice: { amount: '99.50', currency: 'USD' },
      itinerary: [
        { kind: 'START', startTime: '14:30', durationMinutes: 90 },
        { kind: 'STAY', location: 'آنتالیا', stayDays: 7 },
      ],
    };
    expect(validateTourPackage({ ...pack, details }).details).toEqual(details);
  });
  it.each([
    { version: 2 },
    { durationDays: -1 },
    { rating: 6 },
    { originAirportCode: 'IKAA' },
    { transport: 'BUS' },
    { basePrice: { amount: 15, currency: 'USD' } },
    { basePrice: { amount: '-15', currency: 'USD' } },
    { basePrice: { amount: '1e4', currency: 'USD' } },
    { basePrice: { amount: '123', currency: 'dollar' } },
    { itinerary: [{ startTime: '24:00' }] },
    { itinerary: [{ startsOn: '2099-01-01' }] },
    { itinerary: [{ stayDays: 1.5 }] },
    { itinerary: [{ baggageKg: -1 }] },
    { itinerary: Array.from({ length: 101 }, () => ({})) },
    { imageDocumentId: 'https://external.invalid/image.png' },
  ])('rejects invalid definition details %j', (details) => {
    expect(() =>
      validateTourPackage({ ...pack, details: { version: 1, ...details } }),
    ).toThrow();
  });
  it('accepts registered reference IDs without inventing capacity', () => {
    expect(validateTourPackage(pack)).toEqual(pack);
    expect(validateTourDeparture(departure)).toEqual(departure);
  });
  it.each([
    { originId: second },
    { hotelIds: [id, id] },
    { hotelIds: ['not-an-id'] },
    { capacity: 30 },
    { transferOutbound: 'yes' },
    { name: '' },
  ])('rejects invalid package %j', (patch) => {
    expect(() => validateTourPackage({ ...pack, ...patch })).toThrow();
  });
  it.each([
    { startsOn: '2099-02-30' },
    { endsOn: '2099-09-30' },
    { startsOn: '2001-01-01' },
    { returnOfferId: id },
    { packageVersion: 0 },
    { capacity: 40 },
  ])('rejects invalid departure %j', (patch) => {
    expect(() => validateTourDeparture({ ...departure, ...patch })).toThrow();
  });
});
