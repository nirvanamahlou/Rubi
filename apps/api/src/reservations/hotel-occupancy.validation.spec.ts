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
  const manualPack = () => {
    const p = pack();
    return {
      ...p,
      rows: p.rows.map((row) => ({
        ...row,
        roomRates: row.roomRates.map((room) => ({
          ...room,
          occupancyRates: room.occupancyRates.map((r) => ({
            ...r,
            amount: '200.00',
            saleAmount: '220.00',
            manualPricing: {
              baseAmount: '100',
              coefficient: '2',
              adjustment: { kind: 'PERCENT', value: '10' },
            },
          })),
        })),
      })),
    };
  };
  it('persists validated purchase/sale derivation inside existing occupancy JSON', () => {
    const rate =
      validateRatePack(manualPack()).rows[0]!.roomRates[0]!.occupancyRates![0]!;
    expect(rate.amount).toBe('200.00');
    expect(rate.saleAmount).toBe('220.00');
    expect(rate.manualPricing?.coefficient).toBe('2');
  });
  it.each(['amount', 'saleAmount'] as const)(
    'rejects forged derived %s',
    (field) => {
      const p = manualPack();
      p.rows[0]!.roomRates[0]!.occupancyRates[0]![field] = '999';
      expect(() => validateRatePack(p)).toThrow('هماهنگ نیست');
    },
  );
  it('rejects invalid or negative sale and manual ages over the configured boundary', () => {
    const p = manualPack();
    p.rows[0]!.roomRates[0]!.occupancyRates[0]!.manualPricing.adjustment.value =
      '-101';
    expect(() => validateRatePack(p)).toThrow();
    const q = manualPack();
    q.rows[0]!.roomRates[0]!.occupancyRates[0]!.childAges[0]!.maxExclusive = 18;
    expect(() => validateRatePack(q)).toThrow();
  });
  it('rejects inconsistent bases in one room and inconsistent hotel coefficients across rooms', () => {
    const p = manualPack();
    const r = p.rows[0]!.roomRates[0]!;
    r.occupancyRates.push({
      ...r.occupancyRates[0]!,
      adults: 1,
      amount: '400',
      saleAmount: '440',
      manualPricing: {
        ...r.occupancyRates[0]!.manualPricing,
        baseAmount: '200',
      },
    });
    expect(() => validateRatePack(p)).toThrow('یکسان');
    const q = manualPack();
    const second = structuredClone(q.rows[0]!.roomRates[0]!);
    second.roomTypeId = randomUUID();
    second.occupancyRates[0]!.manualPricing.coefficient = '3';
    second.occupancyRates[0]!.amount = '300';
    second.occupancyRates[0]!.saleAmount = '330';
    q.rows[0]!.roomRates.push(second);
    expect(() => validateRatePack(q)).toThrow('یکسان');
  });
  it('allows separate room bases with one common hotel combination coefficient', () => {
    const q = manualPack();
    const second = structuredClone(q.rows[0]!.roomRates[0]!);
    second.roomTypeId = randomUUID();
    second.occupancyRates[0]!.manualPricing.baseAmount = '200';
    second.occupancyRates[0]!.amount = '400';
    second.occupancyRates[0]!.saleAmount = '440';
    q.rows[0]!.roomRates.push(second);
    expect(validateRatePack(q).rows[0]!.roomRates).toHaveLength(2);
  });
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
