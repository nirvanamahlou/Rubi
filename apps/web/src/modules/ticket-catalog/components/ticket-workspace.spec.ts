import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  findPublishedOffer,
  planCatalogPublication,
  flightOfferInput,
} from './ticket-workspace';
import { emptyInput } from '../model/preview';
import type { Product, ProductInput, Reference } from '../model/catalog';

describe('ticket workspace entry points', () => {
  it('matches the browser card to the authoritative published offer', () => {
    const definition = emptyInput();
    definition.totalCapacity = 50;
    definition.flightClassId = 'class';
    definition.segments = [
      {
        ...definition.segments[0]!,
        airlineId: 'airline',
        flightNumber: '4512',
        originCityId: 'origin',
        destinationCityId: 'destination',
        departureAt: '2099-09-02T17:50:00.000Z',
        arrivalAt: '2099-09-02T20:50:00.000Z',
      },
    ];
    const references: Reference[] = [
      { id: 'airline', kind: 'airline', name: 'ایران ایرتور', active: true },
      { id: 'class', kind: 'flightClass', name: 'Economy', active: true },
    ];
    const offer = {
      id: 'offer-4512',
      version: 2,
      branchId: 'branch',
      originId: 'origin',
      destinationId: 'destination',
      departureAt: '2099-09-02T17:50:00.000Z',
      arrivalAt: '2099-09-02T20:50:00.000Z',
      carrierName: 'ایران ایرتور',
      serviceNumber: '4512',
      cabinClassCode: 'ECONOMY',
      totalCapacity: 50,
      remainingCapacity: 50,
      status: 'PAUSED',
    } as const;

    expect(findPublishedOffer(definition, references, [offer])).toBe(offer);
  });

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
        departureAt: '2099-09-22T04:00:00.000Z',
        arrivalAt: '2099-09-22T07:00:00.000Z',
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
            departureAt: '2099-09-29T04:00:00.000Z',
            arrivalAt: '2099-09-29T07:00:00.000Z',
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
    expect(source).toContain('publishFlights(inputs, createdIds)');
    expect(source).toContain('publishExistingFlights(');
    expect(source).toContain('`ticket-catalog:${product.id}`');
    expect(source).toContain('backfillStarted.current');
    expect(source).toContain('repeatDefinition(');
    expect(source).toContain('setRepeat(');
    expect(source).toContain('قیمت فروش تکی هر صندلی');
    expect(source).toContain('updateStandaloneSalePrice(');
    expect(source).toContain('updateOfferStatus(');
    expect(source).toContain("? 'منقضی'");
    expect(source).toContain('listActiveCurrencyReferences()');
    expect(source).toContain('<SelectItem');
    expect(source).not.toContain('maxLength={3}');
    expect(source).toContain(
      'className="block whitespace-nowrap text-right tabular-nums"',
    );
  });

  it('publishes a multi-segment flight as one complete contract offer', () => {
    const references: Reference[] = [
      { id: 'airline-1', kind: 'airline', name: 'Carrier One', active: true },
      { id: 'airline-2', kind: 'airline', name: 'Carrier Two', active: true },
      {
        id: 'class-1',
        kind: 'flightClass',
        name: 'Business',
        active: true,
      },
    ];
    const segment = {
      airlineId: 'airline-1',
      aircraftId: '',
      flightNumber: 'C1-10',
      originCountryId: '',
      originCityId: '10000000-0000-4000-8000-000000000001',
      destinationCountryId: '',
      destinationCityId: '10000000-0000-4000-8000-000000000002',
      originAirportId: '',
      destinationAirportId: '',
      departureAt: '2026-10-01T08:00:00.000Z',
      arrivalAt: '2026-10-01T10:00:00.000Z',
      departureZone: 'UTC',
      arrivalZone: 'UTC',
      originTerminal: '',
      destinationTerminal: '',
    };
    const definition = {
      title: 'Connecting flight',
      transport: 'flight',
      journeyRole: 'one-way',
      segments: [
        segment,
        {
          ...segment,
          airlineId: 'airline-2',
          flightNumber: 'C2-20',
          originCityId: segment.destinationCityId,
          destinationCityId: '10000000-0000-4000-8000-000000000003',
          departureAt: '2026-10-01T11:00:00.000Z',
          arrivalAt: '2026-10-01T13:30:00.000Z',
        },
      ],
      flightClassId: 'class-1',
      baggageId: '',
      supplyType: 'company',
      companyOwned: true,
      entryMethod: 'manual',
      totalCapacity: 12,
      rules: '',
      fare: {
        purchase: '0',
        fee: '0',
        commission: '0',
        currencyId: '',
        currencyCode: 'IRR',
        validFrom: '',
        validTo: '',
      },
    } satisfies ProductInput;

    expect(flightOfferInput(definition, references)).toEqual(
      expect.objectContaining({
        originId: '10000000-0000-4000-8000-000000000001',
        destinationId: '10000000-0000-4000-8000-000000000003',
        departureAt: '2026-10-01T08:00:00.000Z',
        arrivalAt: '2026-10-01T13:30:00.000Z',
        carrierName: 'Carrier One / Carrier Two',
        serviceNumber: 'C1-10 / C2-20',
        cabinClassCode: 'BUSINESS',
        totalCapacity: 12,
      }),
    );
  });
});
