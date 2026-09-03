export const SALES_CONTRACT_VERSION = 1 as const;
export const SALES_API_PREFIX = '/api/v1/sales' as const;

export const SALES_PERMISSION_CODES = [
  'sales.contracts.read.own',
  'sales.contracts.read.branch',
  'sales.contracts.read.all',
  'sales.contracts.create',
  'sales.contracts.update.own',
  'sales.contracts.update.branch',
  'sales.contracts.confirm',
  'sales.contracts.cancel',
  'sales.payments.create',
  'sales.payments.read',
  'sales.reservation_request.create',
  'sales.audit.read',
  'sales.export',
] as const;
export type SalesPermissionCode = (typeof SALES_PERMISSION_CODES)[number];

export const SALES_ERROR_CODES = [
  'SALES_CONTRACT_NOT_FOUND',
  'SALES_CONTRACT_FORBIDDEN',
  'CONCURRENT_MODIFICATION',
  'IDEMPOTENCY_CONFLICT',
  'TICKET_NOT_AVAILABLE',
  'RETURN_TICKET_INVALID',
  'PAYMENT_CURRENCY_MISMATCH',
  'FINANCE_CONFIRMATION_REQUIRED',
  'RESERVATION_REQUEST_ALREADY_SENT',
] as const;
export type SalesErrorCode = (typeof SALES_ERROR_CODES)[number];

export type SalesTripType = 'ONE_WAY' | 'ROUND_TRIP';
export type SalesContractStatus =
  | 'DRAFT'
  | 'PENDING_CONFIRMATION'
  | 'CONFIRMED'
  | 'SENT_TO_RESERVATIONS'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';
export type SalesReservationStatus =
  | 'NOT_SENT'
  | 'QUEUED'
  | 'ACCEPTED'
  | 'NEEDS_REVIEW'
  | 'PARTIALLY_FULFILLED'
  | 'FULFILLED'
  | 'REJECTED';
export type SalesSettlementStatus =
  'UNPAID' | 'PARTIALLY_SETTLED' | 'SETTLED' | 'OVERPAID';
export type SalesServiceKind =
  | 'FLIGHT'
  | 'HOTEL'
  | 'VISA'
  | 'INSURANCE'
  | 'TRANSFER'
  | 'TOUR'
  | 'BUS'
  | 'TRAIN'
  | 'CIP'
  | 'OTHER';
export type SalesPassengerAgeCategory = 'ADT' | 'CHD' | 'INF';
export type SalesTicketDirection = 'OUTBOUND' | 'RETURN';
export type SalesPaymentMethod =
  | 'CASH'
  | 'POS'
  | 'BANK_TRANSFER'
  | 'ONLINE_GATEWAY'
  | 'REMITTANCE'
  | 'CUSTOMER_CREDIT'
  | 'CHECK'
  | 'OTHER';
export type SalesPaymentStatus =
  | 'SCHEDULED'
  | 'PENDING_FINANCE_CONFIRMATION'
  | 'FINANCE_CONFIRMED'
  | 'FINANCE_REJECTED';

export interface SalesMoney {
  amount: string;
  currencyCode: string;
}

export interface SalesServiceInput {
  clientKey: string;
  kind: SalesServiceKind;
  referenceId?: string | null;
  titleSnapshot: string;
  status?:
    'SELECTED' | 'AWAITING_PUBLIC_API' | 'NEEDS_RESERVATION_CONFIRMATION';
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface SalesPassengerInput {
  customerId: string;
  displayNameSnapshot: string;
  birthDate: string;
  serviceClientKeys: readonly string[];
}

export interface SalesTicketSelectionInput {
  serviceClientKey: string;
  direction: SalesTicketDirection;
  offerId: string;
  originId: string;
  destinationId: string;
  departureAt: string;
  arrivalAt: string;
  carrierNameSnapshot: string;
  serviceNumberSnapshot: string;
  cabinClassCode: string;
  quotedPrice: SalesMoney;
}

export interface SalesHotelSelectionInput {
  serviceClientKey: string;
  hotelId: string;
  hotelNameSnapshot: string;
  cityId: string;
  checkInDate: string;
  checkOutDate: string;
  roomCount: number;
  roomTypeId: string;
  mealServiceId?: string | null;
  occupancy: number;
  inventoryStatus: 'AVAILABLE' | 'NEEDS_RESERVATION_CONFIRMATION';
}

export interface SalesPriceComponentInput extends SalesMoney {
  type: 'BASE' | 'DISCOUNT' | 'TAX' | 'SURCHARGE';
  title: string;
}

export interface SalesPaymentInput extends SalesMoney {
  dueAt: string;
  method: SalesPaymentMethod;
  description?: string | null;
  paymentReference?: string | null;
  check?: {
    bankId: string;
    secureIdentifier: string;
    ownerName: string;
    dueDate: string;
  } | null;
}

export interface SalesContractCreateRequest {
  customerId: string;
  payerCustomerId?: string | null;
  assignedUserId?: string | null;
  tripType: SalesTripType;
  originId: string;
  destinationId: string;
  departureDate: string;
  returnNotBefore?: string | null;
  services: readonly SalesServiceInput[];
  passengers: readonly SalesPassengerInput[];
  ticketSelections?: readonly SalesTicketSelectionInput[];
  hotelSelection?: SalesHotelSelectionInput | null;
  priceComponents: readonly SalesPriceComponentInput[];
  payments?: readonly SalesPaymentInput[];
  fxSnapshot?: {
    rate: string;
    source: string;
    observedAt: string;
  } | null;
  pricingNotes?: string | null;
}

export interface SalesContractUpdateRequest extends SalesContractCreateRequest {
  version: number;
  reason?: string | null;
}

export interface SalesContractCommandRequest {
  version: number;
  reason?: string | null;
}

export interface SalesPaymentCreateRequest extends SalesPaymentInput {
  version: number;
}

export interface SalesContractListQuery {
  search?: string;
  branchId?: string;
  ownerUserId?: string;
  originId?: string;
  destinationId?: string;
  serviceKind?: SalesServiceKind;
  status?: SalesContractStatus;
  settlementStatus?: SalesSettlementStatus;
  reservationStatus?: SalesReservationStatus;
  currencyCode?: string;
  createdFrom?: string;
  createdTo?: string;
  travelFrom?: string;
  travelTo?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'departureDate' | 'contractNumber';
  sortDirection?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface SalesBalance extends SalesMoney {
  confirmedPaid: string;
  pendingFinance: string;
  outstanding: string;
}

export interface SalesContractSummary {
  id: string;
  contractNumber: string;
  customerId: string;
  customerNameSnapshot: string;
  passengerNames: readonly string[];
  ownerUserId: string;
  assignedUserId: string | null;
  branchId: string;
  originId: string;
  destinationId: string;
  departureDate: string;
  returnNotBefore: string | null;
  services: readonly SalesServiceKind[];
  status: SalesContractStatus;
  settlementStatus: SalesSettlementStatus;
  reservationStatus: SalesReservationStatus;
  balances: readonly SalesBalance[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface SalesContractDetail extends SalesContractSummary {
  tripType: SalesTripType;
  payerCustomerId: string;
  servicesDetail: readonly SalesServiceInput[];
  passengersDetail: readonly (SalesPassengerInput & {
    id: string;
    ageCategory: SalesPassengerAgeCategory;
  })[];
  ticketSelections: readonly SalesTicketSelectionInput[];
  hotelSelection: SalesHotelSelectionInput | null;
  priceComponents: readonly SalesPriceComponentInput[];
  payments: readonly (SalesPaymentInput & {
    id: string;
    status: SalesPaymentStatus;
    createdAt: string;
    financeConfirmedAt: string | null;
  })[];
  fxSnapshot: SalesContractCreateRequest['fxSnapshot'];
  pricingNotes: string | null;
}

export interface SalesContractPage {
  data: readonly SalesContractSummary[];
  meta: { page: number; pageSize: number; total: number };
}

export interface SalesDashboard {
  data: {
    todayContracts: number;
    activeContracts: number;
    unpaidContracts: number;
    partiallySettledContracts: number;
    settledContracts: number;
    rialSales: string;
    foreignCommitments: readonly SalesMoney[];
    outstanding: readonly SalesMoney[];
    pendingFinancePayments: number;
    pendingReservationActions: number;
    salesByCounter: readonly {
      ownerUserId: string;
      amount: string;
      currencyCode: string;
    }[];
    conversionRate: null;
    conversionRateStatus: 'AWAITING_CUSTOMER_AFFAIRS_PUBLIC_CONTRACT';
  };
}

export interface SalesReservationRequestV1 {
  version: 1;
  requestId: string;
  contractId: string;
  contractNumber: string;
  contractVersion: number;
  customerId: string;
  passengerIds: readonly string[];
  serviceSelections: readonly SalesServiceInput[];
  selectedTicketOfferIds: readonly string[];
  hotelSelection: SalesHotelSelectionInput | null;
  createdAt: string;
}

export interface SalesFinanceSubmissionV1 {
  version: 1;
  contractId: string;
  contractNumber: string;
  payerCustomerId: string;
  priceComponents: readonly SalesPriceComponentInput[];
  payments: readonly SalesPaymentInput[];
  occurredAt: string;
}

export interface SalesFinancePaymentConfirmedV1 {
  version: 1;
  eventId: string;
  contractId: string;
  paymentId: string;
  financePaymentReference: string;
  confirmedAt: string;
}

export const salesEndpoints = {
  contracts: `${SALES_API_PREFIX}/contracts`,
  contract: (id: string) =>
    `${SALES_API_PREFIX}/contracts/${encodeURIComponent(id)}`,
  confirm: (id: string) =>
    `${SALES_API_PREFIX}/contracts/${encodeURIComponent(id)}/confirm`,
  cancel: (id: string) =>
    `${SALES_API_PREFIX}/contracts/${encodeURIComponent(id)}/cancel`,
  payments: (id: string) =>
    `${SALES_API_PREFIX}/contracts/${encodeURIComponent(id)}/payments`,
  reservationRequest: (id: string) =>
    `${SALES_API_PREFIX}/contracts/${encodeURIComponent(id)}/reservation-request`,
  audit: (id: string) =>
    `${SALES_API_PREFIX}/contracts/${encodeURIComponent(id)}/audit`,
  statusHistory: (id: string) =>
    `${SALES_API_PREFIX}/contracts/${encodeURIComponent(id)}/status-history`,
  dashboard: `${SALES_API_PREFIX}/dashboard`,
} as const;
