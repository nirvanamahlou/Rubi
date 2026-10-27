import { describe, expect, it } from 'vitest';
import {
  readPassengerTotalPrices,
  readPassengerDeductions,
  validatePassengerTotalPricing,
  validatePassengerHotelStays,
  type SalesContractAmendmentV1,
} from '@nora/contracts';
import { changeAmendmentMembership } from './amendment-membership';
const draft = (): SalesContractAmendmentV1 => ({
  version: 7,
  reason: '',
  customerId: 'buyer',
  payerCustomerId: 'buyer',
  tripType: 'ONE_WAY',
  originId: 'a',
  destinationId: 'b',
  departureDate: '2027-01-01',
  services: [
    {
      clientKey: 'hotel',
      kind: 'HOTEL',
      titleSnapshot: 'Hotel',
      status: 'SELECTED',
      metadata: {
        passengerPackagePricingVersion: 1,
        passengerTotalPricesV1: JSON.stringify({
          a: [{ amount: '100', currencyCode: 'USD' }],
          b: [{ amount: '80', currencyCode: 'USD' }],
        }),
        passengerDeductionsV1: JSON.stringify({
          b: { discount: { amount: '10', currencyCode: 'USD' } },
        }),
        passengerHotelStaysV1: JSON.stringify({
          a: {
            different: false,
            checkInDate: '2027-01-01',
            checkOutDate: '2027-01-03',
          },
          b: {
            different: true,
            checkInDate: '2027-01-02',
            checkOutDate: '2027-01-03',
          },
        }),
      },
    },
    {
      clientKey: 'transfer',
      kind: 'TRANSFER',
      titleSnapshot: 'Transfer',
      status: 'SELECTED',
      metadata: { passengerPackagePricingVersion: 1, passengerCount: 2 },
    },
  ],
  passengers: ['a', 'b'].map((id) => ({
    customerId: id,
    displayNameSnapshot: 'Synthetic ' + id,
    birthDate: '',
    ageCategory: 'ADT',
    serviceClientKeys: ['hotel', 'transfer'],
    agreedPrices: [{ amount: id === 'a' ? '100' : '70', currencyCode: 'USD' }],
  })),
  passengerCategories: { a: 'ADT', b: 'ADT' },
  priceComponents: [
    { type: 'BASE', title: 'Sale', amount: '170', currencyCode: 'USD' },
  ],
  hotelSelection: {
    serviceClientKey: 'hotel',
    hotelId: 'h',
    hotelNameSnapshot: 'Hotel',
    cityId: 'b',
    checkInDate: '2027-01-01',
    checkOutDate: '2027-01-03',
    roomCount: 1,
    roomTypeId: 'r',
    occupancy: 2,
    inventoryStatus: 'NEEDS_RESERVATION_CONFIRMATION',
  },
});
describe('versioned amendment membership', () => {
  it('does not guess a passenger share from an old contract-wide total before removal', () => {
    const old = draft();
    const unpriced = {
      ...old,
      passengers: old.passengers.map((p) => {
        const copy = { ...p };
        delete copy.agreedPrices;
        return copy;
      }),
    };
    expect(() => changeAmendmentMembership(unpriced, { remove: 'a' })).toThrow(
      'قیمت هر مسافر',
    );
    expect(unpriced.priceComponents).toEqual(old.priceComponents);
  });
  it('adds explicit price and selected links without copying another passenger identity or deductions', () => {
    const old = draft();
    const next = changeAmendmentMembership(old, {
      add: {
        customerId: 'c',
        displayNameSnapshot: 'Synthetic c',
        birthDate: '',
        serviceClientKeys: ['hotel', 'transfer'],
      },
      category: 'CHD',
      prices: [{ amount: '25.125', currencyCode: 'EUR' }],
    });
    expect(next.version).toBe(7);
    expect(next.passengers).toHaveLength(3);
    expect(next.passengerCategories.c).toBe('CHD');
    expect(next.passengers[2]!.agreedPrices).toEqual([
      { amount: '25.125', currencyCode: 'EUR' },
    ]);
    expect(readPassengerDeductions(next.services, next.passengers)).toEqual({
      b: { discount: { amount: '10', currencyCode: 'USD' } },
    });
    expect(
      next.services.find((s) => s.kind === 'TRANSFER')!.metadata!
        .passengerCount,
    ).toBe(3);
    expect(() => validatePassengerHotelStays(next)).not.toThrow();
    expect(() =>
      validatePassengerTotalPricing(next.services, next.passengers),
    ).not.toThrow();
    expect(old.passengers).toHaveLength(2);
  });
  it('removes only the link and its price/deductions/stay while retaining payer and surviving amounts', () => {
    const old = draft();
    const next = changeAmendmentMembership(old, { remove: 'b' });
    expect(next.customerId).toBe('buyer');
    expect(next.passengerCategories).toEqual({ a: 'ADT' });
    expect(readPassengerTotalPrices(next.services, next.passengers)).toEqual({
      a: [{ amount: '100', currencyCode: 'USD' }],
    });
    expect(readPassengerDeductions(next.services, next.passengers)).toEqual({});
    expect(next.services[1]!.metadata!.passengerCount).toBe(1);
    expect(() => validatePassengerHotelStays(next)).not.toThrow();
    expect(() =>
      validatePassengerTotalPricing(next.services, next.passengers),
    ).not.toThrow();
    expect(old.passengers).toHaveLength(2);
  });
  it('rejects duplicate passengers, absent explicit price and an empty ordinary contract', () => {
    const old = draft();
    expect(() =>
      changeAmendmentMembership(old, {
        add: old.passengers[0]!,
        category: 'ADT',
        prices: [],
      }),
    ).toThrow('قبلاً');
    expect(() =>
      changeAmendmentMembership(old, {
        add: { ...old.passengers[0]!, customerId: 'new' },
        category: 'ADT',
        prices: [],
      }),
    ).toThrow('قیمت');
    const one = changeAmendmentMembership(old, { remove: 'b' });
    expect(() => changeAmendmentMembership(one, { remove: 'a' })).toThrow(
      'حداقل',
    );
  });
});
