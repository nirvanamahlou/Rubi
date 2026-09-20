import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { planCatalogPublication } from './ticket-workspace';
import { emptyInput } from '../model/preview';
import type { Product, Reference } from '../model/catalog';

describe('ticket workspace entry points', () => {
  it('keeps valid outbound and return flights even when an earlier legacy ticket has no times', () => {
    const definition = emptyInput();
    definition.title = 'Valid flight';
    definition.segments = [
      {
        ...definition.segments[0]!,
        airlineId: 'airline',
        flightNumber: 'B9-100',
        originCityId: 'tehran',
        destinationCityId: 'antalya',
        departureAt: '2026-09-22T04:00:00.000Z',
        arrivalAt: '2026-09-22T07:00:00.000Z',
      },
    ];
    const product: Product = {
      id: 'ticket-outbound',
      version: 1,
      status: 'active',
      definition,
      fares: [],
      definitions: [],
      history: [],
    };
    const legacy: Product = {
      ...product,
      id: 'ticket-legacy',
      definition: emptyInput(),
    };
    const inbound: Product = {
      ...product,
      id: 'ticket-return',
      definition: {
        ...definition,
        journeyRole: 'return',
        segments: [
          {
            ...definition.segments[0]!,
            originCityId: 'antalya',
            destinationCityId: 'tehran',
            departureAt: '2026-09-29T04:00:00.000Z',
            arrivalAt: '2026-09-29T07:00:00.000Z',
          },
        ],
      },
    };
    const references: Reference[] = [
      { id: 'airline', kind: 'airline', name: 'IRAN AIRTOUR', active: true },
    ];
    const result = planCatalogPublication(
      [legacy, product, inbound],
      references,
    );
    expect(result.problems).toHaveLength(1);
    expect(result.publishable.map((item) => item.product.id)).toEqual([
      'ticket-outbound',
      'ticket-return',
    ]);
    expect(result.publishable[1]!.input.originId).toBe('antalya');
    expect(result.publishable[1]!.input.destinationId).toBe('tehran');
  });
  it('does not mount the scheduled-offer publisher and retains repeat operations', () => {
    const source = readFileSync(
      new URL('./ticket-workspace.tsx', import.meta.url),
      'utf8',
    );
    expect(source).not.toContain("from './published-offers'");
    expect(source).toContain('managedOffers()');
    expect(source).toContain('publishFlights(inputs)');
    expect(source).toContain('publishExistingFlights(');
    expect(source).toContain('`ticket-catalog:${product.id}`');
    expect(source).toContain('backfillStarted.current');
    expect(source).toContain('repeatDefinition(');
    expect(source).toContain('setRepeat(');
  });
});
