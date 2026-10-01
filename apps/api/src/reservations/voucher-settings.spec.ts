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
  expect(next.voucherIssued).toBe(true);
  expect(next.supplierFormSettings?.text.checkIn).toBe('2026-10-02');
  expect(next.voucherSettings?.numbers.singleRooms).toBe(0);
  expect(state.voucherSettings.text.checkIn).toBe('');
});

it('requires selected broker and services for preparation and preserves the sent service snapshot', () => {
  const draft = settings();
  draft.references = { brokerId: '11111111-1111-4111-8111-111111111111' };
  const start = initialTravelWorkflow();
  const command = {
    action: 'PREPARE_SUPPLIER_FORM' as const,
    expectedVersion: 0,
    note: 'Prepare',
    voucherSettings: draft,
  };
  const prepared = transition(start, command, ['p']);
  expect(prepared.supplierFormPrepared).toBe(true);
  expect(prepared.supplierFormSettings?.references).toEqual(draft.references);
  const sent = transition(
    prepared,
    {
      action: 'REQUEST_SUPPLIER',
      expectedVersion: prepared.version,
      note: 'Send',
    },
    ['p'],
  );
  expect(sent.sentSupplierFormSettings).toEqual(prepared.supplierFormSettings);
  expect(() =>
    transition(
      sent,
      {
        action: 'CONFIRM_SUPPLIER',
        expectedVersion: sent.version,
        note: 'Confirm',
        supplierReference: 'SYNTHETIC',
        acknowledgeMissingInsurance: true,
      },
      ['p'],
    ),
  ).toThrow('تورلیدر');
  const bad = structuredClone(draft);
  delete bad.references;
  expect(() =>
    transition(start, { ...command, voucherSettings: bad }, ['p']),
  ).toThrow('کارگزار');
  for (const flag of voucherFlagKeys) bad.flags[flag] = false;
  bad.references = draft.references;
  expect(() =>
    transition(start, { ...command, voucherSettings: bad }, ['p']),
  ).toThrow('خدمت');
  expect(start.supplierFormSettings).toBeUndefined();
});
it('carries the prepared service flags into voucher and clears stale guide after broker preparation', () => {
  const draft = settings();
  draft.references = { brokerId: '11111111-1111-4111-8111-111111111111' };
  draft.flags.tourLeader = false;
  draft.flags.transfer = true;
  let state = transition(
    initialTravelWorkflow(),
    {
      action: 'PREPARE_SUPPLIER_FORM',
      expectedVersion: 0,
      note: 'Prepare',
      voucherSettings: draft,
    },
    ['p'],
  );
  state = transition(
    state,
    {
      action: 'REQUEST_SUPPLIER',
      expectedVersion: state.version,
      note: 'Send',
    },
    ['p'],
  );
  const issued = transition(
    state,
    {
      action: 'CONFIRM_SUPPLIER',
      expectedVersion: state.version,
      note: 'Confirm',
      supplierReference: 'SYNTHETIC',
      acknowledgeMissingInsurance: true,
    },
    ['p'],
  );
  expect(issued.voucherSettings?.flags.transfer).toBe(true);
  expect(issued.voucherSettings?.references).toEqual(draft.references);
});
