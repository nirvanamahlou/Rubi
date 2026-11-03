import { expect, it } from 'vitest';
import { tourPriceFields, type PackageTourDraftV1 } from '@nora/contracts';
import { tourDraftChanged, tourPublicationBlockers } from './tour-publication';
const draft = {
  version: 1,
  expectedVersion: 1,
  id: 'draft',
  draftVersion: 1,
  lastEditorUserId: 'editor',
  updatedAt: '2026-11-02T00:00:00Z',
  tourDepartureId: 'tour',
  batchId: 'batch',
  currencyCode: 'IRR',
  childFlightSale: '0',
  businessUplift: '0',
  commissionPercent: '0',
  priceFields: tourPriceFields({ adultFlightSale: '120.00' }),
  adultFlightSale: '120',
  selectedHotelRateIds: ['second', 'first'],
  selectedRoomKeys: ['b', 'a'],
  roomSaleOverrides: [
    {
      hotelRateId: 'first',
      roomCode: 'double',
      currencyCode: 'EUR',
      amount: '200.00',
    },
  ],
  adjustments: [
    {
      hotelRateId: 'first',
      direction: 'increase',
      mode: 'percent',
      value: '10.00',
    },
  ],
  familyAdults: 2,
  familyChildren: 0,
} as PackageTourDraftV1;
it('does not keep saved prices dirty because of Decimal display, key or set order', () => {
  expect(
    tourDraftChanged(draft, {
      ...draft,
      priceFields: draft.priceFields!.map((field) => ({
        ...field,
        amount: field.amount === '120.00' ? '120' : field.amount,
      })),
      selectedHotelRateIds: ['first', 'second'],
      selectedRoomKeys: ['a', 'b'],
      roomSaleOverrides: [
        {
          amount: '200',
          currencyCode: 'EUR',
          roomCode: 'double',
          hotelRateId: 'first',
        },
      ],
      adjustments: [
        {
          hotelRateId: 'first',
          direction: 'increase',
          mode: 'percent',
          value: '10',
        },
      ],
    }),
  ).toBe(false);
  expect(
    tourDraftChanged(draft, {
      ...draft,
      priceFields: draft.priceFields!.map((field) => ({
        ...field,
        amount: '121',
      })),
    }),
  ).toBe(true);
  expect(tourDraftChanged(draft, { ...draft, selectedRoomKeys: ['a'] })).toBe(
    true,
  );
  expect(tourDraftChanged(draft, { ...draft, roomSaleOverrides: [] })).toBe(
    true,
  );
});
it('enables saved valid publication for section users without requiring a second editor', () => {
  const input = {
    canAccess: true,
    saving: false,
    hasDraft: true,
    unsaved: false,
    invalidSale: false,
    hasHotels: true,
    capacity: 5,
    validReason: true,
  };
  expect(tourPublicationBlockers(input)).toEqual({
    disabled: false,
    reasons: [],
  });
  for (const patch of [
    { canAccess: false },
    { hasDraft: false },
    { unsaved: true },
    { invalidSale: true },
    { hasHotels: false },
    { capacity: 0 },
    { validReason: false },
  ])
    expect(tourPublicationBlockers({ ...input, ...patch })).toMatchObject({
      disabled: true,
      reasons: expect.arrayContaining([expect.any(String)]),
    });
  expect(tourPublicationBlockers({ ...input, saving: true }).disabled).toBe(
    true,
  );
});
