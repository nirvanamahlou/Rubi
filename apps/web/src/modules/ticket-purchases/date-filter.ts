import type { TicketPurchaseInboxItemV1 } from '@nora/contracts';

/** Same date source as the flight column; compare date-only values without UTC shifts. */
export function matchesFlightPurchaseDate(
  item: TicketPurchaseInboxItemV1,
  from: string,
  to: string,
) {
  if (!from && !to) return true;
  if (from && to && from > to) return false;
  const day = (
    item.flightGroup?.departureDate ?? item.request.serviceDate
  )?.slice(0, 10);
  return Boolean(
    day &&
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    (!from || day >= from) &&
    (!to || day <= to),
  );
}
