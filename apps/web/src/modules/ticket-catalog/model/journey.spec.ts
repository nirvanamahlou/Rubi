import { describe, expect, it } from 'vitest';
import { previewSamples } from './preview';
import {
  compatibleReturn,
  composePreviewJourney,
  previewTripCandidates,
} from './journey';
import type { Product } from './catalog';

function pair(): Product[] {
  const rows = previewSamples('2026-08-31T00:00:00Z').slice(0, 2);
  return rows.map((p, index) => ({
    ...p,
    definition: {
      ...p.definition,
      segments: p.definition.segments.map((s) => ({
        ...s,
        originCountryId: 'country',
        destinationCountryId: 'country',
        originCityId: index ? 'city-b' : 'city-a',
        destinationCityId: index ? 'city-a' : 'city-b',
      })),
    },
  }));
}
const pick = (p: Product) => ({ productId: p.id, productVersion: p.version });

describe('Independent ticket journey proposal', () => {
  it('references two existing products without copying inventory or adding a sale price', () => {
    const rows = pair();
    const before = JSON.stringify(rows);
    const result = composePreviewJourney(
      rows,
      'round-trip',
      pick(rows[0]!),
      pick(rows[1]!),
    );
    expect(result).toEqual({
      type: 'round-trip',
      legs: rows.map(pick),
      pricingOwner: 'sales',
      previewOnly: true,
    });
    expect(JSON.stringify(rows)).toBe(before);
  });
  it('allows either leg to be selected independently as one-way', () => {
    const rows = pair();
    for (const p of rows)
      expect(composePreviewJourney(rows, 'one-way', pick(p)).legs).toEqual([
        pick(p),
      ]);
  });
  it('filters return candidates by opposite route and later departure', () => {
    const rows = pair();
    expect(previewTripCandidates(rows, rows[0])).toEqual([rows[1]]);
    expect(previewTripCandidates(rows, rows[1])).toEqual([]);
  });
  it('rejects the same product as both legs and requires return selection', () => {
    const rows = pair();
    expect(() =>
      composePreviewJourney(rows, 'round-trip', pick(rows[0]!), pick(rows[0]!)),
    ).toThrow();
    expect(() =>
      composePreviewJourney(rows, 'round-trip', pick(rows[0]!)),
    ).toThrow();
  });
  it('rejects a stale product version and deleted selection', () => {
    const rows = pair();
    expect(() =>
      composePreviewJourney(rows, 'one-way', {
        ...pick(rows[0]!),
        productVersion: 99,
      }),
    ).toThrow('تغییر');
    expect(() =>
      composePreviewJourney([], 'one-way', pick(rows[0]!)),
    ).toThrow();
  });
  it('rejects return route mismatch and missing endpoint identities', () => {
    const rows = pair();
    const other = structuredClone(rows[1]!);
    other.definition.segments = [
      { ...other.definition.segments[0]!, originCityId: 'unrelated-city' },
    ];
    expect(compatibleReturn(rows[0]!, other)).toBe(false);
    const unknown = previewSamples('2026-08-31T00:00:00Z');
    expect(compatibleReturn(unknown[0]!, unknown[1]!)).toBe(false);
  });
  it('rejects a return departing at or before the outbound arrival', () => {
    const rows = pair();
    const early = structuredClone(rows[1]!);
    early.definition.segments = [
      {
        ...early.definition.segments[0]!,
        departureAt: rows[0]!.definition.segments[0]!.arrivalAt,
      },
    ];
    expect(compatibleReturn(rows[0]!, early)).toBe(false);
  });
  it.each(['paused', 'cancelled'] as const)('excludes a %s leg', (status) => {
    const rows = pair();
    rows[1] = { ...rows[1]!, status };
    expect(previewTripCandidates(rows, rows[0])).toEqual([]);
    expect(() =>
      composePreviewJourney(rows, 'one-way', pick(rows[1]!)),
    ).toThrow();
  });
  it('does not retain a hidden return after switching to one-way', () => {
    const rows = pair();
    expect(() =>
      composePreviewJourney(rows, 'one-way', pick(rows[0]!), pick(rows[1]!)),
    ).toThrow();
  });
});
