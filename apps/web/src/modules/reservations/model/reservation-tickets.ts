import type { SalesReservationRequestV1 } from '@rubi/contracts';
import type { FlightTicketSheetData } from '@/modules/sales/public/tickets';

export function reservationTickets(
  snapshot: SalesReservationRequestV1,
): (FlightTicketSheetData & { passengerId: string })[] {
  return (snapshot.passengerAssignments ?? [])
    .filter((p) => snapshot.passengerIds.includes(p.customerId))
    .flatMap((passenger) => {
      const assigned = snapshot.serviceSelections.filter((service) =>
        passenger.serviceClientKeys.includes(service.clientKey),
      );
      const flights = assigned.filter((service) => service.kind === 'FLIGHT');
      const offers = (snapshot.ticketSelections ?? [])
        .filter((ticket) =>
          flights.some(
            (service) => service.clientKey === ticket.serviceClientKey,
          ),
        )
        .sort((a, b) =>
          a.direction === b.direction
            ? a.departureAt.localeCompare(b.departureAt)
            : a.direction === 'OUTBOUND'
              ? -1
              : 1,
        )
        .map((ticket) => ({
          id: `${ticket.serviceClientKey}-${ticket.offerId}`,
          originId: ticket.originId,
          destinationId: ticket.destinationId,
          departureAt: ticket.departureAt,
          carrierName: ticket.carrierNameSnapshot,
          serviceNumber: ticket.serviceNumberSnapshot,
          cabinClassCode: ticket.cabinClassCode,
          businessOutput:
            flights.find(
              (service) => service.clientKey === ticket.serviceClientKey,
            )?.metadata?.businessOutput === true,
        }));
      if (!offers.length) return [];
      return [
        {
          passengerId: passenger.customerId,
          passengerName: passenger.displayNameSnapshot || 'نام مسافر ثبت نشده',
          contractNumber: snapshot.contractNumber,
          offers,
          transferDirections: [
            ...new Set(
              assigned
                .filter((service) => service.kind === 'TRANSFER')
                .map((service) => service.metadata?.direction)
                .filter(
                  (direction): direction is 'OUTBOUND' | 'RETURN' =>
                    direction === 'OUTBOUND' || direction === 'RETURN',
                ),
            ),
          ],
        },
      ];
    });
}
