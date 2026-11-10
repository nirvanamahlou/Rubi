import type { TicketOfferV1 } from './index';

/** Ticket Catalog owns this bundle; capacity always belongs to its ticket offers. */
export interface TourPackageInputV1 {
  name: string;
  /** Empty until the draft route is selected; required before departure creation. */
  originId: string;
  /** Empty until selected; required before assigning hotels or departures. */
  destinationId: string;
  hotelIds: string[];
  insuranceId?: string;
  transferOutbound: boolean;
  transferReturn: boolean;
  visa: boolean;
  cityTour?: boolean;
  tourGuide?: boolean;
  /** Optional, backwards-compatible descriptive definition; never a seat ledger. */
  details?: {
    version: 1;
    summary?: string;
    description?: string;
    requiredDocuments?: string;
    services?: string;
    installmentTerms?: string;
    refundRules?: string;
    originAirportCode?: string;
    destinationAirportCode?: string;
    isCombined?: boolean;
    /** Ordered destinations, including the primary destination, with consecutive hotel nights. */
    destinations?: { cityId: string; nights: number }[] | undefined;
    durationDays?: number;
    rating?: number;
    transport?: 'FLIGHT' | 'TRAIN';
    ticketIncluded?: boolean;
    airlineName?: string;
    basePrice?: { amount: string; currency: string };
    flightPrice?: { amount: string; currency: string };
    imageDocumentId?: string;
    itinerary?: {
      kind?: 'START' | 'TRANSPORT' | 'TRANSIT' | 'STAY' | 'EVENT' | 'END';
      title?: string;
      location?: string;
      stayDays?: number;
      startTime?: string;
      durationMinutes?: number;
      transport?: string;
      cabinClass?: string;
      baggageKg?: number;
      description?: string;
    }[];
  };
}

export function tourDestinationIds(tour: TourPackageInputV1): string[] {
  return [
    ...new Set(
      [
        tour.destinationId,
        ...(tour.details?.isCombined
          ? (tour.details.destinations?.map((s) => s.cityId) ?? [])
          : []),
      ].filter(Boolean),
    ),
  ];
}

export function tourStayPeriods(
  tour: TourPackageInputV1,
  startsOn: string,
  endsOn: string,
) {
  const definitions =
    tour.details?.isCombined && tour.details.destinations?.length
      ? tour.details.destinations
      : [
          {
            cityId: tour.destinationId,
            nights: (Date.parse(endsOn) - Date.parse(startsOn)) / 86400000,
          },
        ];
  let cursor = startsOn;
  return definitions.map((stay) => {
    const checkIn = cursor;
    cursor = new Date(
      Date.parse(cursor + 'T00:00:00Z') + stay.nights * 86400000,
    )
      .toISOString()
      .slice(0, 10);
    return { ...stay, checkIn, checkOut: cursor };
  });
}

export interface TourPackageV1 extends TourPackageInputV1 {
  id: string;
  version: number;
  branchId: string;
  createdAt: string;
}

export interface TourDepartureInputV1 {
  packageId: string;
  packageVersion: number;
  startsOn: string;
  endsOn: string;
  outboundOfferId: string;
  returnOfferId?: string;
}

export interface TourDepartureV1 extends TourDepartureInputV1 {
  isActive?: boolean;
  salesVersion?: number;
  isDeleted?: boolean;
  id: string;
  version: number;
  branchId: string;
  package: TourPackageV1;
  outbound: TicketOfferV1;
  returning?: TicketOfferV1;
  remainingCapacity: number;
}
