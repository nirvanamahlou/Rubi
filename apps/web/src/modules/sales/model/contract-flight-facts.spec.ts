import { describe, expect, it, vi } from 'vitest';
import { readContractFlightFacts } from './contract-flight-facts';
import { printFixture } from './contract-print.fixture';

describe('contract airport facts', () => {
  it('uses authorized Sales selections to resolve actual airport cities without editing commercial route snapshots', async () => {
    const before = structuredClone(printFixture);
    const get = vi.fn(async (path: string) => {
      if (path.includes('/document-details')) {
        const back = path.includes('/offer2/');
        return Response.json({
          data: {
            id: back ? 'offer2' : 'offer1',
            originId: back ? 'antalya' : 'tehran',
            destinationId: back ? 'tehran' : 'antalya',
            originAirportId: back ? 'gzp' : 'ika',
            destinationAirportId: back ? 'ika' : 'gzp',
          },
        });
      }
      if (path.includes('/airports/'))
        return Response.json({
          data: {
            name: 'Airport',
            code: path.endsWith('gzp') ? 'GZP' : 'IKA',
            attributes: {
              cityId: path.endsWith('gzp') ? 'gazipasa' : 'tehran',
            },
          },
        });
      return Response.json({
        data: {
          id: path.endsWith('gazipasa') ? 'gazipasa' : 'tehran',
          name: 'City',
          attributes: {
            englishName: path.endsWith('gazipasa') ? 'Gazipasa' : 'Tehran',
          },
        },
      });
    });
    const facts = await readContractFlightFacts(printFixture, get);
    expect(facts.offer1?.destinationAirport).toMatchObject({
      code: 'GZP',
      cityName: 'Gazipasa',
    });
    expect(get).toHaveBeenCalledWith(
      '/master-data/selections/sales/airports/gzp',
    );
    expect(get).toHaveBeenCalledWith(
      '/master-data/selections/sales/cities/gazipasa',
    );
    expect(printFixture).toEqual(before);
  });
  it('keeps legacy output available when optional airport facts cannot be read', async () => {
    expect(
      await readContractFlightFacts(
        printFixture,
        async () => new Response('{}', { status: 403 }),
      ),
    ).toEqual({});
  });
});
