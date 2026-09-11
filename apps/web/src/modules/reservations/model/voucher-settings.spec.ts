import { expect, it } from 'vitest';
import { defaultVoucherSettings, voucherFormData } from './voucher-settings';
import type { ReservationFormIntake } from './reservation-form';

it('uses saved voucher settings, selected passengers and service flags without rewriting the source', () => {
  const intake = {
    receivedAt: '2026-09-10T00:00:00Z',
    snapshot: {
      contractNumber: 'SYNTHETIC',
      passengerIds: ['a', 'b'],
      passengerAssignments: [],
      serviceSelections: [],
      hotelSelection: { hotelNameSnapshot: 'OLD HOTEL', roomCount: 2 },
    },
    workflow: { roomOrder: [], ageOverrides: {}, note: '' },
  } as unknown as ReservationFormIntake;
  const settings = defaultVoucherSettings(intake, {});
  Object.assign(settings.text, {
    hotel: 'SAVED HOTEL',
    meal: 'UALL',
    checkIn: '2026-10-01',
    checkOut: '2026-10-04',
    leaderName: 'HIDDEN GUIDE',
  });
  settings.numbers = {
    singleRooms: 1,
    doubleRooms: 2,
    customRooms: 0,
    extraBeds: 1,
  };
  settings.passengers[0] = {
    id: 'a',
    selected: true,
    age: 'CHD',
    roomType: 'DBL',
    sex: 'FEMALE',
  };
  settings.passengers[1] = {
    id: 'b',
    selected: false,
    age: 'ADL',
    roomType: 'SGL',
  };
  settings.flags.tourLeader = false;
  intake.workflow.voucherSettings = settings;
  const output = voucherFormData(intake, {});
  expect(output.hotel).toBe('SAVED HOTEL');
  expect(output.meal).toBe('UALL');
  expect(output.rooms).toBe(3);
  expect(output.nights).toBe(3);
  expect(output.children).toBe(1);
  expect(output.adults).toBe(0);
  expect(output.passengers.map((p) => p.id)).toEqual(['a']);
  expect(output.leader).toBe('-');
  expect(intake.snapshot.hotelSelection?.hotelNameSnapshot).toBe('OLD HOTEL');
  const copy = defaultVoucherSettings(intake, {});
  copy.text.hotel = 'NEXT VERSION';
  expect(settings.text.hotel).toBe('SAVED HOTEL');
});
