import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { TicketOfferCreateV1 } from '@nora/contracts';
import {
  findPublishedOffer,
  planCatalogPublication,
  flightOfferInput,
  requireFutureTicketDates,
} from './ticket-workspace';
import { emptyInput } from '../model/preview';
import type { Product, ProductInput, Reference } from '../model/catalog';

describe('ticket workspace entry points', () => {
  it('requires future dates by default and permits them only with the historical opt-in', () => {
    const input = {
      departureAt: '2026-10-01T08:00:00.000Z',
    } as TicketOfferCreateV1;
    const now = new Date('2026-10-10T00:00:00.000Z');

    expect(() => requireFutureTicketDates([input], false, now)).toThrow(
      'باید در آینده باشد',
    );
    expect(() => requireFutureTicketDates([input], true, now)).not.toThrow();
  });

  it('renders the historical-date opt-in in both ticket-definition paths', () => {
    const advanced = readFileSync(
      new URL('./ticket-form.tsx', import.meta.url),
      'utf8',
    );
    const weekly = readFileSync(
      new URL('./flight-schedule-form.tsx', import.meta.url),
      'utf8',
    );
    expect(advanced).toContain('تاریخ گذشته');
    expect(weekly).toContain('تاریخ گذشته');
    expect(advanced).toContain(
      'onSave(cabinInputs(definition), reason, allowPastDate)',
    );
    expect(weekly).toContain("'تعریف برنامه هفتگی پرواز'");
    expect(weekly).toContain("'ویرایش لود پرواز'");
    expect(weekly).toContain('allowPastDate');
  });

  it('exposes safe load edit and archive beside the authoritative view', () => {
    const source = readFileSync(
      new URL('./ticket-workspace.tsx', import.meta.url),
      'utf8',
    );
    expect(source).toContain('toursApi.archiveOfferBatch(');
    expect(source).toContain('toursApi.reviseOfferBatch(');
    expect(source).toContain('publishedLoadGroup(');
    expect(source).toContain('ویرایش کل لود');
    expect(source).toContain('حذف کل لود');
    expect(source).toContain(
      "setForm({ mode: 'edit', product, products: grouped, offers })",
    );
    expect(source).toContain('catalogOffer(current, publishedOffers)');
    expect(source).toContain('currentPublishedOffer.version');
    expect(source).toContain('initial={form.product?.definition}');
    expect(source).toContain("editing={form.mode === 'edit'}");
    expect(source).toContain('formStyles.scheduleDialog');
    expect(source).toContain('سوابق قیمت، خرید، مالی و ممیزی باقی می‌مانند');
    expect(source).toContain('updatePublishedStatus');
  });
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
    expect(source).not.toContain("from './tour-workspace'");
    expect(source).not.toContain('value="tours"');
    expect(source).toContain('managedOffers()');
    expect(source).toContain(
      'publishFlights(inputs, createdIds, allowPastDate)',
    );
    expect(source).toContain('publishExistingFlights(');
    expect(source).toContain('`ticket-catalog:${product.id}`');
    expect(source).toContain('backfillStarted.current');
    expect(source).toContain('repeatedDefinitions(');
    expect(source).toContain('publishRepeatedProducts(');
    expect(source).toContain('setRepeat(');
    expect(source).not.toContain('removedPriceRevisions');
    expect(source).not.toContain('updateStandaloneSalePrice(');
    expect(source).toContain('updateOfferStatus(');
    expect(source).not.toContain('listActiveCurrencyReferences()');
    expect(source).toContain('<SelectItem');
    expect(source).not.toContain('maxLength={3}');
    expect(source).not.toContain('بلیط‌های ثبت‌شده برای فروش و قرارداد');
    expect(source).toContain('renderActions={renderOfferActions}');
    expect(source).toContain('setOfferForm({ offer, readOnly: true })');
    expect(source).toContain('updateCapacityHold({');
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
