import type { TicketOfferV1 } from '@nora/contracts';
import {
  asReference,
  getTicketReference,
  listReferences,
} from '../api/references';
import type { PublishedResource } from '../api/references';
import type { Reference } from './catalog';
import { flightCabinCode } from './flight-cabins';

const carrierKey = (name: string) =>
  name.trim().replace(/\s+/g, ' ').toLowerCase();

export async function loadEditReferences(
  offers: readonly TicketOfferV1[],
  cached: readonly Reference[],
): Promise<Reference[]> {
  const rows = new Map(cached.map((ref) => [`${ref.kind}:${ref.id}`, ref]));
  const add = (ref: Reference | undefined) => {
    if (ref) rows.set(`${ref.kind}:${ref.id}`, ref);
  };
  const detail = async (
    resource: PublishedResource,
    kind: Reference['kind'],
    id: string,
  ) => {
    const saved = rows.get(`${kind}:${id}`);
    if (saved && (kind !== 'city' || saved.countryId)) return;
    add(await getTicketReference(resource, id));
  };
  const search = async (
    resource: PublishedResource,
    query: string,
    match: (ref: Reference) => boolean,
  ) => {
    if ([...rows.values()].some(match)) return;
    for (let page = 1; page <= 100; page++) {
      const response = await listReferences(resource, query, page);
      const ref = response.data
        .map(asReference)
        .find((item) => item && match(item));
      if (ref) {
        add(ref);
        return;
      }
      if (page * response.meta.pageSize >= response.meta.total) return;
    }
  };
  const cities = new Set(
    offers.flatMap((offer) => [
      offer.originId,
      offer.destinationId,
      ...(offer.saleRoutes ?? []).flatMap((route) => [
        route.originId,
        route.destinationId,
      ]),
    ]),
  );
  const airports = new Set(
    offers.flatMap((offer) => [
      offer.originAirportId,
      offer.destinationAirportId,
    ]),
  );
  const aircraft = new Set(offers.map((offer) => offer.aircraftTypeId));
  const carriers = new Set(
    offers.map((offer) => offer.carrierName.split('/')[0]?.trim() ?? ''),
  );
  const cabins = new Set(offers.map((offer) => offer.cabinClassCode));
  await Promise.all([
    ...[...cities].map((id) => detail('cities', 'city', id)),
    ...[...airports].flatMap((id) =>
      id ? [detail('airports', 'airport', id)] : [],
    ),
    ...[...aircraft].flatMap((id) =>
      id ? [detail('aircraft-types', 'aircraft', id)] : [],
    ),
    ...[...carriers].map((name) =>
      search(
        'airlines',
        name,
        (ref) =>
          ref.active &&
          ref.kind === 'airline' &&
          carrierKey(ref.name) === carrierKey(name),
      ),
    ),
    ...[...cabins].map((code) =>
      search(
        'cabin-classes',
        '',
        (ref) =>
          ref.active &&
          ref.kind === 'flightClass' &&
          flightCabinCode(ref) === code,
      ),
    ),
  ]);
  const countries = new Set(
    [...cities].map((id) => rows.get(`city:${id}`)?.countryId),
  );
  await Promise.all(
    [...countries].flatMap((id) =>
      id ? [detail('countries', 'country', id)] : [],
    ),
  );
  return [...rows.values()];
}
