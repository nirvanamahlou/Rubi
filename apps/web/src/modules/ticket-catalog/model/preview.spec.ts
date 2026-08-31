import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  initialQuery,
  previewSamples,
  queryProducts,
  replacePreview,
} from './preview';
describe('Preview isolation and query', () => {
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
  it('paginates, filters and sorts the same collection', () => {
    expect(queryProducts(samples, initialQuery).rows).toHaveLength(6);
    expect(
      queryProducts(samples, { ...initialQuery, page: 2 }).rows,
    ).toHaveLength(2);
    expect(
      queryProducts(samples, { ...initialQuery, supply: 'company' }).total,
    ).toBe(4);
    expect(
      queryProducts(samples, { ...initialQuery, search: 'DEMO-3' }).rows[0]?.id,
    ).toBe('preview-sample-2');
    expect(
      queryProducts(samples, { ...initialQuery, direction: 'desc' }).rows[0]
        ?.id,
    ).toBe('preview-sample-7');
    expect(
      queryProducts(samples, { ...initialQuery, status: 'active' }).total,
    ).toBe(0);
    expect(
      queryProducts(samples, {
        ...initialQuery,
        from: '2026-09-08',
        to: '2026-09-08',
      }).total,
    ).toBe(1);
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
  it('rejects stale preview edits and duplicate identity', () => {
    expect(() => replacePreview(samples, samples[0]!)).toThrow('Conflict');
    expect(() => replacePreview(samples, samples[0]!, 0)).toThrow('Conflict');
  });
});
