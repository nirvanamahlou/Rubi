import { expect, it } from 'vitest';
import {
  voucherTextKeys,
  voucherFlagKeys,
  voucherNumberKeys,
  type VoucherSettingsV1,
} from '@nora/contracts';
import {
  initialTravelWorkflow,
  transitionTravelWorkflow,
} from './travel-workflow';
const settings = (brokerId: string): VoucherSettingsV1 => ({
  brokerId,
  text: Object.fromEntries(
    voucherTextKeys.map((key) => [key, '']),
  ) as VoucherSettingsV1['text'],
  flags: Object.fromEntries(
    voucherFlagKeys.map((key) => [key, true]),
  ) as VoucherSettingsV1['flags'],
  numbers: Object.fromEntries(
    voucherNumberKeys.map((key) => [key, 0]),
  ) as VoucherSettingsV1['numbers'],
  passengers: [{ id: 'p', selected: true, roomType: 'DBL', age: 'ADL' }],
  rooms: [
    { ordinal: 1, roomTypeNameSnapshot: 'DBL', adults: 1, childAges: [] },
  ],
  hotelRoomPrices: {
    currencyCode: 'EUR',
    rooms: [{ roomOrdinal: 1, baseAmount: '120', factor: '2.5' }],
  },
});
it('saves/sends independent immutable hotel forms while preserving other suppliers, voucher and financial state', () => {
  let state = initialTravelWorkflow();
  const keys = ['h', 'extra'];
  const first = settings('11111111-1111-4111-8111-111111111111'),
    second = settings('22222222-2222-4222-8222-222222222222');
  state = transitionTravelWorkflow(
    state,
    {
      action: 'SUPPLIER_FORM_SETTINGS',
      expectedVersion: state.version,
      note: '',
      hotelStayKey: 'h',
      voucherSettings: first,
    },
    ['p'],
    [],
    false,
    keys,
  );
  state = transitionTravelWorkflow(
    state,
    {
      action: 'REQUEST_SUPPLIER',
      expectedVersion: state.version,
      note: '',
      hotelStayKey: 'h',
    },
    ['p'],
    [],
    false,
    keys,
  );
  const sent = structuredClone(state.hotelSupplierForms!.h!.sentSettings);
  state = transitionTravelWorkflow(
    state,
    {
      action: 'SUPPLIER_FORM_SETTINGS',
      expectedVersion: state.version,
      note: '',
      hotelStayKey: 'extra',
      voucherSettings: second,
    },
    ['p'],
    [],
    false,
    keys,
  );
  expect(state.hotelSupplierForms!.h!.sentSettings).toEqual(sent);
  expect(state.hotelSupplierForms!.extra!.settings!.brokerId).toBe(
    second.brokerId,
  );
  expect(state.voucherSettings).toBeUndefined();
  expect(state.voucherIssued).toBe(false);
  expect(first.hotelRoomPrices!.rooms[0]!.baseAmount).toBe('120');
  expect(() =>
    transitionTravelWorkflow(
      state,
      {
        action: 'SUPPLIER_FORM_SETTINGS',
        expectedVersion: state.version,
        note: '',
        hotelStayKey: 'foreign',
        voucherSettings: first,
      },
      ['p'],
      [],
      false,
      keys,
    ),
  ).toThrow();
  expect(() =>
    transitionTravelWorkflow(
      state,
      {
        action: 'SUPPLIER_FORM_SETTINGS',
        expectedVersion: 0,
        note: '',
        hotelStayKey: 'extra',
        voucherSettings: second,
      },
      ['p'],
      [],
      false,
      keys,
    ),
  ).toThrow();
});
