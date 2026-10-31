import {
  defaultVoucherSettings,
  supplierFormData,
  voucherFormData,
} from './voucher-settings';
import { reservationPdfHtml } from '../server/reservation-pdf-html';
import { describe, expect, it } from 'vitest';
import {
  reservationFormData,
  isAggregateReservationForm,
  reservationRoomAppendices,
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
it('prepares and renders historical supplier forms with a buyer and aggregate guests, without fake passengers', () => {
  const intake = structuredClone(input);
  intake.contractPartyName = 'SYNTHETIC & BUYER';
  intake.snapshot.passengerIds = [];
  intake.snapshot.passengerAssignments = [];
  intake.snapshot.serviceSelections = [
    {
      clientKey: 'hotel',
      kind: 'HOTEL',
      metadata: {
        legacyServicePartiesV2: JSON.stringify({
          hotel: { adults: 2, children: 1, infants: 0 },
        }),
      },
    },
  ] as never;
  intake.snapshot.hotelSelection!.serviceClientKey = 'hotel';
  expect(isAggregateReservationForm(intake)).toBe(true);
  const settings = defaultVoucherSettings(intake, {});
  expect(settings.passengers).toEqual([]);
  expect(settings.text.contractPartyName).toBe('SYNTHETIC & BUYER');
  intake.workflow.supplierFormSettings = settings;
  const data = supplierFormData(intake, {});
  expect(data.adults).toBe(2);
  expect(data.childrenUnclassified).toBe(1);
  expect(data.passengers).toEqual([]);
  const html = reservationPdfHtml(
    intake,
    {},
    'data:image/png;base64,AAAA',
    '',
    false,
    'https://example.invalid',
  );
  expect(html).toContain('SYNTHETIC &amp; BUYER');
  expect(html).toContain('CONTRACT PARTY');
  intake.snapshot.serviceSelections = [
    {
      clientKey: 'legacy',
      kind: 'OTHER',
      metadata: { legacyContractV1: true },
    },
  ] as never;
  expect(isAggregateReservationForm(intake)).toBe(true);
  intake.snapshot.serviceSelections = [];
  expect(isAggregateReservationForm(intake)).toBe(false);
  expect(isAggregateReservationForm(input)).toBe(false);
});
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

it('shows transfer direction and excludes infants from the automatic quantity', () => {
  const data = structuredClone(input);
  data.snapshot.serviceSelections = [
    { clientKey: 't', kind: 'TRANSFER', metadata: { direction: 'OUTBOUND' } },
  ] as never;
  data.snapshot.passengerAssignments = data.snapshot.passengerAssignments!.map(
    (p) => ({ ...p, serviceClientKeys: ['t'] }),
  );
  expect(
    reservationFormData(data as unknown as ReservationFormIntake).transfer,
  ).toBe('OUTBOUND ONLY · 2 PAX');
  data.snapshot.serviceSelections = [
    {
      clientKey: 't',
      kind: 'TRANSFER',
      metadata: { direction: 'RETURN', passengerCount: 1 },
    },
  ] as never;
  expect(
    reservationFormData(data as unknown as ReservationFormIntake).transfer,
  ).toBe('RETURN ONLY · 1 PAX');
});

it('projects independent room types and child ages for reservation and voucher outputs', () => {
  const next = {
    ...input,
    snapshot: {
      ...input.snapshot,
      hotelSelection: {
        ...input.snapshot.hotelSelection!,
        rooms: [
          {
            ordinal: 1,
            roomTypeId: 'r',
            roomTypeNameSnapshot: 'Double',
            adults: 2,
            childAges: [5],
          },
          {
            ordinal: 2,
            roomTypeId: 's',
            roomTypeNameSnapshot: 'Single',
            adults: 1,
            childAges: [],
          },
        ],
      },
    },
  };
  expect(reservationFormData(next).roomBreakdown).toEqual([
    { ordinal: 1, roomType: 'Double', adults: 2, childAges: [5] },
    { ordinal: 2, roomType: 'Single', adults: 1, childAges: [] },
  ]);
});

it('keeps large room lists on bounded appendix pages without losing or repeating room rows', () => {
  const rooms = Array.from({ length: 50 }, (_, i) => ({
    ordinal: i + 1,
    roomType: 'Room ' + i,
    adults: 1,
    childAges: [],
  }));
  const pages = reservationRoomAppendices(rooms);
  expect(pages.every((p) => p.length <= 12)).toBe(true);
  expect([...rooms.slice(0, 4), ...pages.flat()]).toEqual(rooms);
  expect(reservationRoomAppendices(rooms.slice(0, 4))).toEqual([]);
});

it('preserves individual hotel dates and no stay for a flight-only passenger', () => {
  const intake = {
    ...input,
    snapshot: {
      ...input.snapshot,
      serviceSelections: [
        {
          clientKey: 'hotel',
          kind: 'HOTEL',
          metadata: {
            passengerHotelStaysV1: JSON.stringify({
              a: {
                different: true,
                checkInDate: '2026-10-02',
                checkOutDate: '2026-10-05',
              },
            }),
          },
        },
      ],
    },
  } as unknown as ReservationFormIntake;
  const result = reservationFormData(intake);
  expect(result.passengers.find((p) => p.id === 'a')?.checkIn).toBe(
    '02 OCT 2026',
  );
  expect(result.passengers.find((p) => p.id === 'b')?.checkIn).toBe('-');
});

it('carries registered genders to both supplier and voucher PDF output with legacy blank fallback', () => {
  const value = structuredClone(input);
  value.outputPassengers = [
    {
      customerId: 'a',
      passportName: 'EXAMPLE / A',
      hotelChildAgeBand: null,
      gender: 'M',
    },
    {
      customerId: 'b',
      passportName: 'EXAMPLE / B',
      hotelChildAgeBand: null,
      gender: 'F',
    },
  ];
  const settings = defaultVoucherSettings(value, {});
  settings.flags.withLetterhead = false;
  // Historical settings contain a blank sex; the authoritative identity supplies it.
  settings.passengers.forEach((p) => {
    p.sex = '';
  });
  value.workflow.supplierFormSettings = structuredClone(settings);
  value.workflow.voucherSettings = structuredClone(settings);
  for (const model of [supplierFormData(value), voucherFormData(value, {})]) {
    expect(model.passengers.find((p) => p.id === 'a')?.sex).toBe('Male');
    expect(model.passengers.find((p) => p.id === 'b')?.sex).toBe('Female');
  }
  for (const voucher of [false, true]) {
    const html = reservationPdfHtml(value, {}, '', '', voucher);
    expect(html).toContain('>Male</td>');
    expect(html).toContain('>Female</td>');
  }
  const missing = structuredClone(value);
  delete missing.outputPassengers;
  expect(supplierFormData(missing).passengers.every((p) => p.sex === '-')).toBe(
    true,
  );
  expect(
    voucherFormData(missing, {}).passengers.every((p) => p.sex === '-'),
  ).toBe(true);
  value.workflow.voucherSettings.passengers.find((p) => p.id === 'b')!.sex =
    'MALE';
  expect(
    voucherFormData(value, {}).passengers.find((p) => p.id === 'b')?.sex,
  ).toBe('Male');
  expect(reservationPdfHtml(value, {}, '', '', true)).not.toContain(
    '>Female</td>',
  );
});

it('uses the registered English primary hotel name when no separate English alias exists', () => {
  const before = JSON.stringify(input);
  expect(
    reservationFormData(input, {
      h: { name: 'REGISTERED HOTEL', attributes: {} } as never,
    }).hotel,
  ).toBe('REGISTERED HOTEL');
  expect(JSON.stringify(input)).toBe(before);
});

it('omits generic OTHER while retaining actual named and typed passenger services', () => {
  const value = structuredClone(input);
  value.snapshot.serviceSelections = [
    { clientKey: 'generic', kind: 'OTHER', titleSnapshot: 'OTHER' },
    { clientKey: 'named', kind: 'OTHER', titleSnapshot: 'CITY TOUR' },
    { clientKey: 'visa', kind: 'VISA', titleSnapshot: 'Visa' },
  ];
  value.snapshot.passengerAssignments =
    value.snapshot.passengerAssignments!.map((p) => ({
      ...p,
      serviceClientKeys: ['generic', 'named', 'visa'],
    }));
  expect(reservationFormData(value).passengers[0]?.otherServices).toBe(
    'CITY TOUR / VISA',
  );
  value.snapshot.serviceSelections = [value.snapshot.serviceSelections[0]!];
  expect(reservationFormData(value).passengers[0]?.otherServices).toBe('-');
});

it('prints a manually completed missing gender only in the saved supplier form', () => {
  const value = structuredClone(input);
  value.workflow.supplierFormSettings = defaultVoucherSettings(value, {});
  value.workflow.supplierFormSettings.flags.withLetterhead = false;
  value.workflow.supplierFormSettings.passengers.find(
    (p) => p.id === 'a',
  )!.sex = 'FEMALE';
  expect(
    supplierFormData(value).passengers.find((p) => p.id === 'a')?.sex,
  ).toBe('Female');
  expect(reservationPdfHtml(value, {}, '', '')).toContain('>Female</td>');
  expect(
    voucherFormData(value, {}).passengers.find((p) => p.id === 'a')?.sex,
  ).toBe('-');
  expect(value.outputPassengers).toBeUndefined();
});

it('uses historical hotel age counts without adding fabricated people to the supplier form', () => {
  const intake = structuredClone(input);
  intake.snapshot.passengerIds = [];
  intake.snapshot.passengerAssignments = [];
  intake.snapshot.hotelSelection = {
    ...intake.snapshot.hotelSelection!,
    serviceClientKey: 'hotel',
  };
  intake.snapshot.serviceSelections = [
    {
      clientKey: 'hotel',
      kind: 'HOTEL',
      titleSnapshot: 'Hotel',
      metadata: {
        legacyServicePartiesV2: JSON.stringify({
          hotel: { adults: 2, children: 1, infants: 1 },
        }),
      },
    },
  ];
  const form = reservationFormData(intake);
  expect(form).toMatchObject({ adults: 2, children: 1, infants: 1 });
  expect(form.passengers).toEqual([]);
});

it('prints saved flight details when only one of two passengers has transfer', () => {
  const intake = structuredClone(input);
  intake.snapshot.serviceSelections = [
    {
      clientKey: 'transfer-out',
      kind: 'TRANSFER',
      metadata: { direction: 'OUTBOUND', passengerCount: 1 },
    },
  ] as typeof intake.snapshot.serviceSelections;
  intake.snapshot.passengerAssignments![0]!.serviceClientKeys = [
    'transfer-out',
  ];
  intake.snapshot.passengerAssignments![1]!.serviceClientKeys = [];
  const settings = defaultVoucherSettings(intake, {});
  Object.assign(settings.text, {
    arrivalAirline: 'TEST AIR',
    arrivalFlight: 'TEST123',
    arrivalDate: '2026-10-01',
    arrivalTime: '14:30',
  });
  intake.workflow.supplierFormSettings = settings;
  const html = reservationPdfHtml(intake, {}, 'data:image/png;base64,AA==', '');
  expect(html).toContain('FLIGHT INFORMATION');
  for (const value of ['TEST AIR', 'TEST123', '14:30'])
    expect(html).toContain(value);
  expect(html).toContain('01 OCT 2026');
  intake.snapshot.serviceSelections = [];
  expect(
    reservationPdfHtml(intake, {}, 'data:image/png;base64,AA==', ''),
  ).not.toContain('FLIGHT INFORMATION');
});
