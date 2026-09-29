import { describe, it, expect } from 'vitest';
import type { TicketOfferV1 } from '@nora/contracts';
import type { Product } from './catalog';
import { emptyInput, initialQuery, queryProducts } from './preview';
import { catalogProductsFromOffers, catalogOffer } from './published-catalog';
const offers = Array.from(
  { length: 10 },
  (_, index) =>
    ({
      id: String(index),
      catalogProductId: 'cached-' + index,
      version: 3,
      branchId: 'branch',
      originId: 'a',
      destinationId: 'b',
      departureAt: '2099-10-01T10:00:00Z',
      arrivalAt: '2099-10-01T12:00:00Z',
      carrierName: 'Carrier',
      serviceNumber: '4512',
      cabinClassCode: 'ECONOMY',
      totalCapacity: 50,
      remainingCapacity: 49,
      status: index === 0 ? 'PAUSED' : 'ACTIVE',
    }) as TicketOfferV1,
);
const local = Array.from(
  { length: 4 },
  (_, index) =>
    ({
      id: 'cached-' + index,
      version: 1,
      status: 'active',
      definition: emptyInput(),
      fares: [],
      definitions: [],
      history: [],
    }) as Product,
);
describe('authoritative ticket catalog', () => {
  it('renders ten separate server tickets with four cached definitions, including identical schedules', () => {
    const products = catalogProductsFromOffers(local, offers, []);
    expect(products).toHaveLength(10);
    expect(new Set(products.map((p) => p.id)).size).toBe(10);
    expect(products[0]?.status).toBe('paused');
    expect(products[0]?.definition.totalCapacity).toBe(50);
    expect(catalogOffer(products[0]!, offers)?.remainingCapacity).toBe(49);
    expect(local[0]?.definition.totalCapacity).toBe(0);
    expect(
      queryProducts(products, { ...initialQuery, sort: 'updated' }).total,
    ).toBe(10);
    expect(
      queryProducts(products, { ...initialQuery, sort: 'updated' }, 12).rows,
    ).toHaveLength(10);
  });
  it('works in a fresh browser and removes archived server tickets without resurrecting cached copies', () => {
    expect(catalogProductsFromOffers([], offers, [])).toHaveLength(10);
    expect(catalogProductsFromOffers(local, offers.slice(1), [])).toHaveLength(
      9,
    );
    expect(catalogProductsFromOffers(local, [], [])).toHaveLength(0);
  });
  it('preserves local ground products and extra metadata only for the exact catalog source identity', () => {
    const ground = {
      ...local[0]!,
      id: 'train',
      definition: { ...emptyInput(), transport: 'train' as const },
    };
    const products = catalogProductsFromOffers([...local, ground], offers, []);
    expect(products).toHaveLength(11);
    expect(products.at(-1)).toBe(ground);
  });
});
