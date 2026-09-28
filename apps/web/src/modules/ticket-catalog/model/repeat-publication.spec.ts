import { describe, expect, it } from 'vitest';
import {
  previewSamples,
  selectableSupply,
  supplyOptions,
  queryProducts,
  initialQuery,
} from './preview';
import {
  repeatedDefinitions,
  publishRepeatedProducts,
} from './repeat-publication';

describe('Repeated ticket publication', () => {
  const source = previewSamples('2026-08-31T00:00:00.000Z')[0]!.definition;
  it('counts the chosen start as ticket one and preserves weekly weekday and travel duration', () => {
    const one = repeatedDefinitions(source, '2026-10-05', 'weekly', 1);
    const two = repeatedDefinitions(source, '2026-10-05', 'weekly', 2);
    expect(one.map((x) => x.serviceDate)).toEqual(['2026-10-05']);
    expect(two.map((x) => x.serviceDate)).toEqual(['2026-10-05', '2026-10-12']);
    const departures = two.map((x) => Date.parse(x.segments[0]!.departureAt));
    expect(departures[1]! - departures[0]!).toBe(7 * 86400000);
    expect(
      two.map(
        (x) =>
          Date.parse(x.segments[0]!.arrivalAt) -
          Date.parse(x.segments[0]!.departureAt),
      ),
    ).toEqual([
      Date.parse(source.segments[0]!.arrivalAt) -
        Date.parse(source.segments[0]!.departureAt),
      Date.parse(source.segments[0]!.arrivalAt) -
        Date.parse(source.segments[0]!.departureAt),
    ]);
  });
  it('keeps each successful ticket visible and reuses the same IDs after a partial failure', async () => {
    const items = [{ id: 'first' }, { id: 'second' }];
    const completed = new Set<string>();
    const visible: string[] = [];
    const requests: string[] = [];
    await expect(
      publishRepeatedProducts(
        items,
        completed,
        async (item) => {
          requests.push(item.id);
          if (item.id === 'second') throw new Error('offline');
        },
        (item) => visible.push(item.id),
      ),
    ).rejects.toThrow('offline');
    expect(visible).toEqual(['first']);
    await publishRepeatedProducts(
      items,
      completed,
      async (item) => {
        requests.push(item.id);
      },
      (item) => visible.push(item.id),
    );
    expect(requests).toEqual(['first', 'second', 'second']);
    expect(visible).toEqual(['first', 'second']);
  });
  it('rejects invalid counts before making any ticket', () => {
    for (const count of [0, 25, 1.5, NaN])
      expect(() =>
        repeatedDefinitions(source, '2026-10-05', 'weekly', count),
      ).toThrow();
  });
  it('offers exactly three supply choices while retaining old charter records under floating', () => {
    expect(Object.values(supplyOptions)).toEqual([
      'شناوری',
      'ظرفیت شرکت',
      'API',
    ]);
    expect(selectableSupply('charter')).toBe('allotment');
    const product = structuredClone(
      previewSamples('2026-08-31T00:00:00.000Z')[0]!,
    );
    product.definition.supplyType = 'charter';
    expect(
      queryProducts([product], { ...initialQuery, supply: 'allotment' }).total,
    ).toBe(1);
  });
});
