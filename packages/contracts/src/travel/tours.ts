import type { TicketOfferV1 } from './index';

/** Ticket Catalog owns this bundle; capacity always belongs to its ticket offers. */
export interface TourPackageInputV1 {
  name: string;
  originId: string;
  destinationId: string;
  hotelIds: string[];
  insuranceId?: string;
  transferOutbound: boolean;
  transferReturn: boolean;
  visa: boolean;
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
  id: string;
  version: number;
  branchId: string;
  package: TourPackageV1;
  outbound: TicketOfferV1;
  returning?: TicketOfferV1;
  remainingCapacity: number;
}
