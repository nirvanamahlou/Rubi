export type IssuedTicketStatus =
  'issued' | 'changed' | 'refunded' | 'voided' | 'allocated';

export interface IssuedTicketReadModel {
  direction?: string | undefined;
  flightNumber?: string | undefined;
  arrivalAt?: string | undefined;
  serviceKind?: string | undefined;
  serviceTitle?: string | undefined;
  hotelId?: string | undefined;
  hotelName?: string | undefined;
  checkInDate?: string | undefined;
  checkOutDate?: string | undefined;
  reportStatus?: string | undefined;
  id: string;
  contractNumber: string;
  passengerDisplayName: string;
  ticketNumber: string | null;
  pnr: string | null;
  originCityId: string;
  origin: string;
  destinationCityId: string;
  destination: string;
  airlineId: string;
  airline: string;
  issuedAt: string;
  departureAt: string;
  status: IssuedTicketStatus;
}

export interface IssuedTicketQuery {
  serviceKind?: string | undefined;
  hotelId?: string | undefined;
  dateBasis?: string | undefined;
  search: string;
  contractNumber: string;
  passenger: string;
  documentNumber: string;
  originCityId: string;
  destinationCityId: string;
  airlineId: string;
  status: 'all' | IssuedTicketStatus;
  issuedFrom: string;
  issuedTo: string;
  page: number;
}

export const initialIssuedTicketQuery: IssuedTicketQuery = {
  serviceKind: 'FLIGHT',
  hotelId: 'all',
  dateBasis: 'ISSUED',
  search: '',
  contractNumber: '',
  passenger: '',
  documentNumber: '',
  originCityId: 'all',
  destinationCityId: 'all',
  airlineId: 'all',
  status: 'all',
  issuedFrom: '',
  issuedTo: '',
  page: 1,
};

const includes = (value: string, query: string) =>
  value
    .toLocaleLowerCase('fa-IR')
    .includes(query.trim().toLocaleLowerCase('fa-IR'));

function reportDay(ticket: IssuedTicketReadModel, query: IssuedTicketQuery) {
  const time = Date.parse(
    query.dateBasis === 'TRAVEL' ? ticket.departureAt : ticket.issuedAt,
  );
  return Number.isFinite(time)
    ? new Date(time + 12600000).toISOString().slice(0, 10)
    : '';
}
export function queryIssuedTickets(
  tickets: readonly IssuedTicketReadModel[],
  query: IssuedTicketQuery,
) {
  const rows = tickets
    .filter(
      (ticket) =>
        (!query.search ||
          includes(
            [
              ticket.contractNumber,
              ticket.passengerDisplayName,
              ticket.ticketNumber ?? '',
              ticket.pnr ?? '',
              ticket.origin,
              ticket.destination,
              ticket.airline,
              ticket.serviceTitle ?? '',
              ticket.hotelName ?? '',
            ].join(' '),
            query.search,
          )) &&
        (!query.contractNumber ||
          includes(ticket.contractNumber, query.contractNumber)) &&
        (!query.passenger ||
          includes(ticket.passengerDisplayName, query.passenger)) &&
        (!query.documentNumber ||
          includes(
            `${ticket.ticketNumber ?? ''} ${ticket.pnr ?? ''}`,
            query.documentNumber,
          )) &&
        (!query.serviceKind ||
          query.serviceKind === 'all' ||
          ticket.serviceKind === query.serviceKind ||
          (!ticket.serviceKind && query.serviceKind === 'FLIGHT')) &&
        (!query.hotelId ||
          query.hotelId === 'all' ||
          ticket.hotelId === query.hotelId) &&
        (query.originCityId === 'all' ||
          ticket.originCityId === query.originCityId) &&
        (query.destinationCityId === 'all' ||
          ticket.destinationCityId === query.destinationCityId) &&
        (query.airlineId === 'all' || ticket.airlineId === query.airlineId) &&
        (query.status === 'all' || ticket.status === query.status) &&
        (!query.issuedFrom || reportDay(ticket, query) >= query.issuedFrom) &&
        (!query.issuedTo || reportDay(ticket, query) <= query.issuedTo),
    )
    .sort(
      (left, right) =>
        right.issuedAt.localeCompare(left.issuedAt) ||
        left.id.localeCompare(right.id),
    );
  const pages = Math.max(1, Math.ceil(rows.length / 10));
  const page = Math.max(1, Math.min(pages, query.page));
  return {
    total: rows.length,
    matchedRows: rows,
    pages,
    page,
    rows: rows.slice((page - 1) * 10, page * 10),
  };
}

export function countIssuedTicketsByRoute(
  tickets: readonly IssuedTicketReadModel[],
) {
  const counts = new Map<
    string,
    { key: string; origin: string; destination: string; count: number }
  >();
  for (const ticket of tickets) {
    if (
      (ticket.serviceKind && ticket.serviceKind !== 'FLIGHT') ||
      !ticket.originCityId ||
      !ticket.destinationCityId
    )
      continue;
    const key = `${ticket.originCityId}::${ticket.destinationCityId}`;
    const current = counts.get(key);
    if (current) current.count += 1;
    else
      counts.set(key, {
        key,
        origin: ticket.origin,
        destination: ticket.destination,
        count: 1,
      });
  }
  return [...counts.values()].sort(
    (left, right) =>
      right.count - left.count || left.key.localeCompare(right.key),
  );
}

export const issuedTicketSourceBoundary = {
  owner: 'reservations',
  consumer: 'ticket-catalog',
  access: 'public-contract-read-only',
  persistedHere: false,
} as const;
