import { describe, expect, it } from 'vitest';

import type { ReservationManifestTicketCardV1 } from '@nora/contracts';
import {
  filterManifestTickets,
  manifestDisplayDirection,
  manifestRouteChoices,
} from './manifest-ticket-filters';

const tickets: ReservationManifestTicketCardV1[] = [
  {
    offerId: 'tehran-antalya',
    direction: 'OUTBOUND',
    carrierName: 'Airline',
    serviceNumber: 'AB123',
    originName: 'تهران',
    destinationName: 'آنتالیا',
    departureAt: '2026-10-01T08:00:00.000Z',
    arrivalAt: '2026-10-01T10:00:00.000Z',
    contractCount: 1,
    passengerCount: 2,
    template: null,
    unavailableReason: 'Unavailable',
  },
  {
    offerId: 'tehran-istanbul',
    direction: 'OUTBOUND',
    carrierName: 'Airline',
    serviceNumber: 'AB456',
    originName: 'تهران',
    destinationName: 'استانبول',
    departureAt: '2026-10-01T09:00:00.000Z',
    arrivalAt: '2026-10-01T11:00:00.000Z',
    contractCount: 1,
    passengerCount: 1,
    template: null,
    unavailableReason: 'Unavailable',
  },
  {
    offerId: 'shiraz-antalya',
    direction: 'OUTBOUND',
    carrierName: 'Airline',
    serviceNumber: 'AB789',
    originName: 'شیراز',
    destinationName: 'آنتالیا',
    departureAt: '2026-10-01T12:00:00.000Z',
    arrivalAt: '2026-10-01T14:00:00.000Z',
    contractCount: 1,
    passengerCount: 3,
    template: null,
    unavailableReason: 'Unavailable',
  },
];

describe('manifest ticket route filters', () => {
  it('filters by origin and destination together while retaining all with no filters', () => {
    expect(filterManifestTickets(tickets, {})).toEqual(tickets);
    expect(
      filterManifestTickets(tickets, {
        originName: 'تهران',
        destinationName: 'آنتالیا',
      }).map(({ offerId }) => offerId),
    ).toEqual(['tehran-antalya']);
  });

  it('filters either endpoint independently and returns an empty match safely', () => {
    expect(
      filterManifestTickets(tickets, { originName: 'شیراز' }).map(
        ({ offerId }) => offerId,
      ),
    ).toEqual(['shiraz-antalya']);
    expect(
      filterManifestTickets(tickets, { destinationName: 'آنتالیا' }).map(
        ({ offerId }) => offerId,
      ),
    ).toEqual(['tehran-antalya', 'shiraz-antalya']);
    expect(
      filterManifestTickets(tickets, {
        originName: 'مشهد',
        destinationName: 'تهران',
      }),
    ).toEqual([]);
  });
});

it('includes the reverse return leg when searching the outbound route', () => {
  const returning = {
    ...tickets[0]!,
    offerId: 'return',
    direction: 'RETURN' as const,
    originName: 'آنتالیا',
    destinationName: 'تهران',
  };
  expect(
    filterManifestTickets([...tickets, returning], {
      originName: 'تهران',
      destinationName: 'آنتالیا',
    }).map((ticket) => ticket.offerId),
  ).toEqual(['tehran-antalya', 'return']);
});

it('orients outbound and return by the selected reverse city/country route without mutating stored direction', () => {
  const outbound = {
    ...tickets[0]!,
    originId: 'tehran',
    destinationId: 'antalya',
    originCountryId: 'ir',
    destinationCountryId: 'tr',
    originCountryName: 'ایران',
    destinationCountryName: 'ترکیه',
  };
  const returning = {
    ...outbound,
    offerId: 'return',
    direction: 'RETURN' as const,
    originId: 'antalya',
    destinationId: 'tehran',
    originCountryId: 'tr',
    destinationCountryId: 'ir',
    originCountryName: 'ترکیه',
    destinationCountryName: 'ایران',
    originName: 'آنتالیا',
    destinationName: 'تهران',
  };
  const filters = {
    originId: 'antalya',
    destinationId: 'tehran',
    originCountryId: 'tr',
    destinationCountryId: 'ir',
  };
  expect(
    filterManifestTickets([outbound, returning, tickets[1]!], filters),
  ).toEqual([outbound, returning]);
  expect(manifestDisplayDirection(returning, filters)).toBe('OUTBOUND');
  expect(manifestDisplayDirection(outbound, filters)).toBe('RETURN');
  expect(outbound.direction).toBe('OUTBOUND');
  expect(returning.direction).toBe('RETURN');
  expect(manifestDisplayDirection(returning, {})).toBe('RETURN');
  const choices = manifestRouteChoices([outbound], {
    originCountryId: 'tr',
    destinationCountryId: 'ir',
  });
  expect(choices.origins.map((c) => c.id)).toEqual(['antalya']);
  expect(choices.destinations.map((c) => c.id)).toEqual(['tehran']);
  expect(choices.countries.map((c) => c.id).sort()).toEqual(['ir', 'tr']);
  expect(filterManifestTickets(tickets, { originCountryId: 'tr' })).toEqual([]);
});

it('keeps Tehran to Antalya in outbound and Antalya to Tehran in return for the selected route', () => {
  const returning = {
    ...tickets[0]!,
    offerId: 'antalya-tehran',
    direction: 'RETURN' as const,
    originId: 'antalya',
    destinationId: 'tehran',
    originCountryId: 'tr',
    destinationCountryId: 'ir',
    originName: 'آنتالیا',
    destinationName: 'تهران',
  };
  const outbound = {
    ...tickets[0]!,
    originId: 'tehran',
    destinationId: 'antalya',
    originCountryId: 'ir',
    destinationCountryId: 'tr',
  };
  const filters = {
    originId: 'tehran',
    destinationId: 'antalya',
    originCountryId: 'ir',
    destinationCountryId: 'tr',
  };
  const visible = filterManifestTickets([outbound, tickets[1]!, returning], filters);
  expect(visible.map(({ offerId }) => offerId)).toEqual([
    'tehran-antalya',
    'antalya-tehran',
  ]);
  expect(
    visible.map((ticket) => manifestDisplayDirection(ticket, filters)),
  ).toEqual(['OUTBOUND', 'RETURN']);
});
