import type { SalesReservationRequestV1 } from '../sales';

export const TRAVEL_RUNTIME_VERSION = 1 as const;

/** Catalog owns published schedule and capacity; negotiated sale price belongs to Sales. */
export interface TicketOfferV1 {
  id: string;
  version: number;
  branchId: string;
  originId: string;
  destinationId: string;
  departureAt: string;
  arrivalAt: string;
  carrierName: string;
  serviceNumber: string;
  cabinClassCode: 'ECONOMY' | 'BUSINESS' | 'FIRST';
  totalCapacity: number;
  status: 'ACTIVE' | 'PAUSED';
}

export type TicketOfferCreateV1 = Omit<
  TicketOfferV1,
  'id' | 'version' | 'branchId' | 'status'
>;
export interface TicketOfferSearchV1 {
  originId: string;
  destinationId: string;
  departureFrom: string;
  departureTo?: string;
  cabinClassCode?: TicketOfferV1['cabinClassCode'];
  page?: number;
}

export interface ReservationIntakeV1 {
  id: string;
  requestId: string;
  contractId: string;
  contractVersion: number;
  branchId: string;
  status: 'QUEUED';
  receivedAt: string;
  snapshot: SalesReservationRequestV1;
}
