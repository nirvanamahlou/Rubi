import { describe, expect, it } from 'vitest';
import {
  buildManualRates,
  combinationsFromRates,
  combinationKey,
  defaultCombinations,
  retimeManualRates,
} from './manual-coefficients';
describe('manual hotel combinations', () => {
  const build = (base = '100') =>
    buildManualRates(
      defaultCombinations(),
      base,
      'EUR',
      '2026-10-01',
      '2026-11-01',
    );
  it('starts with double/single/child-with-bed and does not invent optional factors', () => {
    expect(defaultCombinations().map((c) => c.label)).toEqual([
      'دبل',
      'سینگل',
      'کودک با تخت',
    ]);
    expect(build()?.map((r) => r.amount)).toEqual(['200.00']);
    expect(build()?.[0]?.manualPricing?.baseAmount).toBe('100');
  });
  it('restores metadata and exact children, ignoring invalid legacy coefficients', () => {
    const combinations = defaultCombinations().map((c) => ({
      ...c,
      coefficient: '2.5',
    }));
    const rates = buildManualRates(
      combinations,
      '100',
      'EUR',
      '2026-10-01',
      '2026-11-01',
    )!;
    expect(combinationsFromRates(rates).map(combinationKey)).toEqual(
      combinations.map(combinationKey),
    );
    expect(combinationsFromRates([])).toEqual(defaultCombinations());
    expect(rates[2]?.childAges).toEqual([{ min: 2, maxExclusive: 15 }]);
    expect(
      buildManualRates(
        combinations,
        '200',
        'EUR',
        '2026-10-01',
        '2026-11-01',
      )![0]?.amount,
    ).toBe('500.00');
  });
  it('changes only the selected composition sale, preserves purchase and base reprices once', () => {
    const c = defaultCombinations()
      .slice(0, 2)
      .map((r) => ({ ...r, coefficient: '2' }));
    const adjustments = {
      [combinationKey(c[0]!)]: { kind: 'PERCENT' as const, value: '10' },
    };
    const rates = buildManualRates(
      c,
      '100',
      'EUR',
      '2026-10-01',
      '2026-11-01',
      adjustments,
    )!;
    expect(rates.map((r) => [r.amount, r.saleAmount])).toEqual([
      ['200.00', '220.00'],
      ['200.00', '200.00'],
    ]);
    expect(
      buildManualRates(
        c,
        '200',
        'EUR',
        '2026-10-01',
        '2026-11-01',
        adjustments,
      )![0]?.saleAmount,
    ).toBe('440.00');
  });
  it('rejects reversed ages, duplicate compositions, empty prices and invalid dates', () => {
    const c = defaultCombinations();
    expect(
      buildManualRates(
        [c[0]!, c[0]!],
        '100',
        'EUR',
        '2026-10-01',
        '2026-11-01',
      ),
    ).toBeNull();
    expect(
      buildManualRates(
        [{ ...c[0]!, childAges: [{ min: 14, maxExclusive: 14 }] }],
        '100',
        'EUR',
        '2026-10-01',
        '2026-11-01',
      ),
    ).toBeNull();
    expect(
      buildManualRates(
        [{ ...c[0]!, childAges: [{ min: 2, maxExclusive: 18 }] }],
        '100',
        'EUR',
        '2026-10-01',
        '2026-11-01',
      ),
    ).toBeNull();
    expect(
      buildManualRates(c, '', 'EUR', '2026-10-01', '2026-11-01'),
    ).toBeNull();
    expect(
      buildManualRates(c, '100', 'EUR', '2026-02-30', '2026-11-01'),
    ).toBeNull();
  });
  it('retimes only manual tariffs and never alters source imports', () => {
    const manual = build()![0]!;
    const imported = { ...manual };
    delete imported.manualPricing;
    delete imported.saleAmount;
    const rates = retimeManualRates(
      [manual, imported],
      '2026-11-01',
      '2026-12-01',
    );
    expect(rates[0]?.startsOn).toBe('2026-11-01');
    expect(rates[0]?.amount).toBe(manual.amount);
    expect(rates[1]).toBe(imported);
    expect(manual.startsOn).toBe('2026-10-01');
  });
});
