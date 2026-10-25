import type { ReservationIntakeV1, SalesServiceInput } from '@nora/contracts';
export function floatingPurchaseService(
  request: ReservationIntakeV1,
  key: string,
): SalesServiceInput | undefined {
  const service = request.snapshot.serviceSelections.find(
    (s) => s.clientKey === key,
  );
  if (service) return service;
  if (request.snapshot.hotelSelection?.serviceClientKey === key)
    return {
      clientKey: key,
      kind: 'HOTEL',
      titleSnapshot: request.snapshot.hotelSelection.hotelNameSnapshot,
    };
  const ticket = request.snapshot.ticketSelections?.find(
    (t) => t.serviceClientKey === key,
  );
  return ticket
    ? {
        clientKey: key,
        kind: 'FLIGHT',
        titleSnapshot: ticket.carrierNameSnapshot,
      }
    : undefined;
}
