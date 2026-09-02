export type IssuedTicketStatus = 'issued' | 'changed' | 'refunded' | 'voided';

export interface IssuedTicketReadModel {
  id: string;
  contractNumber: string;
  passengerDisplayName: string;
  ticketNumber: string;
  pnr: string;
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
              ticket.ticketNumber,
              ticket.pnr,
              ticket.origin,
              ticket.destination,
              ticket.airline,
            ].join(' '),
            query.search,
          )) &&
        (!query.contractNumber ||
          includes(ticket.contractNumber, query.contractNumber)) &&
        (!query.passenger ||
          includes(ticket.passengerDisplayName, query.passenger)) &&
        (!query.documentNumber ||
          includes(
            `${ticket.ticketNumber} ${ticket.pnr}`,
            query.documentNumber,
          )) &&
        (query.originCityId === 'all' ||
          ticket.originCityId === query.originCityId) &&
        (query.destinationCityId === 'all' ||
          ticket.destinationCityId === query.destinationCityId) &&
        (query.airlineId === 'all' || ticket.airlineId === query.airlineId) &&
        (query.status === 'all' || ticket.status === query.status) &&
        (!query.issuedFrom ||
          ticket.issuedAt.slice(0, 10) >= query.issuedFrom) &&
        (!query.issuedTo || ticket.issuedAt.slice(0, 10) <= query.issuedTo),
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
