import {
  isFloatingContract,
  type SalesReservationRequestV1,
} from '@nora/contracts';
import type { TicketPublicService } from '../ticket-catalog/ticket-public.service';
/** Never trust client-supplied supply metadata in a persisted Sales snapshot. */
export async function resolveFloatingContract(
  snapshot: SalesReservationRequestV1,
  branches: readonly string[],
  tickets?: Pick<TicketPublicService, 'documentSupply'>,
): Promise<boolean> {
  if (isFloatingContract(snapshot, false)) return true;
  const ids = new Set([
    ...(snapshot.ticketSelections ?? []).map((t) => t.offerId),
    ...(snapshot.selectedTicketOfferIds ?? []),
    ...snapshot.serviceSelections
      .filter((s) => s.kind === 'FLIGHT')
      .map((s) => s.referenceId)
      .filter((id): id is string => !!id),
  ]);
  for (const id of ids)
    if ((await tickets?.documentSupply?.(id, branches)) === 'FLOATING')
      return true;
  return false;
}
