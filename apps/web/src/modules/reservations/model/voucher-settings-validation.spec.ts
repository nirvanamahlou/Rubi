import { expect, it } from 'vitest';
import { defaultVoucherSettings } from './voucher-settings';
import type { ReservationFormIntake } from './reservation-form';
import { validateVoucherSettings } from '../../../../../api/src/reservations/voucher-settings';
import {
  initialTravelWorkflow,
  transitionTravelWorkflow,
} from '../../../../../api/src/reservations/travel-workflow';
const intake = (): ReservationFormIntake =>
  ({
    snapshot: {
      passengerIds: ['adult', 'child'],
      passengerAssignments: [
        {
          customerId: 'adult',
          displayNameSnapshot: 'SAMPLE ADULT',
          ageCategory: 'ADT',
          serviceClientKeys: [],
        },
        {
          customerId: 'child',
          displayNameSnapshot: 'SAMPLE CHILD',
          ageCategory: 'CHD',
          childAgeBand: 'AGE_2_6',
          serviceClientKeys: [],
        },
      ],
      serviceSelections: [],
      hotelSelection: {
        hotelId: 'hotel',
        hotelNameSnapshot: 'SAMPLE HOTEL',
        roomCount: 1,
        checkInDate: '2026-10-01',
        checkOutDate: '2026-10-05',
      },
    },
    workflow: { roomOrder: ['child', 'adult'], ageOverrides: {}, note: '' },
  }) as unknown as ReservationFormIntake;
it('accepts actual supplier/voucher defaults for an ordered child without re-entering its saved hotel band', () => {
  const value = intake();
  const defaults = defaultVoucherSettings(value, {});
  expect(defaults.passengers.map((p) => p.id)).toEqual(['child', 'adult']);
  expect(defaults.passengers[0]!.hotelChildAgeBand).toBe('CHD_2_TO_6');
  expect(() =>
    validateVoucherSettings(defaults, value.snapshot.passengerIds),
  ).not.toThrow();
});
it('repairs empty legacy child bands but preserves deliberate saved overrides', () => {
  const value = intake();
  value.workflow.voucherSettings = defaultVoucherSettings(value, {});
  value.workflow.voucherSettings.passengers[0]!.hotelChildAgeBand = '';
  expect(
    defaultVoucherSettings(value, {}).passengers[0]!.hotelChildAgeBand,
  ).toBe('CHD_2_TO_6');
  value.workflow.voucherSettings.passengers[0]!.hotelChildAgeBand =
    'CHD_6_TO_12';
  expect(
    defaultVoucherSettings(value, {}).passengers[0]!.hotelChildAgeBand,
  ).toBe('CHD_6_TO_12');
  value.workflow.voucherSettings.passengers[0]!.age = 'ADL';
  const defaults = defaultVoucherSettings(value, {});
  expect(defaults.passengers[0]!.hotelChildAgeBand).toBe('');
  expect(() =>
    validateVoucherSettings(defaults, value.snapshot.passengerIds),
  ).not.toThrow();
});

it('submits both form commands with complete membership and preserves source and issued versions', () => {
  const value = intake();
  const settings = defaultVoucherSettings(value, {});
  const source = structuredClone(value);
  const state = initialTravelWorkflow();
  for (const action of [
    'SUPPLIER_FORM_SETTINGS',
    'VOUCHER_SETTINGS',
  ] as const) {
    const next = transitionTravelWorkflow(
      state,
      {
        action,
        expectedVersion: state.version,
        note: '',
        voucherSettings: settings,
      },
      value.snapshot.passengerIds,
    );
    const saved =
      action === 'VOUCHER_SETTINGS'
        ? next.voucherSettings
        : next.supplierFormSettings;
    expect(saved!.passengers.map((p) => p.id)).toEqual(['child', 'adult']);
    expect(saved!.passengers[0]!.hotelChildAgeBand).toBe('CHD_2_TO_6');
  }
  expect(value).toEqual(source);
  expect(state.voucherSettings).toBeUndefined();
});
it('does not guess missing child bands or silently accept foreign passengers', () => {
  const value = intake();
  delete value.snapshot.passengerAssignments![1]!.childAgeBand;
  const settings = defaultVoucherSettings(value, {});
  expect(settings.passengers[0]!.hotelChildAgeBand).toBe('');
  expect(() =>
    validateVoucherSettings(settings, value.snapshot.passengerIds),
  ).toThrow();
  settings.passengers[0]!.hotelChildAgeBand = 'CHD_6_TO_12';
  settings.passengers[0]!.id = 'foreign';
  expect(() =>
    validateVoucherSettings(settings, value.snapshot.passengerIds),
  ).toThrow();
});
