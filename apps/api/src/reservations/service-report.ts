import {
  readPassengerHotelStays,
  salesContractFlights,
  type SalesReservationRequestV1,
} from '@nora/contracts';
import { type IssuedTicketRow } from './issued-ticket-report';

export interface ServiceReportRow extends Omit<IssuedTicketRow, 'status'> {
  status: 'issued' | 'voided' | 'allocated';
  serviceKind: string;
  serviceTitle: string;
  hotelId: string;
  hotelName: string;
  checkInDate: string;
  checkOutDate: string;
  reportStatus: 'ALLOCATED' | 'ISSUED' | 'CANCELLED';
}

/** Allocations are not issuance evidence. Only actual ticket documents count as issued. */
export function allocatedServiceRows(
  id: string,
  snapshot: SalesReservationRequestV1,
  cancelled: boolean,
): ServiceReportRow[] {
  const hotel = snapshot.hotelSelection;
  const stays = readPassengerHotelStays(snapshot.serviceSelections, hotel);
  const flights = salesContractFlights(
    snapshot.serviceSelections,
    snapshot.ticketSelections ?? [],
  );
  const outbound = flights.find((f) => f.direction === 'OUTBOUND');
  const tripStart =
    outbound?.departureAt ??
    (hotel ? hotel.checkInDate + 'T00:00:00+03:30' : '');
  return (snapshot.passengerAssignments ?? [])
    .filter((p) => snapshot.passengerIds.includes(p.customerId))
    .flatMap((p) =>
      snapshot.serviceSelections
        .filter(
          (s) =>
            s.kind !== 'FLIGHT' && p.serviceClientKeys.includes(s.clientKey),
        )
        .map((s) => {
          const h =
            s.kind === 'HOTEL' && hotel?.serviceClientKey === s.clientKey
              ? hotel
              : null;
          const metadata = s.metadata ?? {};
          const route =
            s.kind === 'TRANSFER'
              ? (flights.find((f) => f.direction === metadata.direction) ??
                outbound)
              : outbound;
          const stay = h ? (stays?.[p.customerId] ?? h) : null;
          const date = [
            metadata.departureAt,
            metadata.serviceDate,
            metadata.date,
          ].find((v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v));
          return {
            id: `${id}:${p.customerId}:${s.clientKey}`,
            contractNumber: snapshot.contractNumber,
            passengerDisplayName:
              p.displayNameSnapshot?.trim() || 'نام مسافر ثبت نشده',
            ticketNumber: '',
            pnr: null,
            originCityId:
              typeof metadata.originId === 'string'
                ? metadata.originId
                : (route?.originId ?? ''),
            origin: '',
            destinationCityId:
              typeof metadata.destinationId === 'string'
                ? metadata.destinationId
                : (route?.destinationId ?? h?.cityId ?? ''),
            destination: '',
            airlineId: '',
            airline: '',
            issuedAt: snapshot.createdAt,
            departureAt: stay
              ? stay.checkInDate + 'T00:00:00+03:30'
              : date
                ? String(date)
                : s.kind === 'TRANSFER'
                  ? (route?.departureAt ?? tripStart)
                  : tripStart,
            arrivalAt: '',
            direction:
              s.kind === 'TRANSFER' &&
              ['OUTBOUND', 'RETURN'].includes(String(metadata.direction))
                ? String(metadata.direction)
                : '',
            flightNumber: '',
            cabinClass: '',
            source: '',
            status: cancelled ? ('voided' as const) : ('allocated' as const),
            serviceKind: s.kind,
            serviceTitle: s.titleSnapshot,
            hotelId: h?.hotelId ?? '',
            hotelName: h?.hotelNameSnapshot ?? '',
            checkInDate: stay?.checkInDate ?? '',
            checkOutDate: stay?.checkOutDate ?? '',
            reportStatus: cancelled
              ? ('CANCELLED' as const)
              : ('ALLOCATED' as const),
          };
        }),
    );
}
export function flightServiceRows(rows: IssuedTicketRow[]): ServiceReportRow[] {
  return rows.map((r) => ({
    ...r,
    serviceKind: 'FLIGHT',
    serviceTitle: r.flightNumber,
    hotelId: '',
    hotelName: '',
    checkInDate: '',
    checkOutDate: '',
    reportStatus: r.status === 'voided' ? 'CANCELLED' : 'ISSUED',
  }));
}
export function filterServiceRows(
  rows: ServiceReportRow[],
  query: Record<string, unknown>,
  range: { gte: Date; lt: Date },
) {
  return rows.filter((r) => {
    if (
      query.serviceKind &&
      query.serviceKind !== 'all' &&
      r.serviceKind !== query.serviceKind
    )
      return false;
    if (query.hotelId && query.hotelId !== 'all' && r.hotelId !== query.hotelId)
      return false;
    const value = query.dateBasis === 'TRAVEL' ? r.departureAt : r.issuedAt;
    const time = Date.parse(
      value.length === 10 ? value + 'T00:00:00+03:30' : value,
    );
    return (
      Number.isFinite(time) &&
      time >= range.gte.valueOf() &&
      time < range.lt.valueOf()
    );
  });
}
