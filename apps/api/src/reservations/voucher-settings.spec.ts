import { expect, it } from 'vitest';
import {
  voucherTextKeys,
  voucherNumberKeys,
  voucherFlagKeys,
  type VoucherSettingsV1,
} from '@rubi/contracts';
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
  expect(
    validateVoucherSettings(settings(), ['p']).passengers[0]?.roomType,
  ).toBe('DBL');
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
