import { expect, it } from 'vitest';
import type { VoucherSettingsV1 } from '@nora/contracts';
import { contractRoomDefaults } from './contract-room-defaults';
it('fills canonical room types and child bands using room capacity, preserving saved choices and source data', () => {
  const source = {
    rooms: [
      { ordinal: 1, roomTypeNameSnapshot: 'FAMILY', adults: 2, childAges: [4] },
      { ordinal: 2, roomTypeNameSnapshot: 'SINGLE', adults: 1, childAges: [] },
    ],
    passengers: [
      {
        id: 'saved',
        selected: true,
        age: 'ADL',
        roomOrdinal: 2,
        roomType: 'CUSTOM',
        services: { hotel: true },
      },
      {
        id: 'a',
        selected: true,
        age: 'ADL',
        roomType: 'OLD',
        services: { hotel: true },
      },
      {
        id: 'b',
        selected: true,
        age: 'ADL',
        roomType: '',
        services: { hotel: true },
      },
      {
        id: 'c',
        selected: true,
        age: 'CHD',
        roomType: '',
        hotelChildAgeBand: '',
        services: { hotel: true },
      },
      {
        id: 'flight',
        selected: true,
        age: 'ADL',
        roomType: '',
        services: { hotel: false },
      },
    ],
  } as unknown as VoucherSettingsV1;
  const before = structuredClone(source),
    result = contractRoomDefaults(source);
  expect(result.passengers.map((p) => p.roomOrdinal)).toEqual([
    2,
    1,
    1,
    1,
    undefined,
  ]);
  expect(result.passengers[0]!.roomType).toBe('CUSTOM');
  expect(result.passengers[1]!.roomType).toBe('FAMILY');
  expect(result.passengers[3]!.hotelChildAgeBand).toBe('CHD_2_TO_6');
  expect(source).toEqual(before);
});
