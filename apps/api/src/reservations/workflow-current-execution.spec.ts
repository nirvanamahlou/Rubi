import { expect, it } from 'vitest';
import { initialTravelWorkflow } from './travel-workflow';
import { refreshWorkflowExecution } from './workflow-current-execution';
import type {
  SalesReservationRequestV1,
  VoucherSettingsV1,
} from '@nora/contracts';
const before = {
  version: 1,
  requestId: 'r',
  contractId: 'c',
  contractVersion: 1,
  passengerIds: ['p'],
  passengerAssignments: [
    {
      customerId: 'p',
      displayNameSnapshot: 'OLD NAME',
      ageCategory: 'ADT',
      serviceClientKeys: ['hotel'],
    },
  ],
  serviceSelections: [],
  ticketSelections: [],
  hotelSelection: {
    hotelId: 'old',
    hotelNameSnapshot: 'OLD HOTEL',
    checkInDate: '2099-01-01',
    checkOutDate: '2099-01-02',
    roomTypeId: 'old-room',
    roomCount: 1,
    rooms: [
      {
        ordinal: 1,
        roomTypeNameSnapshot: 'OLD ROOM',
        adults: 1,
        childAges: [],
      },
    ],
  },
} as unknown as SalesReservationRequestV1;
it('rebases current hotel and age facts while preserving supplier, leader and issue history', () => {
  const settings = {
    brokerId: 'broker',
    leaderId: 'leader',
    transferBrokerId: 'transfer-broker',
    transferBrokerName: 'Transfer supplier',
    transferDetailsOverride: true,
    text: { hotel: 'OLD HOTEL', checkIn: '2099-01-01', remarks: 'KEEP NOTE' },
    numbers: {},
    flags: { withLetterhead: true },
    passengers: [
      {
        id: 'p',
        selected: true,
        age: 'ADL',
        roomType: 'OLD ROOM',
        roomOrdinal: 1,
      },
    ],
  } as unknown as VoucherSettingsV1;
  const workflow = {
    ...initialTravelWorkflow(),
    voucherIssued: true,
    supplierFormSettings: settings,
    sentSupplierFormSettings: settings,
    voucherSettings: settings,
    ageOverrides: { p: 'ADULT' as const },
  };
  const current = {
    ...before,
    contractVersion: 2,
    passengerAssignments: [
      {
        ...before.passengerAssignments![0]!,
        ageCategory: 'CHD' as const,
        childAgeBand: 'AGE_2_6' as const,
      },
    ],
    hotelSelection: {
      ...before.hotelSelection!,
      hotelId: 'new',
      hotelNameSnapshot: 'NEW HOTEL',
      checkInDate: '2099-02-01',
      rooms: [
        {
          ...before.hotelSelection!.rooms![0]!,
          roomTypeNameSnapshot: 'NEW ROOM',
        },
      ],
    },
  };
  const result = refreshWorkflowExecution(workflow, before, current);
  for (const s of [
    result.supplierFormSettings,
    result.sentSupplierFormSettings,
    result.voucherSettings,
  ]) {
    expect(s?.text).toMatchObject({
      hotel: 'NEW HOTEL',
      checkIn: '2099-02-01',
      remarks: 'KEEP NOTE',
    });
    expect(s?.brokerId).toBe('broker');
    expect(s?.leaderId).toBe('leader');
    expect(s?.transferBrokerId).toBe('transfer-broker');
    expect(s?.transferDetailsOverride).toBe(true);
    expect(s?.passengers[0]).toMatchObject({
      age: 'CHD',
      hotelChildAgeBand: 'CHD_2_TO_6',
      roomType: 'NEW ROOM',
    });
  }
  expect(result.voucherIssued).toBe(true);
  expect(result.ageOverrides).toEqual({});
  expect(settings.text.hotel).toBe('OLD HOTEL');
  expect(before.hotelSelection?.hotelNameSnapshot).toBe('OLD HOTEL');
});
it('keeps form-only room overrides when canonical facts did not change', () => {
  const settings = {
    text: { hotel: 'FORM OVERRIDE' },
    passengers: [{ id: 'p', selected: true, roomType: 'CUSTOM' }],
  } as unknown as VoucherSettingsV1;
  const workflow = { ...initialTravelWorkflow(), voucherSettings: settings };
  expect(
    refreshWorkflowExecution(workflow, before, {
      ...before,
      contractVersion: 5,
    }).voucherSettings?.text.hotel,
  ).toBe('FORM OVERRIDE');
});

it('preserves a later form-only override through a subsequent price-only contract revision', () => {
  const changed = {
    ...before,
    contractVersion: 2,
    hotelSelection: {
      ...before.hotelSelection!,
      hotelId: 'second',
      hotelNameSnapshot: 'SECOND HOTEL',
    },
  };
  const rebased = refreshWorkflowExecution(
    initialTravelWorkflow(),
    before,
    changed,
  );
  const settings = {
    text: { hotel: 'FORM ONLY HOTEL' },
    passengers: [{ id: 'p', selected: true, roomType: 'CUSTOM' }],
  } as unknown as VoucherSettingsV1;
  const saved = { ...rebased, voucherSettings: settings };
  const priceRevision = { ...changed, contractVersion: 3 };
  expect(
    refreshWorkflowExecution(saved, before, priceRevision).voucherSettings?.text
      .hotel,
  ).toBe('FORM ONLY HOTEL');
});
