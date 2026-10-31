import { reservationPdfHtml } from '../server/reservation-pdf-html';
import { expect, it } from 'vitest';
import {
  defaultVoucherSettings,
  supplierFormData,
  voucherFormData,
} from './voucher-settings';
import type { ReservationFormIntake } from './reservation-form';

it('defaults missing form sex to Male while preserving known and saved Female values', () => {
  const intake = {
    snapshot: {
      contractNumber: 'SYNTHETIC',
      passengerIds: ['a', 'b'],
      passengerAssignments: [],
      serviceSelections: [],
    },
    workflow: { roomOrder: [], ageOverrides: {}, note: '' },
    outputPassengers: [
      {
        customerId: 'b',
        gender: 'F',
        passportName: 'TEST / B',
        hotelChildAgeBand: null,
      },
    ],
  } as unknown as ReservationFormIntake;
  const defaults = defaultVoucherSettings(intake, {});
  expect(defaults.passengers.map((p) => p.sex)).toEqual(['MALE', 'FEMALE']);
  intake.workflow.voucherSettings = {
    ...defaults,
    passengers: defaults.passengers.map((p) => ({ ...p, sex: 'FEMALE' })),
  };
  expect(
    defaultVoucherSettings(intake, {}).passengers.map((p) => p.sex),
  ).toEqual(['FEMALE', 'FEMALE']);
  expect(intake.outputPassengers).toHaveLength(1);
});

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
    arrivalDate: '2026-10-01',
    departureDate: '2026-10-04',
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
    hotelChildAgeBand: 'CHD_2_TO_6',
    sex: 'FEMALE',
  };
  settings.passengers[1] = {
    id: 'b',
    selected: false,
    age: 'ADL',
    roomType: 'SGL',
  };
  settings.flags.tourLeader = false;
  settings.transferBrokerId = 'transfer-broker';
  settings.transferBrokerName = 'TRANSFER SUPPLIER';
  settings.transferDetailsOverride = true;
  intake.workflow.voucherSettings = settings;
  expect(defaultVoucherSettings(intake, {})).toMatchObject({
    transferBrokerId: 'transfer-broker',
    transferBrokerName: 'TRANSFER SUPPLIER',
    transferDetailsOverride: true,
  });
  const output = voucherFormData(intake, {});
  expect(output.hotel).toBe('SAVED HOTEL');
  expect(output.meal).toBe('UALL');
  expect(output.rooms).toBe(3);
  expect(output.nights).toBe(3);
  expect(output.checkIn).toBe('01 OCT 2026');
  expect(output.checkOut).toBe('04 OCT 2026');
  expect(output.flights.map((f) => f.date)).toEqual([
    '01 OCT 2026',
    '04 OCT 2026',
  ]);
  expect(settings.text.checkIn).toBe('2026-10-01');
  expect(output.children).toBe(1);
  expect(output.passengers[0]?.age).toBe('CHD (2-6)');
  settings.text.broker = 'Agency receiving the form';
  intake.workflow.supplierFormSettings = settings;
  expect(supplierFormData(intake, {}).passengers[0]?.age).toBe('CHD (2-6)');
  expect(supplierFormData(intake, {}).supplier).toBe(
    'Agency receiving the form',
  );
  expect(voucherFormData(intake, {}).supplier).toBe('0');
  expect(supplierFormData(intake, {}).leader).toBe('Persian');
  settings.text.leaderLanguage = 'Arabic';
  expect(supplierFormData(intake, {}).leader).toBe('Arabic');
  const passenger = output.passengers[0];
  expect(
    passenger && 'hotelChildAgeBand' in passenger
      ? passenger.hotelChildAgeBand
      : undefined,
  ).toBe('CHD_2_TO_6');
  expect(output.adults).toBe(0);
  expect(output.passengers.map((p) => p.id)).toEqual(['a']);
  expect(output.leader).toBe('-');
  expect(intake.snapshot.hotelSelection?.hotelNameSnapshot).toBe('OLD HOTEL');
  delete (settings.text as unknown as Record<string, string>).contractPartyName;
  const copy = defaultVoucherSettings(intake, {});
  expect(copy.text.contractPartyName).toBe('');
  copy.text.hotel = 'NEXT VERSION';
  expect(settings.text.hotel).toBe('SAVED HOTEL');
});

it('prints English carrier and supplier plus the explicit NOTICE remarks', () => {
  const intake = {
    receivedAt: '2026-10-14',
    snapshot: {
      contractNumber: 'TEST',
      passengerIds: [],
      passengerAssignments: [],
      serviceSelections: [],
      hotelSelection: null,
    },
    workflow: { roomOrder: [], ageOverrides: {}, note: '' },
  } as unknown as ReservationFormIntake;
  const settings = defaultVoucherSettings(intake, {});
  settings.text.arrivalAirline = 'ایرلاین';
  settings.text.broker = 'کارگزار';
  settings.text.remarks = 'NOTICE TEST';
  intake.workflow.supplierFormSettings = settings;
  const refs = {
    airline: {
      id: 'a',
      name: 'ایرلاین',
      attributes: { englishName: 'AIRLINE' },
    },
    broker: { id: 'b', name: 'کارگزار', attributes: { englishName: 'BROKER' } },
  } as never;
  const data = supplierFormData(intake, refs);
  expect(data.supplier).toBe('BROKER');
  expect(data.flights[0]?.airline).toBe('AIRLINE');
  expect(data.notes).toBe('NOTICE TEST');
});

it('keeps supplier-only hotel, passenger and NOTICE changes independent of contract and issued voucher', () => {
  const intake = {
    receivedAt: '2026-10-01T00:00:00Z',
    snapshot: {
      contractNumber: 'TEST',
      passengerIds: ['guest'],
      passengerAssignments: [
        {
          customerId: 'guest',
          displayNameSnapshot: 'Synthetic Guest',
          ageCategory: 'ADT',
        },
      ],
      serviceSelections: [],
      hotelSelection: {
        hotelNameSnapshot: 'CONTRACT HOTEL',
        roomCount: 1,
        checkInDate: '2026-10-01',
        checkOutDate: '2026-10-04',
      },
    },
    workflow: {
      roomOrder: [],
      ageOverrides: {},
      note: 'VOUCHER NOTICE',
      voucherIssued: true,
    },
  } as unknown as ReservationFormIntake;
  const before = structuredClone(intake.snapshot);
  const voucherBefore = voucherFormData(intake, {});
  const form = defaultVoucherSettings(intake, {});
  Object.assign(form.text, {
    hotel: 'FORM HOTEL',
    checkIn: '2026-10-10',
    checkOut: '2026-10-20',
    remarks: 'FORM NOTICE',
  });
  form.passengers[0]!.age = 'CHD';
  form.passengers[0]!.hotelChildAgeBand = 'CHD_2_TO_6';
  intake.workflow.supplierFormSettings = form;
  const output = supplierFormData(intake, {});
  expect(output).toMatchObject({
    hotel: 'FORM HOTEL',
    checkIn: '10 OCT 2026',
    checkOut: '20 OCT 2026',
    notes: 'FORM NOTICE',
    adults: 0,
    children: 1,
  });
  expect(voucherFormData(intake, {})).toEqual(voucherBefore);
  expect(defaultVoucherSettings(intake, {}).text.hotel).toBe('CONTRACT HOTEL');
  expect(intake.snapshot).toEqual(before);
  expect(intake.workflow.note).toBe('VOUCHER NOTICE');
});
it('keeps room composition in the saved supplier revision and output without changing the contract', () => {
  const intake = {
    receivedAt: '2026-10-01T00:00:00Z',
    snapshot: {
      contractNumber: 'SYNTHETIC',
      passengerIds: ['p'],
      passengerAssignments: [],
      serviceSelections: [],
      hotelSelection: { hotelNameSnapshot: 'Hotel', roomCount: 1 },
    },
    workflow: { roomOrder: [], ageOverrides: {}, note: '' },
  } as unknown as ReservationFormIntake;
  const settings = defaultVoucherSettings(intake, {});
  settings.rooms = [
    {
      ordinal: 1,
      roomTypeNameSnapshot: 'Family Suite',
      adults: 2,
      childAges: [4, 10],
    },
  ];
  intake.workflow.supplierFormSettings = settings;
  const output = supplierFormData(intake, {});
  expect(output.rooms).toBe(1);
  expect(output.roomBreakdown).toEqual([
    { ordinal: 1, roomType: 'Family Suite', adults: 2, childAges: [4, 10] },
  ]);
  expect(intake.snapshot.hotelSelection?.roomCount).toBe(1);
});

it('keeps passenger services and room allocation in the supplier revision only', () => {
  const intake = {
    receivedAt: '2026-10-01T00:00:00Z',
    snapshot: {
      passengerIds: ['p'],
      passengerAssignments: [],
      serviceSelections: [],
      hotelSelection: { hotelNameSnapshot: 'Hotel', roomCount: 1 },
    },
    workflow: { roomOrder: [], ageOverrides: {}, note: '' },
  } as unknown as ReservationFormIntake;
  const before = JSON.stringify(intake.snapshot);
  const settings = defaultVoucherSettings(intake, {});
  settings.text.checkIn = '2026-11-01';
  settings.text.checkOut = '2026-11-04';
  settings.rooms = [
    { ordinal: 1, roomTypeNameSnapshot: 'Double', adults: 2, childAges: [] },
  ];
  settings.passengers[0]!.roomOrdinal = 1;
  settings.passengers[0]!.services = {
    outboundFlight: true,
    returnFlight: false,
    outboundTransfer: false,
    returnTransfer: true,
    hotel: true,
  };
  intake.workflow.supplierFormSettings = settings;
  const result = supplierFormData(intake, {});
  expect(result.passengers[0]).toMatchObject({
    outboundFlight: true,
    returnFlight: false,
    outboundTransfer: false,
    returnTransfer: true,
    checkIn: '01 NOV 2026',
  });
  expect(result.passengers[0]!.name).toBe(
    voucherFormData(intake, {}).passengers[0]!.name,
  );
  expect(result.roomBreakdown).toEqual([
    { ordinal: 1, roomType: 'Double', adults: 2, childAges: [] },
  ]);
  expect(
    reservationPdfHtml(intake, {}, 'data:image/png;base64,AAAA', '', false),
  ).not.toContain('ROOM 1 - Double');
  expect(JSON.stringify(intake.snapshot)).toBe(before);
  expect(voucherFormData(intake, {}).passengers[0]!.outboundFlight).toBe(false);
});
