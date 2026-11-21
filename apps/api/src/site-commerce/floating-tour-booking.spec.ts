import { describe, expect, it, vi } from 'vitest';
import { salesContractFlights } from '@nora/contracts';
import { validateSalesContract } from '../sales/sales.domain';
import {
  floatingNativeDraft,
  floatingWebsiteRooms,
  validateFloatingBooking,
  type FloatingWebsiteBooking,
} from './floating-tour-booking';

const id = (n: number) =>
  '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const outbound = {
  originAirport: {
    id: id(1),
    cityId: id(3),
    countryId: id(5),
    code: 'IKA',
    name: 'Imam Khomeini',
  },
  destinationAirport: {
    id: id(2),
    cityId: id(4),
    countryId: id(6),
    code: 'AYT',
    name: 'Antalya',
  },
  departureAt: '2035-10-01T09:00:00.000Z',
  arrivalAt: '2035-10-01T12:00:00.000Z',
  carrierName: 'Synthetic Air',
  serviceNumber: 'SA123',
  cabinClassCode: 'ECONOMY' as const,
};
const inbound = {
  ...outbound,
  originAirport: outbound.destinationAirport,
  destinationAirport: outbound.originAirport,
  departureAt: '2035-10-07T21:20:00.000Z',
  arrivalAt: '2035-10-08T00:00:00.000Z',
  serviceNumber: 'SA124',
};
const stay = {
  hotelId: id(7),
  cityId: id(4),
  hotelName: 'Test Hotel',
  room: 'STD',
  service: 'BB',
  location: '',
  nights: 7,
};
const row = {
  startsOn: '2035-10-01',
  endsOn: '2035-10-08',
  nights: 7,
  stays: [stay],
  prices: {
    double: [
      { currency: 'EUR' as const, amount: '25.10' },
      { currency: 'IRR' as const, amount: '80000' },
    ],
  },
  flightSchedule: {
    outbound,
    inbound,
    startsOn: '2035-10-01',
    endsOn: '2035-10-08',
  },
};
const definition = {
  originId: id(3),
  destinationId: id(4),
  name: 'Synthetic tour',
  transferOutbound: true,
};
const product = { package: definition, dated: [row], monthly: null };
const references = {
  detail: vi.fn(async (kind: string) => ({
    data:
      kind === 'hotels'
        ? {
            id: id(7),
            name: 'Test Hotel',
            status: 'active',
            attributes: { cityId: id(4), roomTypeIds: id(8) },
          }
        : {
            id: id(8),
            name: 'Standard',
            code: 'STD',
            status: 'active',
            attributes: {},
          },
  })),
};

const input = (roomCode: string): FloatingWebsiteBooking => ({
  publicationId: id(20),
  roomCode,
  customerId: id(21),
  rooms: [[0, 1]],
  childrenWithoutBed: [],
  expectedAmount: '30280000',
  buyerContact: {
    name: 'Synthetic Buyer',
    phone: '09120000001',
    landline: '02172075000',
    address: 'Synthetic test address',
    postalCode: '1234567890',
  },
  passengers: [id(22), id(23)].map((customerId) => ({
    customerId,
    displayNameSnapshot: 'Synthetic Traveller',
    birthDate: '2000-01-01',
  })),
});

describe('published floating checkout', () => {
  it('surfaces exact converted per-person fares and creates a native, inventory-free ERP draft', async () => {
    const choices = await floatingWebsiteRooms(
      product as never,
      { IRR: '1', EUR: '600000' },
      references as never,
    );
    expect(choices).toHaveLength(1);
    const booking = input(choices[0]!.roomCode);
    validateFloatingBooking(booking);
    const draft = floatingNativeDraft(booking, definition as never, choices);
    expect(() => validateSalesContract(draft, true)).not.toThrow();
    expect(draft.priceComponents[0]).toMatchObject({
      amount: '30280000',
      currencyCode: 'IRR',
    });
    expect(draft.returnNotBefore).toBe('2035-10-08');
    expect(draft.hotelSelection).toMatchObject({
      hotelId: id(7),
      roomTypeId: id(8),
      roomCount: 1,
      occupancy: 2,
    });
    expect(draft.ticketSelections ?? []).toEqual([]);
    expect(salesContractFlights(draft.services)).toMatchObject([
      {
        source: 'CONTRACT_ONLY',
        destinationAirport: { code: 'AYT' },
        serviceNumberSnapshot: 'SA123',
      },
      {
        source: 'CONTRACT_ONLY',
        originAirport: { code: 'AYT' },
        serviceNumberSnapshot: 'SA124',
        departureAt: inbound.departureAt,
      },
    ]);
    expect(() =>
      floatingNativeDraft(
        { ...booking, expectedAmount: '1' },
        definition as never,
        choices,
      ),
    ).toThrow('قیمت فروش معتبر نیست.');
    expect(() =>
      validateFloatingBooking({ ...booking, rooms: [[0], [0]] }),
    ).toThrow();
  });

  it('excludes rows missing an approved FX rate or a scheduled flight', async () => {
    expect(
      await floatingWebsiteRooms(
        product as never,
        { IRR: '1' },
        references as never,
      ),
    ).toEqual([]);
    expect(
      await floatingWebsiteRooms(
        { ...product, dated: [{ ...row, flightSchedule: undefined }] } as never,
        { IRR: '1', EUR: '600000' },
        references as never,
      ),
    ).toEqual([]);
  });
});
