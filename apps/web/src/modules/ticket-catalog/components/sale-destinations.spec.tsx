import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { emptyInput } from '../model/preview';
import {
  catalogProductsFromOffers,
  publishedOfferInput,
} from '../model/published-catalog';
import { FlightScheduleForm } from './flight-schedule-form';
import { createReturnTicketDraft } from './ticket-form';
import { flightOfferInput } from './ticket-workspace';
import type { TicketOfferV1 } from '@nora/contracts';

describe('multiple sales destinations for one load', () => {
  const routes = [{ originId: 'origin', destinationId: 'bodrum' }];
  const offer: TicketOfferV1 = {
    id: 'shared',
    version: 1,
    branchId: 'branch',
    originId: 'origin',
    destinationId: 'kusadasi',
    departureAt: '2099-01-01T10:00:00Z',
    arrivalAt: '2099-01-01T12:00:00Z',
    carrierName: 'Synthetic',
    serviceNumber: 'QA',
    cabinClassCode: 'ECONOMY',
    totalCapacity: 30,
    remainingCapacity: 27,
    status: 'ACTIVE',
    saleRoutes: routes,
  };
  it('restores all commercial routes from the server and publishes one offer per dated flight', () => {
    const refs = [
      {
        id: 'airline',
        kind: 'airline' as const,
        name: 'Synthetic',
        active: true,
      },
      {
        id: 'cabin',
        kind: 'flightClass' as const,
        name: 'ECONOMY',
        code: 'ECONOMY',
        active: true,
      },
    ];
    const products = catalogProductsFromOffers([], [offer], refs);
    expect(products).toHaveLength(1);
    const input = flightOfferInput(products[0]!.definition, refs)!;
    expect(input).toMatchObject({
      originId: 'origin',
      destinationId: 'kusadasi',
      totalCapacity: 30,
      saleRoutes: routes,
    });
    expect(publishedOfferInput(offer).saleRoutes).toEqual(routes);
    const back = createReturnTicketDraft(products[0]!.definition);
    expect(back.saleRoutes).toEqual([
      { originId: 'bodrum', destinationId: 'origin' },
    ]);
    expect(products[0]!.definition.saleRoutes).toEqual(routes);
  });
  it('renders the optional destination control and the shared-capacity explanation for restored routes', () => {
    const initial = {
      ...emptyInput(),
      saleRoutes: routes,
      segments: [
        {
          ...emptyInput().segments[0]!,
          departureAt: '2099-01-01T10:00:00Z',
          arrivalAt: '2099-01-01T12:00:00Z',
        },
      ],
    };
    const html = renderToStaticMarkup(
      createElement(FlightScheduleForm, {
        initial,
        references: [],
        onReference: () => {},
        onSave: () => {},
        onCancel: () => {},
      }),
    );
    expect(html).toContain('افزودن مقصد');
    expect(html).toContain('همه مقصدها از ظرفیت همین پرواز استفاده می‌کنند.');
    expect(html).toContain('sale-destination-0');
  });
});
