import { expect, it } from 'vitest';
import { defaultVoucherSettings } from './voucher-settings';
import {
  normalizeSupplierFormPrices,
  supplierPriceTableData,
  supplierTransferCounts,
} from './supplier-form-prices';
import type { ReservationFormIntake } from './reservation-form';
const fixture = () =>
  ({
    id: 'synthetic',
    receivedAt: '2026-10-01T00:00:00Z',
    snapshot: {
      contractNumber: 'Synthetic',
      passengerIds: ['a', 'b', 'baby'],
      passengerAssignments: [
        {
          customerId: 'a',
          displayNameSnapshot: 'A',
          ageCategory: 'ADT',
          serviceClientKeys: ['transfer-outbound', 'transfer-return'],
        },
        {
          customerId: 'b',
          displayNameSnapshot: 'B',
          ageCategory: 'CHD',
          childAgeBand: 'AGE_2_6',
          serviceClientKeys: ['transfer-outbound'],
        },
        {
          customerId: 'baby',
          displayNameSnapshot: 'Baby',
          ageCategory: 'INF',
          serviceClientKeys: ['transfer-outbound', 'transfer-return'],
        },
      ],
      serviceSelections: [
        {
          clientKey: 'transfer-outbound',
          kind: 'TRANSFER',
          titleSnapshot: 'Out',
          metadata: { direction: 'OUTBOUND' },
        },
        {
          clientKey: 'transfer-return',
          kind: 'TRANSFER',
          titleSnapshot: 'Back',
          metadata: { direction: 'RETURN' },
        },
      ],
    },
    workflow: { roomOrder: ['a', 'b', 'baby'], ageOverrides: {}, note: '' },
  }) as unknown as ReservationFormIntake;
it('counts independently selected outbound and return transfers without treating infants as transfer seats', () => {
  const intake = fixture();
  expect(supplierTransferCounts(intake)).toEqual({ outbound: 2, returning: 1 });
  const settings = defaultVoucherSettings(intake, {});
  settings.passengers.find((p) => p.id === 'b')!.selected = false;
  intake.workflow.supplierFormSettings = settings;
  expect(supplierTransferCounts(intake)).toEqual({ outbound: 1, returning: 1 });
});
it('retains exact independent prices and does not reinterpret a historical total as P.P', () => {
  const intake = fixture();
  const settings = defaultVoucherSettings(intake, {});
  settings.hotelPurchasePrices = [{ amount: '999', currencyCode: 'IRR' }];
  intake.workflow.supplierFormSettings = settings;
  expect(supplierPriceTableData(intake).values).toEqual(['-', '-', '-']);
  settings.supplierFormPrices = {
    pp: { amount: '9007199254740993.25', currencyCode: 'EUR' },
    ratio: { amount: '2', currencyCode: 'USD' },
    transferPp: { amount: '0', currencyCode: 'JPY' },
  };
  expect(supplierPriceTableData(intake).values).toEqual([
    '9,007,199,254,740,993.25 EUR',
    '2',
    '0 JPY',
  ]);
  const restored = defaultVoucherSettings(
    { ...intake, workflow: { ...intake.workflow, voucherSettings: settings } },
    {},
  );
  expect(restored.supplierFormPrices).toEqual(settings.supplierFormPrices);
});
it('requires a valid amount and registered currency together, allows an empty table and preserves zero', () => {
  expect(
    normalizeSupplierFormPrices({ pp: { amount: '', currencyCode: '' } }, []),
  ).toEqual({});
  expect(
    normalizeSupplierFormPrices({ pp: { amount: '0', currencyCode: 'JPY' } }, [
      { code: 'JPY' },
    ]),
  ).toEqual({ pp: { amount: '0', currencyCode: 'JPY' } });
  expect(() =>
    normalizeSupplierFormPrices({ pp: { amount: '1', currencyCode: 'XYZ' } }, [
      { code: 'JPY' },
    ]),
  ).toThrow();
  expect(() =>
    normalizeSupplierFormPrices({ ratio: { amount: '-1' } }, [{ code: 'JPY' }]),
  ).toThrow();
});
it('uses booked leg counts and supports aggregate contracts without manufacturing passenger identities', () => {
  const intake = fixture();
  intake.snapshot.serviceSelections[0]!.metadata = {
    direction: 'OUTBOUND',
    passengerCount: 1,
  };
  expect(supplierTransferCounts(intake)).toEqual({ outbound: 1, returning: 1 });
  intake.snapshot.passengerIds = [];
  intake.snapshot.passengerAssignments = [];
  intake.workflow.roomOrder = [];
  intake.snapshot.serviceSelections[0]!.metadata = {
    direction: 'OUTBOUND',
    legacyServicePartiesV2: JSON.stringify({
      'transfer-outbound': { adults: 2, children: 1, infants: 1 },
      'transfer-return': { adults: 1, children: 1, infants: 1 },
    }),
  };
  expect(supplierTransferCounts(intake)).toEqual({ outbound: 3, returning: 2 });
});

it('saves a dimensionless ratio without requiring a currency and removes legacy currency on save', () => {
  expect(
    normalizeSupplierFormPrices({ ratio: { amount: '2.50' } }, []),
  ).toEqual({ ratio: { amount: '2.50' } });
  expect(
    normalizeSupplierFormPrices(
      { ratio: { amount: '2', currencyCode: 'USD' } },
      [],
    ),
  ).toEqual({ ratio: { amount: '2' } });
});
