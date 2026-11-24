import { describe, expect, it } from 'vitest';
import { packageRoomCode, type PackagePublishedSaleV1 } from '@nora/contracts';
import {
  datedTourDraft,
  validateDatedTourBooking,
  type DatedTour,
  type DatedTourBooking,
} from './dated-tour-booking';

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const roomCode = packageRoomCode({
  roomTypeId: id(9),
  adults: 1,
  childAges: [{ min: 2, maxExclusive: 12 }],
  board: 'BB',
});
const combinedCode = JSON.stringify({ combined: 1, identity: roomCode });
const sale: PackagePublishedSaleV1 = {
  publicationId: id(1),
  hotelId: id(6),
  hotelName: 'First hotel',
  roomCode: combinedCode,
  roomTypeName: 'Combined room',
  checkIn: '2032-11-02',
  checkOut: '2032-11-04',
  stays: [
    {
      hotelId: id(6),
      hotelName: 'First hotel',
      cityId: id(4),
      checkIn: '2032-11-02',
      checkOut: '2032-11-04',
      roomTypeId: id(9),
      roomTypeName: 'First room',
      roomCode,
    },
    {
      hotelId: id(7),
      hotelName: 'Second hotel',
      cityId: id(5),
      checkIn: '2032-11-04',
      checkOut: '2032-11-07',
      roomTypeId: id(10),
      roomTypeName: 'Second room',
      roomCode: packageRoomCode({
        roomTypeId: id(10),
        adults: 1,
        childAges: [{ min: 2, maxExclusive: 12 }],
        board: 'BB',
      }),
    },
  ],
  prices: [
    { currencyCode: 'IRR', amount: '3100000' },
    { currencyCode: 'EUR', amount: '10.25' },
  ],
};
const tour: DatedTour = {
  id: id(12),
  version: 3,
  outbound: {
    id: id(13),
    originId: id(3),
    destinationId: id(4),
    departureAt: '2032-11-02T05:00:00Z',
    arrivalAt: '2032-11-02T08:00:00Z',
    carrierName: 'Fixture Air',
    serviceNumber: '91',
    cabinClassCode: 'ECONOMY',
    remainingCapacity: 2,
    supplyType: 'CHARTER',
  },
  package: {
    destinationId: id(4),
    transferOutbound: true,
    insuranceId: id(11),
  },
};
const booking: DatedTourBooking = {
  publicationId: id(2),
  customerId: id(14),
  buyerContact: {
    name: 'Fixture Buyer',
    phone: '09000000000',
    address: 'Fixture address',
    postalCode: '',
  },
  passengers: [
    {
      customerId: id(15),
      displayNameSnapshot: 'Fixture Adult',
      birthDate: '1985-01-01',
    },
    {
      customerId: id(16),
      displayNameSnapshot: 'Fixture Child',
      birthDate: '2023-09-01',
    },
  ],
  rooms: [
    { publicationId: id(1), roomCode: combinedCode, passengerIndexes: [0, 1] },
  ],
  expectedTotals: [...sale.prices],
};
const now = Date.parse('2032-11-01T12:00:00Z');

describe('dated website tour contracts', () => {
  it('includes every published stay, services and unchanged totals without a payment', () => {
    validateDatedTourBooking(booking);
    const draft = datedTourDraft(booking, tour, [sale], now);
    expect(draft.hotelSelection?.rooms?.[0]?.roomTypeNameSnapshot).toBe(
      'First room',
    );
    expect(draft.hotelSelection?.additionalStays?.[0]).toMatchObject({
      hotelId: id(7),
      cityId: id(5),
      rooms: [{ roomTypeId: id(10), adults: 1, childAges: [9] }],
    });
    expect(draft.services.map((service) => service.kind)).toEqual([
      'FLIGHT',
      'HOTEL',
      'TRANSFER',
      'INSURANCE',
    ]);
    expect(
      draft.priceComponents.map(({ currencyCode, amount }) => ({
        currencyCode,
        amount,
      })),
    ).toEqual([...sale.prices].reverse());
    expect(draft.payments).toBeUndefined();
  });
  it('rejects replaced prices, insufficient live capacity and duplicate allocations', () => {
    expect(() =>
      datedTourDraft(
        { ...booking, expectedTotals: [{ currencyCode: 'IRR', amount: '1' }] },
        tour,
        [sale],
        now,
      ),
    ).toThrow();
    expect(() =>
      datedTourDraft(
        booking,
        { ...tour, outbound: { ...tour.outbound, remainingCapacity: 1 } },
        [sale],
        now,
      ),
    ).toThrow();
    expect(() =>
      validateDatedTourBooking({
        ...booking,
        rooms: [{ ...booking.rooms[0]!, passengerIndexes: [0, 0] }],
      }),
    ).toThrow();
  });
});
