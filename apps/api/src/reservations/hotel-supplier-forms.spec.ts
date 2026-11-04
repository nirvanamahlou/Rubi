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
  expect(state.hotelSupplierForms!.extra).not.toHaveProperty('sentVersion');
  expect(state.hotelSupplierForms!.extra).not.toHaveProperty('sentSettings');
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

it('retains exact room and transfer quotations through save, send and a later draft edit', () => {
  let state = initialTravelWorkflow();
  const draft = settings('11111111-1111-4111-8111-111111111111');
  draft.supplierFormPrices = {
    transferPp: { amount: '0', currencyCode: 'EUR' },
  };
  draft.hotelTransferCounts = { outbound: 2, returning: 0 };
  const keys = ['h'];
  state = transitionTravelWorkflow(
    state,
    {
      action: 'SUPPLIER_FORM_SETTINGS',
      expectedVersion: state.version,
      note: '',
      hotelStayKey: 'h',
      voucherSettings: draft,
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
  expect(state.hotelSupplierForms!.h!.settings!.hotelRoomPrices).toEqual(
    draft.hotelRoomPrices,
  );
  expect(state.hotelSupplierForms!.h!.sentSettings!.hotelRoomPrices).toEqual(
    draft.hotelRoomPrices,
  );
  expect(state.hotelSupplierForms!.h!.sentSettings!.supplierFormPrices).toEqual(
    draft.supplierFormPrices,
  );
  const changed = structuredClone(draft);
  changed.hotelRoomPrices!.rooms[0]!.baseAmount = '150';
  state = transitionTravelWorkflow(
    state,
    {
      action: 'SUPPLIER_FORM_SETTINGS',
      expectedVersion: state.version,
      note: '',
      hotelStayKey: 'h',
      voucherSettings: changed,
    },
    ['p'],
    [],
    false,
    keys,
  );
  expect(
    state.hotelSupplierForms!.h!.settings!.hotelRoomPrices!.rooms[0]!
      .baseAmount,
  ).toBe('150');
  expect(
    state.hotelSupplierForms!.h!.sentSettings!.hotelRoomPrices!.rooms[0]!
      .baseAmount,
  ).toBe('120');
});

it('sends a common broker group atomically with independent prices and one revision', () => {
  const keys = ['h', 'extra'];
  const broker = '11111111-1111-4111-8111-111111111111';
  let state = initialTravelWorkflow();
  for (const [index, key] of keys.entries()) {
    const draft = settings(broker);
    draft.sharedHotelBroker = index === 0;
    draft.hotelRoomPrices!.rooms[0]!.baseAmount = index ? '245' : '120';
    state = transitionTravelWorkflow(
      state,
      {
        action: 'SUPPLIER_FORM_SETTINGS',
        hotelStayKey: key,
        expectedVersion: state.version,
        note: '',
        voucherSettings: draft,
      },
      ['p'],
      [],
      false,
      keys,
    );
  }
  const before = structuredClone(state);
  const sent = transitionTravelWorkflow(
    state,
    {
      action: 'REQUEST_SUPPLIER',
      hotelStayKey: 'h',
      expectedVersion: state.version,
      note: '',
    },
    ['p'],
    [],
    false,
    keys,
  );
  expect(sent.version).toBe(state.version + 1);
  for (const key of keys)
    expect(sent.hotelSupplierForms![key]).toMatchObject({
      status: 'REQUESTED',
      sentVersion: sent.version,
    });
  expect(
    sent.hotelSupplierForms!.h!.sentSettings!.hotelRoomPrices!.rooms[0]!
      .baseAmount,
  ).toBe('120');
  expect(
    sent.hotelSupplierForms!.extra!.sentSettings!.hotelRoomPrices!.rooms[0]!
      .baseAmount,
  ).toBe('245');
  expect(state).toEqual(before);
  sent.hotelSupplierForms!.extra!.settings!.hotelRoomPrices!.rooms[0]!.baseAmount =
    '999';
  expect(
    sent.hotelSupplierForms!.extra!.sentSettings!.hotelRoomPrices!.rooms[0]!
      .baseAmount,
  ).toBe('245');
});
it('rejects incomplete or different-broker groups without partially sending any stay', () => {
  for (const other of [
    undefined,
    settings('22222222-2222-4222-8222-222222222222'),
  ]) {
    const primary = {
      ...settings('11111111-1111-4111-8111-111111111111'),
      sharedHotelBroker: true,
    };
    const state = {
      ...initialTravelWorkflow(),
      supplierFormSettings: primary,
      hotelSupplierForms: {
        h: { settings: primary, status: 'NEW' as const },
        ...(other
          ? { extra: { settings: other, status: 'NEW' as const } }
          : {}),
      },
    };
    const before = structuredClone(state);
    expect(() =>
      transitionTravelWorkflow(
        state,
        {
          action: 'REQUEST_SUPPLIER',
          hotelStayKey: 'h',
          expectedVersion: 0,
          note: '',
        },
        ['p'],
        [],
        false,
        ['h', 'extra'],
      ),
    ).toThrow('کارگزار مشترک');
    expect(state).toEqual(before);
  }
});
