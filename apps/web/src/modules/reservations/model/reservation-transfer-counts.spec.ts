import { expect, it } from 'vitest';
import { reservationTransferCounts } from './reservation-transfer-counts';
import type { ReservationFormIntake } from './reservation-form';

it('excludes young children and infants from both legs without mutating allocations', () => {
  const intake = {
    snapshot: {
      serviceSelections: [
        {
          kind: 'TRANSFER',
          clientKey: 'out',
          metadata: { direction: 'OUTBOUND' },
        },
        {
          kind: 'TRANSFER',
          clientKey: 'back',
          metadata: { direction: 'RETURN' },
        },
      ],
    },
  } as unknown as ReservationFormIntake;
  const people = [
    { age: 'ADL', outboundTransfer: true, returnTransfer: true },
    {
      age: 'CHD (2-6)',
      hotelChildAgeBand: 'CHD_2_TO_6',
      outboundTransfer: true,
      returnTransfer: true,
    },
    {
      age: 'CHD (6-12)',
      hotelChildAgeBand: 'CHD_6_TO_12',
      outboundTransfer: true,
      returnTransfer: false,
    },
    { age: 'INF', outboundTransfer: true, returnTransfer: true },
  ];
  expect(reservationTransferCounts(intake, people)).toEqual({
    outbound: 2,
    returning: 1,
  });
  expect(people[1]!.outboundTransfer).toBe(true);
});
