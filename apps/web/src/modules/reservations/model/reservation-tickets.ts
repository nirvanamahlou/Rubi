import type { SalesReservationRequestV1 } from '@nora/contracts';
import { salesContractFlights } from '@nora/contracts';
import type { FlightTicketSheetData } from '@/modules/sales/public/tickets';

export type ReservationPdfTicket = Omit<FlightTicketSheetData, 'offers'> & {
  passengerId: string;
  ageCategory: 'ADT' | 'CHD' | 'INF';
  gender?: 'M' | 'F' | null;
  offers: readonly (FlightTicketSheetData['offers'][number] & {
    arrivalAt?: string;
    direction: 'OUTBOUND' | 'RETURN';
  })[];
};

export function reservationTickets(
  snapshot: SalesReservationRequestV1,
): ReservationPdfTicket[] {
  return (snapshot.passengerAssignments ?? [])
    .filter((p) => snapshot.passengerIds.includes(p.customerId))
    .flatMap((passenger) => {
      const assigned = snapshot.serviceSelections.filter((service) =>
        passenger.serviceClientKeys.includes(service.clientKey),
      );
      const flights = assigned.filter((service) => service.kind === 'FLIGHT');
      const offers = salesContractFlights(
        snapshot.serviceSelections,
        snapshot.ticketSelections ?? [],
      )
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
          id: `${ticket.serviceClientKey}-${ticket.offerId ?? 'contract-only'}`,
          contractOnly: ticket.source === 'CONTRACT_ONLY',
          originId: ticket.originId,
          destinationId: ticket.destinationId,
          departureAt: ticket.departureAt,
          arrivalAt: ticket.arrivalAt,
          direction: ticket.direction,
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
          ageCategory: passenger.ageCategory,
          issued: true,
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
