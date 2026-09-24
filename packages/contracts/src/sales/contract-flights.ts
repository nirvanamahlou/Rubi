import type { SalesServiceInput, SalesTicketSelectionInput } from './index';

/** Additive v1 service-metadata snapshot; never an inventory offer or issuance. */
export interface SalesContractOnlyFlightV1 {
  version: 1;
  direction: 'OUTBOUND' | 'RETURN';
  originId: string;
  destinationId: string;
  departureAt: string;
  arrivalAt: string;
  carrierNameSnapshot: string;
  serviceNumberSnapshot: string;
  cabinClassCode: string;
}
export interface SalesFlightSnapshotV1 extends Omit<
  SalesTicketSelectionInput,
  'offerId'
> {
  source: 'CATALOG' | 'CONTRACT_ONLY';
  offerId?: string;
}
export function contractFlightMetadata(
  flight: SalesContractOnlyFlightV1,
): NonNullable<SalesServiceInput['metadata']> {
  return {
    contractFlightVersion: flight.version,
    direction: flight.direction,
    originId: flight.originId,
    destinationId: flight.destinationId,
    flightDepartureAt: flight.departureAt,
    flightArrivalAt: flight.arrivalAt,
    flightCarrierName: flight.carrierNameSnapshot,
    flightNumber: flight.serviceNumberSnapshot,
    flightCabinClass: flight.cabinClassCode,
  };
}
const flightKeys = [
  'contractFlightVersion',
  'flightDepartureAt',
  'flightArrivalAt',
  'flightCarrierName',
  'flightNumber',
  'flightCabinClass',
];
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text = (value: unknown, max: number): value is string =>
  typeof value === 'string' &&
  value.trim().length > 0 &&
  value.length <= max &&
  ![...value].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127);
const instant = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 19) === value.slice(0, 19);

export function salesContractOnlyFlights(
  services: readonly SalesServiceInput[],
): SalesFlightSnapshotV1[] {
  return services.flatMap((service) => {
    const m = service.metadata;
    if (!m || !flightKeys.some((key) => Object.hasOwn(m, key))) return [];
    if (
      service.kind !== 'FLIGHT' ||
      m.contractFlightVersion !== 1 ||
      service.referenceId ||
      service.status !== 'NEEDS_RESERVATION_CONFIRMATION' ||
      !['OUTBOUND', 'RETURN'].includes(String(m.direction)) ||
      typeof m.originId !== 'string' ||
      !uuid.test(m.originId) ||
      typeof m.destinationId !== 'string' ||
      !uuid.test(m.destinationId) ||
      m.originId === m.destinationId ||
      !instant(m.flightDepartureAt) ||
      !instant(m.flightArrivalAt) ||
      Date.parse(m.flightArrivalAt) <= Date.parse(m.flightDepartureAt) ||
      !text(m.flightCarrierName, 160) ||
      !text(m.flightNumber, 80) ||
      !['ECONOMY', 'BUSINESS', 'FIRST'].includes(String(m.flightCabinClass))
    )
      throw new Error(
        'اطلاعات بلیت شناور کامل یا معتبر نیست؛ مسیر، زمان، ایرلاین و شماره پرواز را بررسی کنید.',
      );
    return [
      {
        source: 'CONTRACT_ONLY' as const,
        serviceClientKey: service.clientKey,
        direction: m.direction as 'OUTBOUND' | 'RETURN',
        originId: m.originId,
        destinationId: m.destinationId,
        departureAt: m.flightDepartureAt,
        arrivalAt: m.flightArrivalAt,
        carrierNameSnapshot: m.flightCarrierName,
        serviceNumberSnapshot: m.flightNumber,
        cabinClassCode: String(m.flightCabinClass),
      },
    ];
  });
}

export function salesContractFlights(
  services: readonly SalesServiceInput[],
  selections: readonly SalesTicketSelectionInput[] = [],
): SalesFlightSnapshotV1[] {
  return [
    ...selections.map((ticket) => ({ ...ticket, source: 'CATALOG' as const })),
    ...salesContractOnlyFlights(services),
  ].sort((a, b) =>
    a.direction === b.direction
      ? a.departureAt.localeCompare(b.departureAt)
      : a.direction === 'OUTBOUND'
        ? -1
        : 1,
  );
}
