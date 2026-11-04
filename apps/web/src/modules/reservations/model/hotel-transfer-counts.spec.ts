import { expect, it } from 'vitest';
import type { SalesReservationRequestV1 } from '@nora/contracts';
import { contractHotelTransferCounts } from './hotel-transfer-counts';

function snapshot() {
  return {
    passengerIds: ['adult', 'child', 'infant'],
    hotelSelection: { serviceClientKey: 'hotel', hotelId: 'first' },
    serviceSelections: [
      { clientKey: 'hotel', kind: 'HOTEL' },
      {
        clientKey: 'out',
        kind: 'TRANSFER',
        metadata: { direction: 'OUTBOUND' },
      },
      {
        clientKey: 'duplicate',
        kind: 'TRANSFER',
        metadata: { direction: 'OUTBOUND' },
      },
      {
        clientKey: 'back',
        kind: 'TRANSFER',
        metadata: { direction: 'RETURN' },
      },
    ],
    passengerAssignments: [
      {
        customerId: 'adult',
        ageCategory: 'ADT',
        serviceClientKeys: ['out', 'duplicate', 'back'],
      },
      { customerId: 'child', ageCategory: 'CHD', serviceClientKeys: ['out'] },
      {
        customerId: 'infant',
        ageCategory: 'INF',
        serviceClientKeys: ['out', 'back'],
      },
      {
        customerId: 'removed',
        ageCategory: 'ADT',
        serviceClientKeys: ['out', 'back'],
      },
    ],
  } as unknown as SalesReservationRequestV1;
}

it('counts distinct allocated adults/children separately per direction, excluding infants and removed passengers', () => {
  const source = snapshot(),
    before = structuredClone(source);
  expect(contractHotelTransferCounts(source, 'hotel')).toEqual({
    outbound: 2,
    returning: 1,
  });
  expect(source).toEqual(before);
});

it('does not copy primary transfers to an unrelated additional hotel', () => {
  const source = snapshot();
  source.hotelSelection!.additionalStays = [{ hotelId: 'second' }] as never;
  expect(contractHotelTransferCounts(source, 'hotel-stay:2:second')).toEqual({
    outbound: 0,
    returning: 0,
  });
});

it('retains legacy booked aggregate counts even while passenger registration is incomplete', () => {
  const source = snapshot();
  source.serviceSelections = source.serviceSelections.filter(
    (s) => s.clientKey !== 'duplicate',
  );
  source.serviceSelections[0]!.metadata = {
    legacyServicePartiesV2: JSON.stringify({
      hotel: { adults: 2, children: 1, infants: 1 },
      out: { adults: 2, children: 1, infants: 1 },
      back: { adults: 1, children: 1, infants: 0 },
    }),
  };
  expect(contractHotelTransferCounts(source, 'hotel')).toEqual({
    outbound: 3,
    returning: 2,
  });
});

it('reads historical directional keys and passengerCount without fabricating transfers for absent services', () => {
  const source = snapshot();
  source.passengerAssignments = [];
  source.serviceSelections = [
    {
      clientKey: 'transfer-return',
      kind: 'TRANSFER',
      titleSnapshot: 'Transfer',
      metadata: { passengerCount: 4 },
    },
  ];
  expect(contractHotelTransferCounts(source, 'hotel')).toEqual({
    outbound: 0,
    returning: 4,
  });
  source.serviceSelections = [];
  expect(contractHotelTransferCounts(source, 'hotel')).toEqual({
    outbound: 0,
    returning: 0,
  });
});
