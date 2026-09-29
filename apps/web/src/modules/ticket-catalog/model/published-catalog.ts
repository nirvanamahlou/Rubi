import type { TicketOfferV1 } from '@nora/contracts';
import type { Product, Reference } from './catalog';
import { emptyInput } from './preview';
export function catalogProductsFromOffers(
  local: readonly Product[],
  offers: readonly TicketOfferV1[],
  references: readonly Reference[],
): Product[] {
  const used = new Set<string>();
  const flights = offers.map((offer) => {
    const cached = local.find(
      (product) =>
        !used.has(product.id) &&
        (offer.catalogProductId === product.id ||
          product.id === 'offer:' + offer.id),
    );
    if (cached) used.add(cached.id);
    const definition = cached
      ? structuredClone(cached.definition)
      : emptyInput();
    const first = definition.segments[0]!;
    const last = definition.segments.at(-1)!;
    definition.title = offer.carrierName + ' · ' + offer.serviceNumber;
    definition.transport = 'flight';
    definition.serviceDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(offer.departureAt));
    definition.totalCapacity = offer.totalCapacity;
    definition.manifestTemplateId = offer.manifestTemplateId ?? null;
    definition.display = {
      operator: offer.carrierName,
      vehicle: cached?.definition.display?.vehicle || '',
      origin:
        references.find((r) => r.kind === 'city' && r.id === offer.originId)
          ?.name || '',
      destination:
        references.find(
          (r) => r.kind === 'city' && r.id === offer.destinationId,
        )?.name || '',
    };
    if (
      references.find(
        (reference) =>
          reference.kind === 'airline' && reference.id === first.airlineId,
      )?.name !== offer.carrierName
    )
      first.airlineId = '';
    first.originCityId = offer.originId;
    last.destinationCityId = offer.destinationId;
    first.departureAt = offer.departureAt;
    last.arrivalAt = offer.arrivalAt;
    first.departureZone = 'Asia/Tehran';
    last.arrivalZone = 'Asia/Tehran';
    if (definition.segments.length === 1)
      first.flightNumber = offer.serviceNumber;
    return {
      id: 'offer:' + offer.id,
      version: offer.version,
      status: offer.status === 'ACTIVE' ? 'active' : 'paused',
      definition,
      fares: cached?.fares ?? [],
      definitions: cached?.definitions ?? [],
      history: cached?.history ?? [],
    } satisfies Product;
  });
  return [
    ...flights,
    ...local.filter((product) => product.definition.transport !== 'flight'),
  ];
}
export function catalogOffer(
  product: Product,
  offers: readonly TicketOfferV1[],
) {
  return offers.find((offer) => product.id === 'offer:' + offer.id);
}

export function publishedOfferInput(offer: TicketOfferV1) {
  return {
    originId: offer.originId,
    destinationId: offer.destinationId,
    departureAt: offer.departureAt,
    arrivalAt: offer.arrivalAt,
    carrierName: offer.carrierName,
    serviceNumber: offer.serviceNumber,
    cabinClassCode: offer.cabinClassCode,
    totalCapacity: offer.totalCapacity,
    manifestTemplateId: offer.manifestTemplateId ?? null,
  };
}
