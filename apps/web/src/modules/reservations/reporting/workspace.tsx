'use client';
import { ConnectedIssuedTicketsWorkspace } from '@/modules/ticket-catalog/components/issued-tickets-workspace';
import { useLegalEntityContext } from '@/modules/legal-entities/components/legal-entity-context';
import { useAccessActor, useScreenAccess } from '@/modules/iam/access-context';

/** Report data and exports remain owned and authorized by Reservations. */
export function ReservationReportWorkspace() {
  const allowed = useScreenAccess();
  if (!allowed('ticket-catalog.tab.issued')) return null;
  return <ScopedReservationReport />;
}

function ScopedReservationReport() {
  const { context } = useLegalEntityContext();
  const actor = useAccessActor();
  const key = JSON.stringify([
    context?.selection,
    context?.version,
    actor?.userId,
    actor?.branchIds,
  ]);
  return <ConnectedIssuedTicketsWorkspace key={key} exposeReportContext />;
}
