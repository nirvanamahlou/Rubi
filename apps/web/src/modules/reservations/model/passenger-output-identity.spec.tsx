import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  reservationFormData,
  type ReservationFormIntake,
} from './reservation-form';
import { defaultVoucherSettings, supplierFormData } from './voucher-settings';
import { ReservationFormSheet } from '../components/reservation-form-sheet';
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
