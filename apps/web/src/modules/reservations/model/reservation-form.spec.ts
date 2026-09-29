import { describe, expect, it } from 'vitest';
import {
  reservationFormData,
  reservationPassengerPages,
  type ReservationFormIntake,
} from './reservation-form';
const input = {
  receivedAt: '2026-09-09T10:00:00Z',
  snapshot: {
    contractNumber: 'SYNTHETIC',
    passengerIds: ['a', 'b'],
    passengerAssignments: [
      {
        customerId: 'a',
        displayNameSnapshot: 'SAMPLE / ONE',
        ageCategory: 'ADT',
      },
      {
        customerId: 'b',
        displayNameSnapshot: 'SAMPLE / TWO',
        ageCategory: 'CHD',
      },
    ],
    serviceSelections: [],
    hotelSelection: {
      hotelId: 'h',
      hotelNameSnapshot: 'Sample Hotel',
      cityId: 'c',
      checkInDate: '2026-10-01',
      checkOutDate: '2026-10-07',
      roomCount: 2,
      roomTypeId: 'r',
    },
  },
  workflow: {
    roomOrder: ['b', 'a'],
    ageOverrides: { b: 'INFANT' },
    updatedAt: null,
    note: '',
    branding: { name: 'Sample Agency' },
  },
} as unknown as ReservationFormIntake;
describe('reservation reference form', () => {
  it('prefers the registered English hotel name and preserves snapshot fallback', () => {
    expect(reservationFormData(input).hotel).toBe('Sample Hotel');
    expect(
      reservationFormData(input, {
        h: { attributes: { englishName: 'ENGLISH HOTEL' } } as never,
      }).hotel,
    ).toBe('ENGLISH HOTEL');
    expect(input.snapshot.hotelSelection?.hotelNameSnapshot).toBe(
      'Sample Hotel',
    );
  });
  it('uses actual ordered passengers and overrides without copying source sample data', () => {
    const data = reservationFormData(input);
    expect(data.passengers.map((p) => p.id)).toEqual(['b', 'a']);
    expect(data.adults).toBe(1);
    expect(data.children).toBe(0);
    expect(data.infants).toBe(1);
    expect(data.nights).toBe(6);
    expect(data.supplier).toBe('-');
    expect(data.passengers[0]?.sex).toBe('-');
    expect(JSON.stringify(data)).not.toContain('HILLSROY');
  });
  it('uses reference names and current operational room counts', () => {
    const data = reservationFormData(
      {
        ...input,
        arrangement: {
          roomCount: 3,
          doubleRoomCount: 2,
          singleRoomCount: 1,
          extraBedCount: 0,
        } as ReservationFormIntake['arrangement'],
      },
      {
        c: { name: 'شهر', attributes: { englishName: 'SAMPLE CITY' } } as never,
      },
    );
    expect(data.destination).toBe('SAMPLE CITY');
    expect(data.rooms).toBe(3);
    expect(data.single).toBe(1);
  });
  it('paginates long passenger names without losing or repeating passengers', () => {
    const people = Array.from({ length: 23 }, (_, i) => ({
      id: String(i),
      name: i === 0 ? 'X'.repeat(190) : `SYNTHETIC ${i}`,
      sex: '-',
      age: 'ADL',
    }));
    const pages = reservationPassengerPages(people);
    expect(pages.length).toBeGreaterThan(2);
    expect(pages.flat()).toEqual(people);
    expect(reservationPassengerPages([])).toEqual([[]]);
  });
});
