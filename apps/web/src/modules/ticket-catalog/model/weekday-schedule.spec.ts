import { describe, expect, it } from 'vitest';
import { emptyInput } from './preview';
import { buildWeekdayTickets, scheduleDates } from './weekday-schedule';

describe('weekly flight schedule', () => {
  it('creates every Saturday and Sunday in the inclusive October range, with two-day returns', () => {
    const pairs = scheduleDates(
      '2026-10-01',
      '2026-10-30',
      [
        { day: 6, stayDays: 2 },
        { day: 0, stayDays: 2 },
      ],
      true,
    );
    expect(pairs).toEqual([
      { outbound: '2026-10-03', returning: '2026-10-05' },
      { outbound: '2026-10-04', returning: '2026-10-06' },
      { outbound: '2026-10-10', returning: '2026-10-12' },
      { outbound: '2026-10-11', returning: '2026-10-13' },
      { outbound: '2026-10-17', returning: '2026-10-19' },
      { outbound: '2026-10-18', returning: '2026-10-20' },
      { outbound: '2026-10-24', returning: '2026-10-26' },
      { outbound: '2026-10-25', returning: '2026-10-27' },
    ]);
  });
  it('includes both endpoints and generates the final return beyond the outbound range', () => {
    expect(
      scheduleDates(
        '2026-10-03',
        '2026-10-04',
        [
          { day: 6, stayDays: 2 },
          { day: 0, stayDays: 16 },
        ],
        true,
      ),
    ).toEqual([
      { outbound: '2026-10-03', returning: '2026-10-05' },
      { outbound: '2026-10-04', returning: '2026-10-20' },
    ]);
  });
  it('one-way ignores stay days and never creates returns', () => {
    expect(
      scheduleDates(
        '2026-10-03',
        '2026-10-10',
        [{ day: 6, stayDays: NaN }],
        false,
      ),
    ).toEqual([{ outbound: '2026-10-03' }, { outbound: '2026-10-10' }]);
  });
  it.each([
    ['2026-02-30', '2026-03-01', [{ day: 0, stayDays: 2 }]],
    ['2026-10-04', '2026-10-03', [{ day: 0, stayDays: 2 }]],
    ['2026-10-01', '2026-10-30', []],
    ['2026-10-01', '2026-10-02', [{ day: 6, stayDays: 2 }]],
    ['2026-10-01', '2026-10-30', [{ day: 0, stayDays: 1.5 }]],
  ] as const)('rejects invalid or empty plans %s to %s', (start, end, days) => {
    expect(() => scheduleDates(start, end, days, true)).toThrow();
  });
  const outbound = emptyInput();
  outbound.segments = [
    {
      ...outbound.segments[0]!,
      originCityId: 'a',
      destinationCityId: 'b',
      departureZone: 'UTC',
      arrivalZone: 'UTC',
    },
  ];
  const returning = {
    ...outbound,
    journeyRole: 'return' as const,
    segments: [
      { ...outbound.segments[0]!, originCityId: 'b', destinationCityId: 'a' },
    ],
  };
  const time = { departure: '10:00', arrival: '12:00', arrivalDayOffset: 0 };
  const utc = (wall: string) => new Date(wall + ':00Z').toISOString();
  it('deduplicates shared reverse flights and produces stable retry identities', () => {
    const dates = scheduleDates(
      '2026-10-03',
      '2026-10-04',
      [
        { day: 6, stayDays: 2 },
        { day: 0, stayDays: 1 },
      ],
      true,
    );
    const build = () =>
      buildWeekdayTickets(
        dates,
        outbound,
        returning,
        time,
        time,
        'batch-1',
        utc,
      );
    const products = build();
    expect(products).toHaveLength(3);
    expect(
      products
        .filter((p) => p.journeyRole === 'return')
        .map((p) => p.serviceDate),
    ).toEqual(['2026-10-05']);
    expect(build()).toEqual(products);
  });
  it('rejects automatically generated returns outside Min / Max', () => {
    expect(() =>
      buildWeekdayTickets(
        [{ outbound: '2026-10-03', returning: '2026-10-05' }],
        { ...outbound, returnMinDays: 3, returnMaxDays: 16 },
        returning,
        time,
        time,
        'batch',
        utc,
      ),
    ).toThrow(/Min/);
  });
  it('requires explicit arrival day for overnight flights', () => {
    const dates = [{ outbound: '2026-10-03' }];
    expect(() =>
      buildWeekdayTickets(
        dates,
        outbound,
        undefined,
        { departure: '23:00', arrival: '01:00', arrivalDayOffset: 0 },
        time,
        'batch',
        utc,
      ),
    ).toThrow(/رسیدن/);
    const result = buildWeekdayTickets(
      dates,
      outbound,
      undefined,
      { departure: '23:00', arrival: '01:00', arrivalDayOffset: 1 },
      time,
      'batch',
      utc,
    );
    expect(result[0]!.segments[0]!.arrivalAt).toBe('2026-10-04T01:00:00.000Z');
  });
});
