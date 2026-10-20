import { expect, it } from 'vitest';
import { validateVoucherSettings } from '../../../../../api/src/reservations/voucher-settings';
import { defaultVoucherSettings, voucherFormData } from './voucher-settings';
import type { ReservationFormIntake } from './reservation-form';

function fixture() {
  const intake = {
    receivedAt: '2026-10-01T00:00:00Z',
    snapshot: {
      contractNumber: 'SYNTHETIC',
      passengerIds: ['adult', 'child', 'excluded-child'],
      passengerAssignments: [
        { customerId: 'adult', ageCategory: 'ADT' },
        { customerId: 'child', ageCategory: 'CHD' },
        { customerId: 'excluded-child', ageCategory: 'CHD' },
      ],
      serviceSelections: [],
    },
    workflow: { roomOrder: [], ageOverrides: {}, note: '' },
  } as unknown as ReservationFormIntake;
  const sent = defaultVoucherSettings(intake, {});
  sent.passengers[1]!.hotelChildAgeBand = 'CHD_6_TO_12';
  sent.passengers[2]!.selected = false;
  sent.text.hotel = 'SENT HOTEL';
  sent.text.checkIn = '2026-11-01';
  sent.text.checkOut = '2026-11-04';
  sent.rooms = [
    { ordinal: 1, roomTypeNameSnapshot: 'DBL', adults: 1, childAges: [8] },
  ];
  intake.workflow.sentSupplierFormSettings = sent;
  return { intake, sent };
}

it('saves a first voucher with the sent passenger selections and child band accepted by the API', () => {
  const { intake, sent } = fixture();
  const before = JSON.stringify(sent);
  const draft = defaultVoucherSettings(intake, {});
  draft.brokerId = '00000000-0000-4000-8000-000000000001';
  draft.leaderId = '00000000-0000-4000-8000-000000000002';
  draft.text.leaderName = 'SYNTHETIC GUIDE';
  const accepted = validateVoucherSettings(draft, intake.snapshot.passengerIds);
  expect(accepted.passengers[1]?.hotelChildAgeBand).toBe('CHD_6_TO_12');
  expect(accepted.passengers[2]?.selected).toBe(false);
  expect(accepted.text.hotel).toBe('SENT HOTEL');
  expect(accepted.rooms).toEqual(sent.rooms);
  intake.workflow.voucherSettings = accepted;
  expect(voucherFormData(intake, {}).passengers.map((p) => p.id)).toEqual([
    'adult',
    'child',
  ]);
  draft.rooms![0]!.childAges.push(9);
  draft.text.hotel = 'EDITED';
  expect(JSON.stringify(sent)).toBe(before);
});

it('keeps saved voucher priority and ignores an unsent supplier draft', () => {
  const { intake, sent } = fixture();
  intake.workflow.supplierFormSettings = {
    ...sent,
    text: { ...sent.text, hotel: 'UNSENT' },
  };
  expect(defaultVoucherSettings(intake, {}).text.hotel).toBe('SENT HOTEL');
  intake.workflow.voucherSettings = {
    ...sent,
    text: { ...sent.text, hotel: 'VOUCHER' },
  };
  expect(defaultVoucherSettings(intake, {}).text.hotel).toBe('VOUCHER');
});

it('reconciles current passenger IDs and still rejects a selected child without a band', () => {
  const { intake, sent } = fixture();
  sent.passengers.push({
    id: 'removed',
    selected: true,
    age: 'ADL',
    roomType: '',
  });
  const draft = defaultVoucherSettings(intake, {});
  expect(draft.passengers.map((p) => p.id)).toEqual(
    intake.snapshot.passengerIds,
  );
  draft.passengers[1]!.hotelChildAgeBand = '';
  expect(() =>
    validateVoucherSettings(draft, intake.snapshot.passengerIds),
  ).toThrow();
});
