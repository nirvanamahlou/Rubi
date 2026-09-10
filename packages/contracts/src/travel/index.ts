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
  contractEditVersion?: number;
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
  supplierFormSettings?: VoucherSettingsV1;
  sentSupplierFormSettings?: VoucherSettingsV1;
  sentSupplierFormVersion?: number;
  appliedContractVersion?: number;
  voucherSettings?: VoucherSettingsV1;
  reservationNotes?: string[];
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
    | 'ARRANGEMENT'
    | 'NOTE'
    | 'VOUCHER_SETTINGS'
    | 'SUPPLIER_FORM_SETTINGS';
  note: string;
  applyToContractAndVoucher?: boolean;
  expectedContractVersion?: number;
  voucherSettings?: VoucherSettingsV1;
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

export const voucherTextKeys = [
  'country',
  'city',
  'hotel',
  'stars',
  'meal',
  'roomType',
  'checkIn',
  'checkOut',
  'website',
  'stayNotes',
  'broker',
  'leaderLanguage',
  'leaderName',
  'leaderPhone',
  'transferBoard',
  'transferPhone',
  'transferKind',
  'excursionDescription',
  'extraServices',
  'remarks',
  'arrivalAirline',
  'arrivalFlight',
  'arrivalDate',
  'arrivalTime',
  'departureAirline',
  'departureFlight',
  'departureDate',
  'departureTime',
] as const;
export const voucherNumberKeys = [
  'singleRooms',
  'doubleRooms',
  'extraBeds',
  'customRooms',
] as const;
export const voucherFlagKeys = [
  'withLetterhead',
  'hotel',
  'transfer',
  'tourLeader',
  'excursion',
  'specialRoom',
] as const;
export interface VoucherSettingsV1 {
  text: Record<(typeof voucherTextKeys)[number], string>;
  numbers: Record<(typeof voucherNumberKeys)[number], number>;
  flags: Record<(typeof voucherFlagKeys)[number], boolean>;
  passengers: {
    id: string;
    selected: boolean;
    roomType: string;
    age: 'ADL' | 'CHD' | 'INF';
    sex?: 'MALE' | 'FEMALE' | '';
    birthDate?: string;
    documentNumber?: string;
  }[];
}
