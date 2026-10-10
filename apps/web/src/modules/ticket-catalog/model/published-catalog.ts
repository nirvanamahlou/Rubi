import type { TicketOfferV1 } from '@nora/contracts';
import type { Product, Reference } from './catalog';
import { emptyInput } from './preview';
import type { TicketOfferCreateV1 } from '@nora/contracts';
import { flightCabinCode } from './flight-cabins';

/** Optional producer defaults/changed capacity are not new dated flights. */
export function samePublishedFlight(
  offer: TicketOfferV1,
  input: TicketOfferCreateV1,
) {
  const label = (text: string) =>
    text.trim().replace(/\s+/g, ' ').toLowerCase();
  return (
    offer.originId === input.originId &&
    offer.destinationId === input.destinationId &&
    Date.parse(offer.departureAt) === Date.parse(input.departureAt) &&
    label(offer.carrierName) === label(input.carrierName) &&
    label(offer.serviceNumber) === label(input.serviceNumber) &&
    offer.cabinClassCode === input.cabinClassCode &&
    (offer.supplyType ?? 'COMPANY') === (input.supplyType ?? 'COMPANY')
  );
}

const wallDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function nextWallDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) return value;
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10) + value.slice(10);
}

export function arrivalWallTimeAfterMidnight(
  departure: string,
  arrival: string,
) {
  if (
    !wallDateTimePattern.test(departure) ||
    !wallDateTimePattern.test(arrival)
  )
    return arrival;
  const departureDate = Date.parse(`${departure.slice(0, 10)}T00:00:00.000Z`);
  const arrivalDate = Date.parse(`${arrival.slice(0, 10)}T00:00:00.000Z`);
  const dayDifference = (arrivalDate - departureDate) / 86_400_000;
  if (dayDifference === -1) {
    const alignedArrival = departure.slice(0, 10) + arrival.slice(10);
    return alignedArrival.slice(11) < departure.slice(11)
      ? nextWallDate(alignedArrival)
      : alignedArrival;
  }
  if (dayDifference !== 0 || arrival.slice(11) >= departure.slice(11))
    return arrival;
  return nextWallDate(arrival);
}

export function arrivalWallTimeAfterDepartureChange(
  departure: string,
  arrival: string,
) {
  if (
    wallDateTimePattern.test(departure) &&
    wallDateTimePattern.test(arrival) &&
    arrival.slice(0, 10) < departure.slice(0, 10)
  )
    arrival = departure.slice(0, 10) + arrival.slice(10);
  return arrivalWallTimeAfterMidnight(departure, arrival);
}

export function catalogProductsFromOffers(
  local: readonly Product[],
  offers: readonly TicketOfferV1[],
  references: readonly Reference[],
): Product[] {
  const used = new Set<string>();
  const normalized = (value: string) =>
    value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
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
    if (offer.originAirportId) first.originAirportId = offer.originAirportId;
    if (offer.destinationAirportId)
      last.destinationAirportId = offer.destinationAirportId;
    definition.title = offer.carrierName + ' · ' + offer.serviceNumber;
    definition.transport = 'flight';
    definition.serviceDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(offer.departureAt));
    definition.totalCapacity = offer.totalCapacity;
    if (offer.supplyType) {
      definition.supplyType =
        offer.supplyType === 'COMPANY'
          ? 'company'
          : offer.supplyType === 'FLOATING'
            ? 'allotment'
            : 'supplier';
      definition.companyOwned = offer.supplyType === 'COMPANY';
      definition.entryMethod = offer.supplyType === 'API' ? 'api' : 'manual';
    }
    definition.economyBaggageKg = offer.economyBaggageKg ?? null;
    definition.businessBaggageKg = offer.businessBaggageKg ?? null;
    definition.returnMinDays = offer.returnMinDays ?? null;
    definition.returnMaxDays = offer.returnMaxDays ?? null;
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
    const firstCarrier = offer.carrierName.split('/')[0]?.trim() ?? '';
    const airline = references.find(
      (reference) =>
        reference.kind === 'airline' &&
        reference.active &&
        normalized(reference.name) === normalized(firstCarrier),
    );
    first.airlineId = airline?.id ?? '';
    const flightClass = references.find(
      (reference) =>
        reference.kind === 'flightClass' &&
        reference.active &&
        flightCabinCode(reference) === offer.cabinClassCode,
    );
    definition.flightClassId = flightClass?.id ?? '';
    first.originCityId = offer.originId;
    last.destinationCityId = offer.destinationId;
    first.originCountryId =
      references.find(
        (reference) =>
          reference.kind === 'city' && reference.id === offer.originId,
      )?.countryId ?? '';
    last.destinationCountryId =
      references.find(
        (reference) =>
          reference.kind === 'city' && reference.id === offer.destinationId,
      )?.countryId ?? '';
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

function localLoadGroupKey(offer: TicketOfferV1, local: readonly Product[]) {
  const product = local.find(
    (item) =>
      item.id === offer.catalogProductId || item.id === `offer:${offer.id}`,
  );
  const created = product?.history.find((entry) => entry.action === 'create');
  return created ? `${created.at}|${created.actor}` : undefined;
}

/** Exact server group for new loads; same-browser creation history recovers legacy batches safely. */
export function publishedLoadGroup(
  selected: TicketOfferV1,
  offers: readonly TicketOfferV1[],
  local: readonly Product[],
) {
  if (selected.loadGroupId)
    return offers.filter(
      (offer) =>
        offer.branchId === selected.branchId &&
        offer.loadGroupId === selected.loadGroupId,
    );
  const key = localLoadGroupKey(selected, local);
  if (!key) return [selected];
  const grouped = offers.filter(
    (offer) =>
      offer.branchId === selected.branchId &&
      localLoadGroupKey(offer, local) === key,
  );
  return grouped.length ? grouped : [selected];
}

export function publishedOfferInput(offer: TicketOfferV1) {
  return {
    originAirportId: offer.originAirportId ?? null,
    destinationAirportId: offer.destinationAirportId ?? null,
    supplyType: offer.supplyType ?? null,
    economyBaggageKg: offer.economyBaggageKg ?? null,
    businessBaggageKg: offer.businessBaggageKg ?? null,
    returnMinDays: offer.returnMinDays ?? null,
    returnMaxDays: offer.returnMaxDays ?? null,
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
