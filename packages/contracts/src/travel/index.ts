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
  remainingCapacity: number;
  status: 'ACTIVE' | 'PAUSED';
}

export type TicketOfferCreateV1 = Omit<
  TicketOfferV1,
  'id' | 'version' | 'branchId' | 'remainingCapacity' | 'status'
>;
export interface TicketOfferSearchV1 {
  originId: string;
  destinationId: string;
  departureFrom: string;
  departureTo?: string;
  cabinClassCode?: TicketOfferV1['cabinClassCode'];
  page?: number;
}

export interface ReservationArrangementV1 {
  version: number;
  roomCount: number;
  singleRoomCount: number;
  doubleRoomCount: number;
  extraBedCount: number;
  hotelGuestCustomerIds: readonly string[];
  reason: string;
  updatedAt: string;
  updatedByUserId: string;
}

export interface ReservationArrangementUpdateV1 {
  expectedVersion: number;
  roomCount: number;
  singleRoomCount: number;
  doubleRoomCount: number;
  extraBedCount: number;
  hotelGuestCustomerIds: readonly string[];
  reason: string;
}

export interface ReservationIntakeV1 {
  purchaseVersion?: number;
  hotelPurchases?: readonly ReservationHotelPurchaseV1[];
  id: string;
  requestId: string;
  contractId: string;
  contractVersion: number;
  branchId: string;
  status: 'QUEUED';
  receivedAt: string;
  snapshot: SalesReservationRequestV1;
  arrangement: ReservationArrangementV1 | null;
}

export interface ReservationHotelPurchaseV1 {
  id: string;
  version: number;
  amount: string;
  currencyCode: string;
  actorUserId: string;
  createdAt: string;
}
export interface ReservationHotelPurchaseInputV1 {
  version: 1;
  expectedVersion: number;
  amount: string;
  currencyCode: string;
}

export interface TravelBrandingV1 {
  kind: 'OWN' | 'AGENCY';
  referenceId: string;
  name: string;
  logoFileId: string | null;
  companyCode?: string;
}
export interface TravelWorkflowStateV1 {
  version: number;
  supplierStatus: 'NEW' | 'REQUESTED' | 'CONFIRMED' | 'CANCELLED';
  supplierReference: string;
  insuranceIssued: boolean;
  insuranceReference: string;
  voucherIssued: boolean;
  insuranceWarningAcknowledged: boolean;
  branding: TravelBrandingV1 | null;
  roomOrder: string[];
  ageOverrides: Record<string, 'ADULT' | 'CHILD' | 'INFANT'>;
  note: string;
  updatedAt: string | null;
  updatedByUserId: string | null;
}
export interface TravelWorkflowCommandV1 {
  expectedVersion: number;
  action:
    | 'BRANDING'
    | 'REQUEST_SUPPLIER'
    | 'CONFIRM_SUPPLIER'
    | 'CANCEL'
    | 'INSURANCE'
    | 'ISSUE_VOUCHER'
    | 'ARRANGEMENT';
  note: string;
  supplierReference?: string;
  insuranceReference?: string;
  acknowledgeMissingInsurance?: boolean;
  roomOrder?: string[];
  ageOverrides?: Record<string, 'ADULT' | 'CHILD' | 'INFANT'>;
  branding?: { kind: 'OWN' | 'AGENCY'; referenceId?: string };
}
export interface TravelDeliveryAuthorizationV1 {
  version: number;
  approved: boolean;
  reason: string;
  updatedAt: string | null;
  updatedByUserId: string | null;
}
