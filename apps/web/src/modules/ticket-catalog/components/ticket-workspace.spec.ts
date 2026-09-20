import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ProductInput, Reference } from '../model/catalog';
import { flightOfferInput } from './ticket-workspace';

describe('ticket workspace entry points', () => {
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
