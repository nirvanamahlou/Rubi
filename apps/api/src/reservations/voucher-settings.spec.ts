import { expect, it } from 'vitest';
import {
  voucherTextKeys,
  voucherNumberKeys,
  voucherFlagKeys,
  type VoucherSettingsV1,
} from '@nora/contracts';
import { validateVoucherSettings } from './voucher-settings';
import {
  initialTravelWorkflow,
  transitionTravelWorkflow as transition,
} from './travel-workflow';
const settings = (): VoucherSettingsV1 => ({
  text: Object.fromEntries(
    voucherTextKeys.map((k) => [k, '']),
  ) as VoucherSettingsV1['text'],
  numbers: Object.fromEntries(
    voucherNumberKeys.map((k) => [k, 0]),
  ) as VoucherSettingsV1['numbers'],
  flags: Object.fromEntries(
    voucherFlagKeys.map((k) => [k, true]),
  ) as VoucherSettingsV1['flags'],
  passengers: [{ id: 'p', selected: true, roomType: 'DBL', age: 'ADL' }],
});
it('allows empty historical supplier manifests only with trusted context, without inventing passenger IDs', () => {
  const value = settings();
  value.passengers = [];
  value.text.contractPartyName = 'SYNTHETIC AGENCY';
  const state = initialTravelWorkflow();
  const command = {
    note: '',
    expectedVersion: 0,
    action: 'SUPPLIER_FORM_SETTINGS',
    voucherSettings: value,
  } as const;
  expect(() => transition(state, command, [])).toThrow();
  expect(
    transition(state, command, [], [], true).supplierFormSettings,
  ).toMatchObject({
    passengers: [],
    text: { contractPartyName: 'SYNTHETIC AGENCY' },
  });
  expect(() =>
    transition(state, { ...command, action: 'VOUCHER_SETTINGS' }, [], [], true),
  ).toThrow();
  expect(() => validateVoucherSettings(value, ['p'], true)).toThrow();
  value.passengers = [
    { id: 'foreign', selected: true, age: 'ADL', roomType: '' },
  ];
  expect(() => transition(state, command, [], [], true)).toThrow();
});
it('retains supplier form display prices exactly and rejects invalid/duplicate currencies', () => {
  const value = settings();
  value.hotelPurchasePrices = [{ amount: '120.50', currencyCode: 'EUR' }];
  expect(validateVoucherSettings(value, ['p']).hotelPurchasePrices).toEqual(
    value.hotelPurchasePrices,
  );
  value.hotelPurchasePrices.push({ amount: '10', currencyCode: 'EUR' });
  expect(() => validateVoucherSettings(value, ['p'])).toThrow();
  value.hotelPurchasePrices = [{ amount: '-1', currencyCode: 'EUR' }];
  expect(() => validateVoucherSettings(value, ['p'])).toThrow();
});
it('validates settings and rejects foreign passengers, invalid dates and unselected groups', () => {
  const valid = settings();
  valid.text.contractPartyName = '  شرکت آزمایشی  ';
  const normalized = validateVoucherSettings(valid, ['p']);
  expect(normalized.passengers[0]?.roomType).toBe('DBL');
  expect(normalized.text.contractPartyName).toBe('شرکت آزمایشی');
  const bad = settings();
  bad.passengers[0]!.id = 'foreign';
  expect(() => validateVoucherSettings(bad, ['p'])).toThrow();
  const dates = settings();
  dates.text.checkIn = '2026-02-30';
  expect(() => validateVoucherSettings(dates, ['p'])).toThrow();
  const empty = settings();
  empty.passengers[0]!.selected = false;
  expect(() => validateVoucherSettings(empty, ['p'])).toThrow();
  const fraction = settings();
  fraction.numbers.doubleRooms = 1.5;
  expect(() => validateVoucherSettings(fraction, ['p'])).toThrow();
});

it('requires a hotel age band for every selected child', () => {
  const value = settings();
  value.passengers[0] = {
    ...value.passengers[0]!,
    age: 'CHD',
    hotelChildAgeBand: '',
  };
  expect(() => validateVoucherSettings(value, ['p'])).toThrow();

  value.passengers[0]!.hotelChildAgeBand = 'CHD_6_TO_12';
  expect(validateVoucherSettings(value, ['p']).passengers[0]).toMatchObject({
    age: 'CHD',
    hotelChildAgeBand: 'CHD_6_TO_12',
  });
});
it('persists the existing 300-character registered Board without widening other fields', () => {
  const value = settings();
  value.text.transferBoard = 'B'.repeat(300);
  expect(validateVoucherSettings(value, ['p']).text.transferBoard).toHaveLength(
    300,
  );
  value.text.transferBoard += 'B';
  expect(() => validateVoucherSettings(value, ['p'])).toThrow();
  value.text.transferBoard = '';
  value.text.leaderName = 'L'.repeat(201);
  expect(() => validateVoucherSettings(value, ['p'])).toThrow();
});
it('keeps hotel child age bands in the reservation snapshot without changing ticket age', () => {
  const value = settings();
  value.passengers[0] = {
    ...value.passengers[0]!,
    age: 'CHD',
    hotelChildAgeBand: 'CHD_2_TO_6',
  };
  expect(validateVoucherSettings(value, ['p']).passengers[0]).toMatchObject({
    age: 'CHD',
    hotelChildAgeBand: 'CHD_2_TO_6',
  });
});
it('creates a new issued settings revision without rewriting the prior settings or bypassing issue gates', () => {
  const state = {
    ...initialTravelWorkflow(),
    version: 2,
    supplierStatus: 'CONFIRMED' as const,
    voucherIssued: true,
    voucherSettings: settings(),
  };
  const edit = settings();
  edit.text.hotel = 'NEW HOTEL';
  const next = transition(
    state,
    {
      action: 'VOUCHER_SETTINGS',
      expectedVersion: 2,
      note: 'Correction',
      voucherSettings: edit,
    },
    ['p'],
  );
  expect(next.version).toBe(3);
  expect(next.voucherIssued).toBe(true);
  expect(state.voucherSettings.text.hotel).toBe('');
  expect(() =>
    transition(
      state,
      {
        action: 'VOUCHER_SETTINGS',
        expectedVersion: 1,
        note: 'Correction',
        voucherSettings: edit,
      },
      ['p'],
    ),
  ).toThrow();
  expect(() =>
    transition(
      initialTravelWorkflow(),
      {
        action: 'CONFIRM_SUPPLIER',
        expectedVersion: 0,
        note: 'Issue',
        supplierReference: 'OK',
        acknowledgeMissingInsurance: true,
      },
      ['p'],
    ),
  ).toThrow();
});
it('isolates supplier form edits and freezes sent details for purchase', () => {
  const original = settings();
  original.text.roomType = 'DBL';
  const state = { ...initialTravelWorkflow(), voucherSettings: original };
  const single = settings();
  single.brokerId = '00000000-0000-4000-8000-000000000001';
  single.text.roomType = 'SGL';
  const draft = transition(
    state,
    {
      action: 'SUPPLIER_FORM_SETTINGS',
      expectedVersion: 0,
      note: 'Edit',
      voucherSettings: single,
      applyToContractAndVoucher: false,
    },
    ['p'],
  );
  expect(draft.voucherSettings?.text.roomType).toBe('DBL');
  expect(draft.supplierFormSettings?.text.roomType).toBe('SGL');
  const sent = transition(
    draft,
    { action: 'REQUEST_SUPPLIER', expectedVersion: 1, note: 'Sent' },
    ['p'],
  );
  expect(sent.sentSupplierFormSettings?.text.roomType).toBe('SGL');
  single.text.roomType = 'NEXT';
  expect(sent.sentSupplierFormSettings?.text.roomType).toBe('SGL');
  expect(() =>
    transition(
      state,
      {
        action: 'SUPPLIER_FORM_SETTINGS',
        expectedVersion: 0,
        note: 'Both',
        voucherSettings: single,
        applyToContractAndVoucher: true,
      },
      ['p'],
    ),
  ).toThrow('قرارداد فروش را تغییر نمی‌دهد');
  expect(state.voucherSettings.text.roomType).toBe('DBL');
});

it('allows a versioned reservation-form correction after voucher issuance', () => {
  const state = {
    ...initialTravelWorkflow(),
    version: 4,
    supplierStatus: 'CONFIRMED' as const,
    voucherIssued: true,
    voucherSettings: settings(),
    note: 'VOUCHER NOTICE',
  };
  const correction = settings();
  correction.text.checkIn = '2026-10-02';
  correction.text.checkOut = '2026-10-05';
  correction.numbers.singleRooms = 1;
  const next = transition(
    state,
    {
      action: 'SUPPLIER_FORM_SETTINGS',
      expectedVersion: 4,
      note: 'Reservation form correction',
      voucherSettings: correction,
      applyToContractAndVoucher: false,
    },
    ['p'],
  );
  expect(next.version).toBe(5);
  expect(next.note).toBe('VOUCHER NOTICE');
  expect(next.voucherIssued).toBe(true);
  expect(next.supplierFormSettings?.text.checkIn).toBe('2026-10-02');
  expect(next.voucherSettings?.numbers.singleRooms).toBe(0);
  expect(state.voucherSettings.text.checkIn).toBe('');
});
it('preserves modern room composition and rejects invalid child ages', () => {
  const value = settings();
  value.rooms = [
    {
      ordinal: 1,
      roomTypeNameSnapshot: 'Family',
      adults: 2,
      childAges: [4, 10],
    },
  ];
  const result = validateVoucherSettings(value, ['p']);
  expect(result.rooms).toEqual(value.rooms);
  value.rooms[0]!.childAges[0] = 15;
  expect(result.rooms![0]!.childAges[0]).toBe(4);
  expect(() => validateVoucherSettings(value, ['p'])).toThrow();
});

it('preserves validated form services and room membership and rejects foreign rooms', () => {
  const value = settings();
  value.rooms = [
    { ordinal: 1, roomTypeNameSnapshot: 'Double', adults: 2, childAges: [] },
  ];
  value.passengers[0]!.roomOrdinal = 1;
  value.passengers[0]!.services = {
    outboundFlight: true,
    returnFlight: false,
    outboundTransfer: false,
    returnTransfer: true,
    hotel: true,
  };
  expect(validateVoucherSettings(value, ['p']).passengers[0]).toMatchObject({
    roomOrdinal: 1,
    services: value.passengers[0]!.services,
  });
  value.passengers[0]!.roomOrdinal = 2;
  expect(() => validateVoucherSettings(value, ['p'])).toThrow();
  value.passengers[0]!.roomOrdinal = 1;
  (value.passengers[0]!.services as unknown as Record<string, unknown>).hotel =
    'yes';
  expect(() => validateVoucherSettings(value, ['p'])).toThrow();
});
