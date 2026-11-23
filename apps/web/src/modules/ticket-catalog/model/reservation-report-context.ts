import type {
  IssuedTicketQuery,
  IssuedTicketReadModel,
} from './issued-tickets';

export const reservationReportHref = '/reservations/reports';
const eventName = 'rubi:read-reservation-report';
export interface ReservationReportSnapshot {
  query: IssuedTicketQuery;
  rows: readonly IssuedTicketReadModel[];
  state: 'ready' | 'loading' | 'error';
}

export function exposeReservationReport(read: () => ReservationReportSnapshot) {
  const listener = (event: Event) =>
    (
      event as CustomEvent<(snapshot: ReservationReportSnapshot) => void>
    ).detail(read());
  window.addEventListener(eventName, listener);
  return () => window.removeEventListener(eventName, listener);
}

export function getReservationReport() {
  let snapshot: ReservationReportSnapshot | undefined;
  window.dispatchEvent(
    new CustomEvent(eventName, {
      detail: (value: ReservationReportSnapshot) => {
        snapshot = value;
      },
    }),
  );
  return snapshot;
}
