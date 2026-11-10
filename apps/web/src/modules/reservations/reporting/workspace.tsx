'use client';
import { ConnectedIssuedTicketsWorkspace } from '@/modules/ticket-catalog/components/issued-tickets-workspace';
import { useScreenAccess } from '@/modules/iam/access-context';

/** Report data and exports remain owned and authorized by Reservations. */
export function ReservationReportWorkspace() {
  const allowed = useScreenAccess();
  if (!allowed('ticket-catalog.tab.issued')) return null;
  return <ConnectedIssuedTicketsWorkspace />;
}
