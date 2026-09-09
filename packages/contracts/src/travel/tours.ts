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
