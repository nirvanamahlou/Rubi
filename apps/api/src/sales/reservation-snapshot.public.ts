import type {
  SalesContractDetail,
  SalesReservationRequestV1,
} from '@nora/contracts';

export function reservationSnapshot(
  presented: SalesContractDetail,
  requestId: string,
  contractVersion: number,
  createdAt: string,
): SalesReservationRequestV1 {
  return {
    passengerAssignments: presented.passengersDetail.map((passenger) => ({
      customerId: passenger.customerId,
      displayNameSnapshot: passenger.displayNameSnapshot,
      ageCategory: passenger.ageCategory,
      ...(passenger.childAgeBand
        ? { childAgeBand: passenger.childAgeBand }
        : {}),
      serviceClientKeys: passenger.serviceClientKeys,
    })),
    ticketSelections: presented.ticketSelections,
    version: 1,
    requestId,
    contractId: presented.id,
    contractNumber: presented.contractNumber,
    contractVersion: contractVersion,
    customerId: presented.customerId,
    passengerIds: presented.passengersDetail.map(
      ({ customerId }) => customerId,
    ),
    serviceSelections: presented.servicesDetail.map((service) =>
      service.kind === 'BUS' || service.kind === 'TRAIN'
        ? {
            ...service,
            metadata: {
              ...service.metadata,
              originId: service.metadata?.originId || presented.originId,
              destinationId:
                service.metadata?.destinationId || presented.destinationId,
              date: service.metadata?.date || presented.departureDate,
            },
          }
        : service,
    ),
    selectedTicketOfferIds: presented.ticketSelections.map(
      ({ offerId }) => offerId,
    ),
    hotelSelection: presented.hotelSelection,
    createdAt,
  };
}
