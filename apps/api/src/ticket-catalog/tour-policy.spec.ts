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
  it('validates ordered combined destinations and derives total trip length without changing the caller', () => {
    const input = {
      ...pack,
      details: {
        version: 1,
        isCombined: true,
        destinations: [
          { cityId: second, nights: 4 },
          { cityId: '00000000-0000-4000-8000-000000000003', nights: 3 },
        ],
      },
    };
    const before = JSON.stringify(input);
    expect(validateTourPackage(input).details?.durationDays).toBe(8);
    expect(JSON.stringify(input)).toBe(before);
    for (const destinations of [
      [
        { cityId: id, nights: 4 },
        { cityId: second, nights: 3 },
      ],
      [
        { cityId: second, nights: 4 },
        { cityId: second, nights: 3 },
      ],
      [
        { cityId: second, nights: 0 },
        { cityId: id, nights: 3 },
      ],
    ])
      expect(() =>
        validateTourPackage({
          ...input,
          details: { ...input.details, destinations },
        }),
      ).toThrow();
    expect(() =>
      validateTourPackage({
        ...input,
        details: { ...input.details, isCombined: false },
      }),
    ).toThrow();
  });
  it('accepts a title-only definition with canonical optional defaults', () => {
    expect(validateTourPackage({ name: '  تور  ' })).toEqual({
      name: 'تور',
      originId: '',
      destinationId: '',
      hotelIds: [],
      transferOutbound: false,
      transferReturn: false,
      visa: false,
    });
  });
  it('accepts untouched blank optional controls and blank itinerary fields without mutating the request', () => {
    const input = {
      name: 'ت',
      originId: '',
      destinationId: '  ',
      insuranceId: '',
      details: {
        summary: ' ',
        durationDays: '',
        rating: '',
        itinerary: [{ title: '', startTime: ' ' }],
      },
    };
    expect(validateTourPackage(input).details).toEqual({
      version: 1,
      itinerary: [{}],
    });
    expect(input.details.summary).toBe(' ');
  });
  it('accepts a partially selected route but rejects hotels until a destination is set', () => {
    expect(
      validateTourPackage({ name: 'Partial', originId: id }).originId,
    ).toBe(id);
    expect(() =>
      validateTourPackage({ name: 'Partial', hotelIds: [id] }),
    ).toThrow('شهر مقصد');
    expect(() =>
      validateTourPackage({ name: 'Partial', originId: 'invalid' }),
    ).toThrow('شهر مبدأ');
    expect(() => validateTourPackage({ name: ' ' })).toThrow('عنوان تور');
    expect(() =>
      validateTourPackage({ name: 'Partial', surprise: '' }),
    ).toThrow();
  });
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

it('round-trips optional package services and the selected insurance without changing old definitions', () => {
  const result = validateTourPackage({
    ...pack,
    cityTour: true,
    tourGuide: true,
    insuranceId: id,
  });
  expect(result).toMatchObject({
    cityTour: true,
    tourGuide: true,
    insuranceId: id,
  });
  expect(validateTourPackage(pack).cityTour).toBeUndefined();
  expect(() =>
    validateTourPackage({ ...pack, tourGuide: 'invalid' }),
  ).toThrow();
});
