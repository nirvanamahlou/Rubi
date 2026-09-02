import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  activateCatalogSample,
  catalogStorageKey,
  countProductsByRoute,
  groupProductsForCards,
  initialQuery,
  moveDefinitionToDate,
  parseCatalogSnapshot,
  previewSamples,
  queryProducts,
  repeatDefinition,
  replacePreview,
} from './preview';

describe('Ticket catalog browser collection and query', () => {
  const samples = previewSamples('2026-08-31T00:00:00.000Z');
  it('keeps local core identical to the domain proposal until public-contract handoff', () => {
    const web = readFileSync(new URL('./catalog.ts', import.meta.url), 'utf8');
    const api = readFileSync(
      new URL(
        '../../../../../api/src/ticket-catalog/domain/catalog.ts',
        import.meta.url,
      ),
      'utf8',
    );
    expect(web.replace(/\r\n/g, '\n')).toBe(api.replace(/\r\n/g, '\n'));
  });
  it('includes one-way and paired flight, train and bus samples', () => {
    expect(samples).toHaveLength(9);
    expect(new Set(samples.map((p) => p.definition.transport))).toEqual(
      new Set(['flight', 'train', 'bus']),
    );
    expect(
      samples.filter((p) => p.definition.journeyRole === 'one-way'),
    ).toHaveLength(3);
    expect(
      samples.filter((p) => p.definition.journeyRole === 'outbound'),
    ).toHaveLength(3);
    expect(
      samples.filter((p) => p.definition.journeyRole === 'return'),
    ).toHaveLength(3);
  });
  it('paginates, filters and sorts the same collection', () => {
    expect(queryProducts(samples, initialQuery).rows).toHaveLength(6);
    expect(
      queryProducts(samples, { ...initialQuery, page: 2 }).rows,
    ).toHaveLength(3);
    expect(
      queryProducts(samples, { ...initialQuery, supply: 'company' }).total,
    ).toBe(3);
    expect(
      queryProducts(samples, { ...initialQuery, transport: 'train' }).total,
    ).toBe(3);
    expect(
      queryProducts(samples, { ...initialQuery, search: 'W5-1042' }).rows[0]
        ?.id,
    ).toBe('sample-ticket-1');
    expect(
      queryProducts(samples, { ...initialQuery, direction: 'desc' }).rows[0]
        ?.id,
    ).toBe('sample-ticket-5');
    expect(
      queryProducts(samples, { ...initialQuery, status: 'active' }).total,
    ).toBe(9);
    expect(
      queryProducts(samples, {
        ...initialQuery,
        from: '2026-09-08',
        to: '2026-09-08',
      }).total,
    ).toBe(1);
    const route = samples[0]!.definition.segments[0]!;
    expect(
      queryProducts(samples, {
        ...initialQuery,
        originCityId: route.originCityId,
        destinationCityId: route.destinationCityId,
      }).total,
    ).toBeGreaterThan(0);
    expect(
      queryProducts(samples, {
        ...initialQuery,
        originCityId: route.destinationCityId,
        destinationCityId: route.originCityId,
      }).rows.every(
        (product) =>
          product.definition.segments[0]!.originCityId ===
            route.destinationCityId &&
          product.definition.segments[0]!.destinationCityId ===
            route.originCityId,
      ),
    ).toBe(true);
  });
  it('counts every catalog product once under its route', () => {
    const routes = countProductsByRoute(samples);
    expect(routes.reduce((sum, route) => sum + route.count, 0)).toBe(
      samples.length,
    );
    expect(routes.every((route) => route.origin && route.destination)).toBe(
      true,
    );
  });
  it('anchors the first repeated ticket on the selected date and keeps times', () => {
    const source = samples[0]!.definition;
    const moved = moveDefinitionToDate(source, '2026-10-05');
    expect(moved.segments[0]!.departureAt.slice(0, 10)).toBe('2026-10-05');
    expect(moved.segments[0]!.departureAt.slice(11)).toBe(
      source.segments[0]!.departureAt.slice(11),
    );
    expect(
      Date.parse(moved.segments[0]!.arrivalAt) -
        Date.parse(moved.segments[0]!.departureAt),
    ).toBe(
      Date.parse(source.segments[0]!.arrivalAt) -
        Date.parse(source.segments[0]!.departureAt),
    );
  });
  it('shifts all schedule and fare dates for weekly and monthly repeats', () => {
    const source = samples[0]!.definition;
    const weekly = repeatDefinition(source, 'weekly', 2);
    const monthly = repeatDefinition(source, 'monthly', 1);
    expect(
      Date.parse(weekly.segments[0]!.departureAt) -
        Date.parse(source.segments[0]!.departureAt),
    ).toBe(14 * 86_400_000);
    expect(new Date(monthly.segments[0]!.departureAt).getUTCMonth()).toBe(
      (new Date(source.segments[0]!.departureAt).getUTCMonth() + 1) % 12,
    );
    expect(weekly.journeyRole).toBe('one-way');
    expect(weekly.tripGroupId).toBeUndefined();
  });
  it('keeps round-trip products together and activates browser samples', () => {
    const groups = groupProductsForCards(samples);
    expect(groups.filter((group) => group.length === 2)).toHaveLength(3);
    expect(
      groups
        .filter((group) => group.length === 2)
        .every(
          (group) =>
            group[0]!.definition.journeyRole === 'outbound' &&
            group[1]!.definition.journeyRole === 'return',
        ),
    ).toBe(true);
    expect(samples.every((product) => product.status === 'active')).toBe(true);
    expect(activateCatalogSample(samples[0]!, '2026-09-02T00:00:00.000Z')).toBe(
      samples[0],
    );
  });
  it('round-trips valid browser storage and rejects malformed data', () => {
    const raw = JSON.stringify({ products: samples, references: [] });
    expect(parseCatalogSnapshot(raw)?.products).toHaveLength(9);
    expect(parseCatalogSnapshot('{broken')).toBeUndefined();
    expect(
      parseCatalogSnapshot(JSON.stringify({ products: [{}], references: [] })),
    ).toBeUndefined();
    expect(catalogStorageKey).toContain('ticket-catalog');
  });
  it('does not fabricate master IDs or actual reservation counters', () => {
    expect(
      samples.every(
        (p) =>
          !p.definition.segments[0]!.airlineId &&
          !p.definition.segments[0]!.originAirportId,
      ),
    ).toBe(true);
    expect(JSON.stringify(samples)).not.toMatch(
      /pnr|passenger|confirmed|held/i,
    );
  });
  it('rejects stale edits and duplicate identity', () => {
    expect(() => replacePreview(samples, samples[0]!)).toThrow('Conflict');
    expect(() => replacePreview(samples, samples[0]!, 0)).toThrow('Conflict');
  });
});
