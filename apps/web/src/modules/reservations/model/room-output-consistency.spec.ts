import { expect, it } from 'vitest';
import {
  reservationFormData,
  type ReservationFormIntake,
} from './reservation-form';
import {
  defaultVoucherSettings,
  supplierFormData,
  voucherFormData,
} from './voucher-settings';
import { reservationPdfHtml } from '../server/reservation-pdf-html';
import {
  contractPrintHtml,
  contractRoomSummary,
} from '../../sales/model/contract-print';
import {
  printFixture,
  printReferences,
} from '../../sales/model/contract-print.fixture';
it('keeps mixed room occupancies consistent in reservation, voucher and customer contract despite stale settings', () => {
  const rooms = [
    {
      ordinal: 1,
      roomTypeId: 'a',
      roomTypeNameSnapshot: 'Land Single',
      adults: 1,
      childAges: [],
    },
    {
      ordinal: 2,
      roomTypeId: 'b',
      roomTypeNameSnapshot: 'Sea Double',
      adults: 1,
      childAges: [7],
    },
    {
      ordinal: 3,
      roomTypeId: 'c',
      roomTypeNameSnapshot: 'Family',
      adults: 3,
      childAges: [4],
    },
  ];
  const output = structuredClone(printFixture);
  output.contract.hotelSelection = {
    ...output.contract.hotelSelection!,
    roomCount: 8,
    singleRoomCount: 8,
    doubleRoomCount: 0,
    extraBedCount: 0,
    rooms,
  };
  const intake = {
    id: 'synthetic',
    receivedAt: '2026-10-01T00:00:00Z',
    snapshot: {
      contractNumber: 'SYNTHETIC',
      passengerIds: [],
      passengerAssignments: [],
      serviceSelections: [],
      hotelSelection: output.contract.hotelSelection,
    },
    workflow: { roomOrder: [], ageOverrides: {}, note: '' },
    arrangement: {
      roomCount: 9,
      singleRoomCount: 9,
      doubleRoomCount: 0,
      extraBedCount: 0,
    },
  } as unknown as ReservationFormIntake;
  const settings = defaultVoucherSettings(intake, {});
  settings.numbers = {
    singleRooms: 9,
    doubleRooms: 0,
    customRooms: 0,
    extraBeds: 0,
  };
  intake.workflow.voucherSettings = settings;
  intake.workflow.supplierFormSettings = settings;
  const original = structuredClone(intake);
  for (const data of [
    reservationFormData(intake),
    supplierFormData(intake),
    voucherFormData(intake, {}),
  ]) {
    expect(data).toMatchObject({ rooms: 3, single: 1, double: 2, extra: 2 });
    expect(
      data.roomBreakdown.map((r) => ({
        type: r.roomType,
        guests: r.adults + r.childAges.length,
      })),
    ).toEqual([
      { type: 'Land Single', guests: 1 },
      { type: 'Sea Double', guests: 2 },
      { type: 'Family', guests: 4 },
    ]);
  }
  for (const voucher of [false, true]) {
    const html = reservationPdfHtml(
      intake,
      {},
      'data:image/png;base64,AA==',
      '',
      voucher,
    );
    expect(html).toContain('<th>GUESTS</th>');
    expect(html.replaceAll(' dir="auto"', '')).toContain(
      '<td>Sea Double</td><td>1</td><td>7</td><td>2</td>',
    );
    expect(html).toContain('<caption>ROOM QUANTITIES BY TYPE</caption>');
    expect(html).not.toContain('DBL · DOUBLE');
    expect(html).not.toContain('SGL · SINGLE');
    expect(html).not.toContain('<th>SERVICE</th><th>ROOM TYPE</th>');
    expect(html).toContain(
      voucher
        ? '<th>SERVICE</th><th>CHECK-IN</th><th>CHECK-OUT</th></tr>'
        : '<th>SERVICE</th></tr>',
    );
  }
  expect(contractRoomSummary(output.contract.hotelSelection)).toBe(
    'مجموع 3 اتاق: 1 سینگل، 2 دبل، 2 تخت اضافه',
  );
  const contract = contractPrintHtml(output, printReferences);
  expect(contract).toContain('<th>تعداد نفرات اتاق</th>');
  expect(contract).toContain('تعداد اتاق‌ها: <b>3</b>');
  expect(contract).toContain('مجموع مهمانان هتل: <b>7</b>');
  expect(contract).toContain(
    '<td class="room-type"><bdi>Sea Double</bdi></td><td>1</td><td>7</td><td>2</td>',
  );
  expect(intake).toEqual(original);
});
