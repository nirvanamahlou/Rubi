import { describe, expect, it } from 'vitest';
import type { SalesReservationRequestV1 } from '@nora/contracts';
import { floatingPassengerPurchaseGroups } from './floating-passenger-purchase';
const snapshot = {
  passengerAssignments: [
    { customerId: 'adult', displayNameSnapshot: 'Adult' },
    { customerId: 'child', displayNameSnapshot: 'Child' },
  ],
} as unknown as SalesReservationRequestV1;
const rows = [
  {
    customerId: 'adult',
    rialAmount: '100.0001',
    foreignAmount: '10.25',
    currencyCode: 'USD',
  },
  {
    customerId: 'child',
    rialAmount: '0.0002',
    foreignAmount: '5.50',
    currencyCode: 'USD',
  },
];
describe('floating passenger purchase', () => {
  it('keeps exact IRR and FX totals and passenger identities separately', () => {
    const groups = floatingPassengerPurchaseGroups(snapshot, rows);
    expect(groups.map((g) => [g.currencyCode, g.amount])).toEqual([
      ['IRR', '100.0003'],
      ['USD', '15.75'],
    ]);
    expect(groups[1]!.passengerPrices[1]).toMatchObject({
      customerId: 'child',
      passengerName: 'Child',
      totalAmount: '5.5',
    });
  });
  it('supports different currencies and explicit free passengers', () => {
    expect(
      floatingPassengerPurchaseGroups(snapshot, [
        rows[0]!,
        { ...rows[1]!, foreignAmount: '0', rialAmount: '0' },
      ]),
    ).toHaveLength(2);
    expect(
      floatingPassengerPurchaseGroups(snapshot, [
        rows[0]!,
        { ...rows[1]!, currencyCode: 'EUR' },
      ]),
    ).toHaveLength(3);
  });
  it.each(
    [
      [rows[0]],
      [rows[0], rows[0]],
      [rows[0], { ...rows[1], customerId: 'other' }],
      [rows[0], { ...rows[1], rialAmount: '-1' }],
      [rows[0], { ...rows[1], currencyCode: undefined }],
      [rows[0], { ...rows[1], foreignAmount: 'NaN' }],
      [rows[0], { ...rows[1], currencyCode: 'IRR' }],
    ].map((prices) => ({ prices })),
  )('rejects invalid or incomplete passenger prices', ({ prices }) => {
    expect(() =>
      floatingPassengerPurchaseGroups(snapshot, prices as typeof rows),
    ).toThrow();
  });
});
