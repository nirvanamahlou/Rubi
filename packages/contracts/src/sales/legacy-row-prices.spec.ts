import { expect, it } from 'vitest';
import {
  LEGACY_ROW_PRICES,
  legacyPricingRows,
  legacyRowPriceTotals,
  readLegacyRowPrices,
} from './legacy-row-prices';
import type { SalesServiceInput } from './index';
const base: SalesServiceInput[] = [
  {
    clientKey: 'hotel',
    kind: 'HOTEL',
    titleSnapshot: 'Synthetic',
    metadata: {
      legacyServicePartiesV2: JSON.stringify({
        hotel: { adults: 2, children: 1, infants: 1 },
      }),
    },
  },
];
const gross = Object.fromEntries(
  legacyPricingRows(base).map((r, i) => [
    r.key,
    [{ currencyCode: 'USD', amount: i === 0 ? '100.1234' : '0' }],
  ]),
);
function services(value: unknown): SalesServiceInput[] {
  return [
    {
      ...base[0]!,
      metadata: {
        ...base[0]!.metadata,
        [LEGACY_ROW_PRICES]: JSON.stringify(value),
      },
    },
  ];
}
it('reads age-count ordinals and exact net amounts without identities', () => {
  const s = services({
    gross,
    deductions: {
      'legacy-ADT-1': { discount: { currencyCode: 'USD', amount: '0.1234' } },
    },
  });
  expect(legacyRowPriceTotals(s)).toEqual([
    { currencyCode: 'USD', amount: '100' },
  ]);
  expect(readLegacyRowPrices(JSON.parse(JSON.stringify(s)))?.gross).toEqual(
    gross,
  );
  expect(legacyPricingRows(s).map((r) => r.ageCategory)).toEqual([
    'ADT',
    'ADT',
    'CHD',
    'INF',
  ]);
});
it('rejects missing/extra/wrong-amount rows, excessive deductions and nonlegacy markers', () => {
  for (const bad of [
    { gross: {}, deductions: {} },
    {
      gross: { ...gross, extra: [{ currencyCode: 'USD', amount: '1' }] },
      deductions: {},
    },
    {
      gross: {
        ...gross,
        'legacy-ADT-1': [{ currencyCode: 'USD', amount: '-1' }],
      },
      deductions: {},
    },
    {
      gross,
      deductions: {
        'legacy-ADT-1': { commission: { currencyCode: 'USD', amount: '200' } },
      },
    },
  ])
    expect(() => readLegacyRowPrices(services(bad))).toThrow();
  expect(() =>
    readLegacyRowPrices([
      {
        ...base[0]!,
        metadata: {
          [LEGACY_ROW_PRICES]: JSON.stringify({ gross, deductions: {} }),
        },
      },
    ]),
  ).toThrow();
  expect(readLegacyRowPrices(base)).toBeNull();
});
