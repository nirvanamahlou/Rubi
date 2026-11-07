import {
  contractFlightMetadata,
  salesContractOnlyFlights,
} from '@nora/contracts';
import type { ContractFlightDraft } from '@/modules/sales/model/sales-form';
import { salesFlightToday } from '@/modules/sales/model/sales-flight-range';
import type {
  SalesContractDetail,
  SalesServiceInput,
  SalesContractAmendmentV1,
  TicketOfferV1,
  SalesTicketDirection,
} from '@nora/contracts';
export function amendmentFromContract(
  c: SalesContractDetail,
): SalesContractAmendmentV1 {
  return {
    version: c.version,
    reason: '',
    customerId: c.customerId,
    payerCustomerId: c.payerCustomerId,
    assignedUserId: c.assignedUserId,
    tripType: c.tripType,
    originId: c.originId,
    destinationId: c.destinationId,
    departureDate: c.departureDate.slice(0, 10),
    returnNotBefore: c.returnNotBefore?.slice(0, 10) ?? null,
    services: c.servicesDetail,
    passengers: c.passengersDetail,
    ticketSelections: c.ticketSelections,
    hotelSelection: c.hotelSelection,
    priceComponents: c.priceComponents,
    fxSnapshot: c.fxSnapshot ?? null,
    pricingNotes: c.pricingNotes,
    paymentTerms: c.paymentTerms ?? null,
    passengerCategories: Object.fromEntries(
      c.passengersDetail.map((p) => [p.customerId, p.ageCategory]),
    ),
  };
}
/** Explicit flight edits must not retain obsolete contract search-date bounds. */
function synchronizeAmendmentFlightDates(
  draft: SalesContractAmendmentV1,
): SalesContractAmendmentV1 {
  const flights = [
    ...(draft.ticketSelections ?? []),
    ...draft.services.flatMap((service) => {
      const metadata = service.metadata;
      return service.kind === 'FLIGHT' &&
        metadata?.contractFlightVersion === 1 &&
        (metadata.direction === 'OUTBOUND' ||
          metadata.direction === 'RETURN') &&
        typeof metadata.flightDepartureAt === 'string'
        ? [
            {
              direction: metadata.direction,
              departureAt: metadata.flightDepartureAt,
            },
          ]
        : [];
    }),
  ];
  const day = (direction: SalesTicketDirection) => {
    const flight = flights.find((item) => item.direction === direction);
    if (!flight) return undefined;
    const instant = new Date(flight.departureAt);
    return Number.isFinite(instant.getTime())
      ? salesFlightToday(instant)
      : undefined;
  };
  const departureDate = day('OUTBOUND');
  const returnNotBefore = day('RETURN');
  return {
    ...draft,
    ...(departureDate ? { departureDate } : {}),
    ...(returnNotBefore ? { returnNotBefore } : {}),
  };
}

export function replaceAmendmentFlight(
  d: SalesContractAmendmentV1,
  direction: SalesTicketDirection,
  offer: TicketOfferV1,
): SalesContractAmendmentV1 {
  const previous = d.ticketSelections?.find((t) => t.direction === direction);
  const service =
    d.services.find((s) => s.clientKey === previous?.serviceClientKey) ??
    d.services.find(
      (s) => s.kind === 'FLIGHT' && s.metadata?.direction === direction,
    );
  const key = service?.clientKey ?? 'flight-' + direction.toLowerCase();
  const selection = {
    serviceClientKey: key,
    direction,
    offerId: offer.id,
    originId: offer.originId,
    destinationId: offer.destinationId,
    departureAt: offer.departureAt,
    arrivalAt: offer.arrivalAt,
    carrierNameSnapshot: offer.carrierName,
    serviceNumberSnapshot: offer.serviceNumber,
    cabinClassCode: offer.cabinClassCode,
  };
  const metadata = Object.fromEntries(
    Object.entries(service?.metadata ?? {}).filter(
      ([key]) =>
        ![
          'purchaseSupplyType',
          'contractFlightVersion',
          'flightDepartureAt',
          'flightArrivalAt',
          'flightCarrierName',
          'flightNumber',
          'flightCabinClass',
          'flightOriginAirportV1',
          'flightDestinationAirportV1',
        ].includes(key),
    ),
  );
  const nextService = {
    ...service,
    clientKey: key,
    kind: 'FLIGHT' as const,
    titleSnapshot: offer.carrierName + ' ' + offer.serviceNumber,
    referenceId: offer.id,
    metadata: {
      ...metadata,
      ...(offer.supplyType ? { purchaseSupplyType: offer.supplyType } : {}),
      ...(service && !service.metadata?.direction ? {} : { direction }),
    },
    status: 'SELECTED' as const,
  };
  return synchronizeAmendmentFlightDates({
    ...d,
    ...(direction === 'OUTBOUND'
      ? {
          originId: offer.originId,
          destinationId: offer.destinationId,
          departureDate: salesFlightToday(new Date(offer.departureAt)),
        }
      : {}),
    ticketSelections: [
      ...(d.ticketSelections ?? []).filter((t) => t.direction !== direction),
      selection,
    ],
    services: service
      ? d.services.map((s) => (s.clientKey === key ? nextService : s))
      : [...d.services, nextService],
    passengers: service
      ? d.passengers
      : d.passengers.map((p) => ({
          ...p,
          serviceClientKeys: [...p.serviceClientKeys, key],
        })),
  });
}

export function manualAmendmentFlights(
  c: SalesContractDetail,
): Partial<Record<SalesTicketDirection, ContractFlightDraft>> {
  const local = (v: string) =>
    new Date(Date.parse(v) + 210 * 60000).toISOString().slice(0, 16);
  return Object.fromEntries(
    salesContractOnlyFlights(c.servicesDetail).map((f) => [
      f.direction,
      {
        departureAt: local(f.departureAt),
        arrivalAt: local(f.arrivalAt),
        carrierName: f.carrierNameSnapshot,
        serviceNumber: f.serviceNumberSnapshot,
        ...(f.originAirport ? { originAirport: f.originAirport } : {}),
        ...(f.destinationAirport
          ? { destinationAirport: f.destinationAirport }
          : {}),
        cabinClassCode:
          f.cabinClassCode as ContractFlightDraft['cabinClassCode'],
      },
    ]),
  );
}
/** Split a shared catalog service without duplicating its sale/pricing metadata. */
function prepareFloatingAmendment(
  d: SalesContractAmendmentV1,
  direction: SalesTicketDirection,
): SalesContractAmendmentV1 {
  const selected = d.ticketSelections?.find((t) => t.direction === direction);
  const service =
    d.services.find((s) => s.clientKey === selected?.serviceClientKey) ??
    d.services.find(
      (s) => s.kind === 'FLIGHT' && s.metadata?.direction === direction,
    );
  if (service?.metadata?.contractFlightVersion === 1) return d;
  const shared =
    service &&
    d.ticketSelections?.some(
      (t) =>
        t.direction !== direction && t.serviceClientKey === service.clientKey,
    );
  let key =
    service && !shared
      ? service.clientKey
      : 'floating-' + direction.toLowerCase();
  while ((!service || shared) && d.services.some((s) => s.clientKey === key))
    key += '-new';
  const metadata =
    shared || !service
      ? {}
      : Object.fromEntries(
          Object.entries(service.metadata ?? {}).filter(
            ([key]) => !['purchaseSupplyType', 'direction'].includes(key),
          ),
        );
  let services: SalesServiceInput[] =
    service && !shared
      ? d.services.map((s) =>
          s === service
            ? {
                ...s,
                referenceId: null,
                status: 'NEEDS_RESERVATION_CONFIRMATION' as const,
                metadata: {
                  ...metadata,
                  direction,
                  purchaseSupplyType: 'FLOATING',
                },
              }
            : s,
        )
      : [
          ...d.services,
          {
            clientKey: key,
            kind: 'FLIGHT' as const,
            titleSnapshot: 'Floating flight',
            status: 'NEEDS_RESERVATION_CONFIRMATION' as const,
            metadata: {
              direction,
              purchaseSupplyType: 'FLOATING',
              ...(service?.metadata?.businessOutput === true
                ? { businessOutput: true }
                : {}),
            },
          },
        ];
  if (shared && service) {
    const remaining = d.ticketSelections!.find(
      (t) =>
        t.direction !== direction && t.serviceClientKey === service.clientKey,
    )!;
    services = services.map((s) =>
      s.clientKey === service.clientKey
        ? {
            ...s,
            referenceId: remaining.offerId,
            metadata: {
              ...s.metadata,
              ...(s.metadata?.direction
                ? { direction: remaining.direction }
                : {}),
            },
          }
        : s,
    );
  }
  const legacy = services[0]?.metadata?.legacyServicePartiesV2;
  if (typeof legacy === 'string' && (!service || shared)) {
    const parties = JSON.parse(legacy);
    if (!service || !parties[service.clientKey])
      throw new Error('ترکیب معتبر نیست.');
    services = services.map((s, i) =>
      i === 0
        ? {
            ...s,
            metadata: {
              ...s.metadata,
              legacyServicePartiesV2: JSON.stringify({
                ...parties,
                [key]: parties[service.clientKey],
              }),
            },
          }
        : s,
    );
  }
  return {
    ...d,
    services,
    ticketSelections: (d.ticketSelections ?? []).filter(
      (t) => t.direction !== direction,
    ),
    passengers: d.passengers.map((p) =>
      (!service || p.serviceClientKeys.includes(service.clientKey)) &&
      !p.serviceClientKeys.includes(key)
        ? { ...p, serviceClientKeys: [...p.serviceClientKeys, key] }
        : p,
    ),
  };
}

export function applyManualAmendmentFlights(
  d: SalesContractAmendmentV1,
  flights: Partial<Record<SalesTicketDirection, ContractFlightDraft>>,
): SalesContractAmendmentV1 {
  let result = d;
  let changed = false;
  for (const direction of ['OUTBOUND', 'RETURN'] as const) {
    const f = flights[direction];
    if (!f) continue;
    if (
      !f.carrierName.trim() ||
      !f.serviceNumber.trim() ||
      !Number.isFinite(Date.parse(f.departureAt)) ||
      !Number.isFinite(Date.parse(f.arrivalAt))
    )
      throw new Error(
        'اطلاعات بلیت شناور کامل یا معتبر نیست؛ مسیر، زمان، ایرلاین و شماره پرواز را بررسی کنید.',
      );
    result = prepareFloatingAmendment(result, direction);
    const service = result.services.find(
      (s) =>
        s.kind === 'FLIGHT' &&
        s.metadata?.direction === direction &&
        (s.metadata?.contractFlightVersion === 1 ||
          (s.metadata?.purchaseSupplyType === 'FLOATING' &&
            !result.ticketSelections?.some(
              (t) => t.serviceClientKey === s.clientKey,
            ))),
    );
    if (!service) continue;
    changed = true;
    const utc = (v: string) =>
      new Date(
        /(?:Z|[+-]\d{2}:\d{2})$/.test(v) ? v : v + '+03:30',
      ).toISOString();
    const departureAt = utc(f.departureAt),
      arrivalAt = utc(f.arrivalAt);
    result = {
      ...result,
      ...(direction === 'OUTBOUND'
        ? { departureDate: salesFlightToday(new Date(departureAt)) }
        : {}),
      services: result.services.map((s) =>
        s.clientKey === service.clientKey
          ? {
              ...s,
              titleSnapshot: f.carrierName + ' ' + f.serviceNumber,
              metadata: {
                ...Object.fromEntries(
                  Object.entries(s.metadata ?? {}).filter(
                    ([key]) =>
                      ![
                        'flightOriginAirportV1',
                        'flightDestinationAirportV1',
                      ].includes(key),
                  ),
                ),
                ...contractFlightMetadata({
                  version: 1,
                  direction,
                  originId:
                    direction === 'OUTBOUND' ? d.originId : d.destinationId,
                  destinationId:
                    direction === 'OUTBOUND' ? d.destinationId : d.originId,
                  departureAt,
                  arrivalAt,
                  carrierNameSnapshot: f.carrierName,
                  serviceNumberSnapshot: f.serviceNumber,
                  cabinClassCode: f.cabinClassCode,
                  ...(f.originAirport
                    ? { originAirport: f.originAirport }
                    : {}),
                  ...(f.destinationAirport
                    ? { destinationAirport: f.destinationAirport }
                    : {}),
                }),
              },
            }
          : s,
      ),
    };
  }
  return changed ? synchronizeAmendmentFlightDates(result) : result;
}

/** Matches the contract-wide output flag used when a sales contract is created. */
export function amendmentBusinessOutput(d: SalesContractAmendmentV1): boolean {
  return d.services.some(
    (s) => s.kind === 'FLIGHT' && s.metadata?.businessOutput === true,
  );
}
export function withAmendmentBusinessOutput(
  d: SalesContractAmendmentV1,
  checked: boolean,
): SalesContractAmendmentV1 {
  return {
    ...d,
    services: d.services.map((s) =>
      s.kind === 'FLIGHT'
        ? { ...s, metadata: { ...s.metadata, businessOutput: checked } }
        : s,
    ),
  };
}
