import {
  contractFlightMetadata,
  salesContractOnlyFlights,
} from '@nora/contracts';
import type { ContractFlightDraft } from '@/modules/sales/model/sales-form';
import { salesFlightToday } from '@/modules/sales/model/sales-flight-range';
import type {
  SalesContractDetail,
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
          'contractFlightVersion',
          'flightDepartureAt',
          'flightArrivalAt',
          'flightCarrierName',
          'flightNumber',
          'flightCabinClass',
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
      ...(service && !service.metadata?.direction ? {} : { direction }),
    },
    status: 'SELECTED' as const,
  };
  return {
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
  };
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
        cabinClassCode:
          f.cabinClassCode as ContractFlightDraft['cabinClassCode'],
      },
    ]),
  );
}
export function applyManualAmendmentFlights(
  d: SalesContractAmendmentV1,
  flights: Partial<Record<SalesTicketDirection, ContractFlightDraft>>,
): SalesContractAmendmentV1 {
  let result = d;
  for (const direction of ['OUTBOUND', 'RETURN'] as const) {
    const f = flights[direction];
    if (!f) continue;
    const service = result.services.find(
      (s) =>
        s.kind === 'FLIGHT' &&
        s.metadata?.direction === direction &&
        s.metadata?.contractFlightVersion === 1,
    );
    if (!service) continue;
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
                ...s.metadata,
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
                }),
              },
            }
          : s,
      ),
    };
  }
  return result;
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
