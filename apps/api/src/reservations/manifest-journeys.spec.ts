import { describe, expect, it } from 'vitest';
import type { ReservationIntakeV1, SalesServiceInput } from '@nora/contracts';
import { manifestJourneys } from './manifest-journeys';

function snapshot(
  contractId = 'contract',
  referenceId?: string,
  metadata: SalesServiceInput['metadata'] = {
    date: '2026-10-01',
    pickup: 'A',
    dropoff: 'B',
  },
) {
  return {
    contractId,
    serviceSelections: [
      {
        kind: 'BUS',
        clientKey: 'bus',
        titleSnapshot: 'Bus',
        referenceId,
        metadata,
      },
    ],
  } as unknown as ReservationIntakeV1['snapshot'];
}
describe('ground manifest journeys', () => {
  it('never combines unrelated ground services just because their route and date match', () => {
    expect(manifestJourneys(snapshot('a'))[0]!.offerId).not.toBe(
      manifestJourneys(snapshot('b'))[0]!.offerId,
    );
    expect(manifestJourneys(snapshot('a', 'shared'))[0]!.offerId).toBe(
      manifestJourneys(snapshot('b', 'shared'))[0]!.offerId,
    );
  });
  it('does not invent routes or travel days for incomplete historical snapshots', () => {
    for (const metadata of [
      {},
      { date: '2026-02-31', pickup: 'A', dropoff: 'B' },
      { date: '2026-10-01' },
      { departureAt: 'bad', pickup: 'A', dropoff: 'B' },
    ])
      expect(manifestJourneys(snapshot('a', undefined, metadata))).toEqual([]);
  });
  it('marks date-only schedules and retains a supplied exact departure time', () => {
    expect(manifestJourneys(snapshot())[0]).toMatchObject({
      departureAt: '2026-10-01T00:00:00+03:30',
      departureTimeKnown: false,
    });
    expect(
      manifestJourneys(
        snapshot('a', undefined, {
          departureAt: '2026-10-01T08:00:00Z',
          pickup: 'A',
          dropoff: 'B',
        }),
      )[0],
    ).toMatchObject({
      departureAt: '2026-10-01T08:00:00Z',
      departureTimeKnown: true,
    });
  });
});
