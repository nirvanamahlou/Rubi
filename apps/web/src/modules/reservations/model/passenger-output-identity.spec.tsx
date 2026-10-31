import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  reservationFormData,
  type ReservationFormIntake,
} from './reservation-form';
import {
  defaultVoucherSettings,
  supplierFormData,
  voucherFormData,
} from './voucher-settings';
import { ReservationFormSheet } from '../components/reservation-form-sheet';
import { VoucherFormSheet } from '../components/voucher-form-sheet';
import { reservationPdfHtml } from '../server/reservation-pdf-html';
function fixture() {
  return {
    id: 'qa',
    receivedAt: '2026-10-18',
    snapshot: {
      contractNumber: 'QA',
      passengerIds: ['a', 'b'],
      serviceSelections: [],
      hotelSelection: null,
      passengerAssignments: [
        {
          customerId: 'a',
          displayNameSnapshot: 'OLD TITLE',
          ageCategory: 'CHD',
        },
        {
          customerId: 'b',
          displayNameSnapshot: 'OLD TITLE',
          ageCategory: 'CHD',
        },
      ],
    },
    workflow: { roomOrder: ['b', 'a'], ageOverrides: {}, note: '' },
    outputPassengers: [
      {
        customerId: 'a',
        passportName: 'FIRST / CHILD',
        hotelChildAgeBand: 'CHD_2_TO_6',
      },
      {
        customerId: 'b',
        passportName: 'SECOND / CHILD',
        hotelChildAgeBand: 'CHD_6_TO_12',
      },
    ],
  } as unknown as ReservationFormIntake;
}
it('uses each passport name and age band in both summary and passenger rows without mixing identities', () => {
  const intake = fixture();
  const before = structuredClone(intake);
  const data = reservationFormData(intake);
  expect(data.passengers.map((p) => [p.id, p.name, p.age])).toEqual([
    ['b', 'SECOND / CHILD', 'CHD (6-12)'],
    ['a', 'FIRST / CHILD', 'CHD (2-6)'],
  ]);
  expect(data).toMatchObject({
    children: 2,
    children2To6: 1,
    children6To12: 1,
    childrenUnclassified: 0,
  });
  expect(intake).toEqual(before);
  const settings = defaultVoucherSettings(intake, {});
  settings.passengers.forEach((p) => {
    p.hotelChildAgeBand = '';
  });
  settings.flags.withLetterhead = false;
  intake.workflow.supplierFormSettings = settings;
  expect(supplierFormData(intake)).toMatchObject({
    children2To6: 1,
    children6To12: 1,
    childrenUnclassified: 0,
  });
  for (const html of [
    renderToStaticMarkup(<ReservationFormSheet intake={intake} logo="" />),
    reservationPdfHtml(intake, {}, '', ''),
  ]) {
    expect(html).toContain('FIRST / CHILD');
    expect(html).toContain('SECOND / CHILD');
    expect(html.replace(/[()]/g, '')).toContain('CHD 2-6');
    expect(html.replace(/[()]/g, '')).toContain('CHD 6-12');
    expect(html).not.toContain('OLD TITLE');
  }
});
it('retains legacy snapshot names and saved child bands when the optional new projection is absent', () => {
  const intake = fixture();
  delete intake.outputPassengers;
  intake.snapshot.passengerAssignments![0]!.childAgeBand = 'AGE_2_6';
  expect(
    reservationFormData(intake).passengers.find((p) => p.id === 'a'),
  ).toMatchObject({ name: 'OLD TITLE', age: 'CHD (2-6)' });
});

it('keeps names separate from room allocation and prints registered genders in both previews and PDFs', () => {
  const intake = fixture();
  intake.outputPassengers = intake.outputPassengers!.map((person) => ({
    ...person,
    gender: person.customerId === 'a' ? 'M' : 'F',
  }));
  const settings = defaultVoucherSettings(intake, {});
  settings.flags.withLetterhead = false;
  settings.flags.hotel = true;
  settings.text.hotel = 'SYNTHETIC HOTEL';
  settings.text.checkIn = '2026-11-01';
  settings.text.checkOut = '2026-11-04';
  settings.rooms = [
    {
      ordinal: 1,
      roomTypeNameSnapshot: 'SYNTHETIC DOUBLE',
      adults: 2,
      childAges: [],
    },
  ];
  settings.passengers.forEach((person) => {
    person.roomOrdinal = 1;
    person.sex = '';
    person.services = {
      outboundFlight: false,
      returnFlight: false,
      outboundTransfer: false,
      returnTransfer: false,
      hotel: true,
    };
  });
  intake.workflow.supplierFormSettings = structuredClone(settings);
  intake.workflow.voucherSettings = structuredClone(settings);
  const before = structuredClone(intake);
  for (const model of [supplierFormData(intake), voucherFormData(intake, {})]) {
    expect(model.passengers.map((person) => [person.name, person.sex])).toEqual(
      [
        ['SECOND / CHILD', 'Female'],
        ['FIRST / CHILD', 'Male'],
      ],
    );
    expect(model.roomBreakdown[0]?.roomType).toBe('SYNTHETIC DOUBLE');
  }
  for (const html of [
    renderToStaticMarkup(<ReservationFormSheet intake={intake} logo="" />),
    renderToStaticMarkup(<VoucherFormSheet intake={intake} logo="" voucher />),
    reservationPdfHtml(intake, {}, '', '', false),
    reservationPdfHtml(intake, {}, '', '', true),
  ]) {
    expect(html).toContain('FIRST / CHILD</td>');
    expect(html).toContain('SECOND / CHILD</td>');
    expect(html).toContain('>Male</td>');
    expect(html).toContain('>Female</td>');
    expect(html).toContain('SYNTHETIC DOUBLE');
    expect(html).not.toContain('/ ROOM');
  }
  expect(intake).toEqual(before);
});

it.each(['voucherSettings', 'sentSupplierFormSettings'] as const)(
  'fills legacy blank gender in %s defaults from registered identity while retaining explicit overrides',
  (source) => {
    const intake = fixture();
    const saved = defaultVoucherSettings(intake, {});
    intake.workflow[source] = saved;
    intake.outputPassengers = intake.outputPassengers!.map((person) => ({
      ...person,
      gender: person.customerId === 'a' ? 'M' : null,
    }));
    const before = structuredClone(intake);
    const defaults = defaultVoucherSettings(intake, {});
    expect(defaults.passengers.find((p) => p.id === 'a')?.sex).toBe('MALE');
    expect(defaults.passengers.find((p) => p.id === 'b')?.sex).toBe('MALE');
    expect(intake).toEqual(before);
    saved.passengers.find((p) => p.id === 'a')!.sex = 'FEMALE';
    expect(
      defaultVoucherSettings(intake, {}).passengers.find((p) => p.id === 'a')
        ?.sex,
    ).toBe('FEMALE');
  },
);
