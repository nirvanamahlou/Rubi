import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { validateRatePack } from './hotel-rates.validation';
const pack = () => ({
  branchId: randomUUID(),
  cityId: randomUUID(),
  checkIn: '2026-10-01',
  checkOut: '2026-11-01',
  method: 'STAY',
  currency: 'EUR',
  rows: [
    {
      hotelId: randomUUID(),
      brokerId: randomUUID(),
      currency: 'EUR',
      base: '1',
      roomRates: [
        {
          roomTypeId: randomUUID(),
          factor: '1',
          maxAdults: 3,
          maxChildren: 2,
          occupancyRates: [
            {
              adults: 2,
              childAges: [{ min: 3, maxExclusive: 7 }],
              startsOn: '2026-10-01',
              endsOnExclusive: '2026-11-01',
              currencyCode: 'EUR',
              amount: '123.4567',
              board: 'BB',
              composition: '2 AD + 1 CHD',
            },
          ],
        },
      ],
    },
  ],
});
describe('hotel occupancy API validation', () => {
  it('rejects conflicting overlapping prices for the same exact composition', () => {
    const p = pack();
    const rates = p.rows[0]!.roomRates[0]!.occupancyRates;
    rates.push({ ...rates[0]!, amount: '999' });
    expect(() => validateRatePack(p)).toThrow('هم‌پوشان');
  });
  it('retains exact four-decimal tariffs in the existing versioned pack', () =>
    expect(
      validateRatePack(pack()).rows[0]!.roomRates[0]!.occupancyRates?.[0]
        ?.amount,
    ).toBe('123.4567'));
  it.each(['2026-02-30', '2026-09-30'])(
    'rejects invalid or outside-pack starts %s',
    (startsOn) => {
      const p = pack();
      p.rows[0]!.roomRates[0]!.occupancyRates[0]!.startsOn = startsOn;
      expect(() => validateRatePack(p)).toThrow();
    },
  );
  it('rejects reversed age bands, mixed currencies and legacy tour consumption', () => {
    const p = pack();
    p.rows[0]!.roomRates[0]!.occupancyRates[0]!.childAges[0]!.maxExclusive = 3;
    expect(() => validateRatePack(p)).toThrow();
    const q = pack();
    q.rows[0]!.roomRates[0]!.occupancyRates[0]!.currencyCode = 'USD';
    expect(() => validateRatePack(q)).toThrow();
    expect(() =>
      validateRatePack({ ...pack(), tourDepartureId: randomUUID() }),
    ).toThrow('مستقل');
  });
});
