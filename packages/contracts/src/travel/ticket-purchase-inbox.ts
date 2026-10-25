import type { TicketCatalogPurchaseV1 } from './index';
export interface TicketPurchaseInboxItemV1 {
  request: TicketCatalogPurchaseV1;
  /** Trusted company-capacity identity; absent for legacy/unclassified requests. */
  flightGroup?: {
    key: string;
    weekday: number;
    flightNumber: string;
    departureDate?: string;
  };

  capacityCost?: {
    purchasedSeats: number;
    allocatedSeats: number;
    unsoldSeats: number;
    amount: string;
    currencyCode: string;
    status: 'REMAINING_CAPACITY' | 'FINAL_LOSS';
  } | null;
  cost: {
    /** Timestamp of the latest recorded cost revision; absent in legacy responses. */
    createdAt?: string | null;
    purchaseGroup?: { id: string; seatCount: number; totalCost: string };

    id: string;
    version: number;
    seatCount: number | null;
    unitCost: string | null;
    invoiceAmount: string;
    currencyCode: string;
    paidAmount: string;
    remainingAmount: string;
    paymentCount: number;
  } | null;
  stage: 'UNPRICED' | 'READY_FOR_PAYMENT' | 'PAYING' | 'PAID';
}

/** One immutable total, apportioned atomically across the selected recurring departures. */
export interface TicketPurchaseGroupCommandV1 {
  version: 1;
  operationId: string;
  members: readonly { requestId: string; expectedCostVersion: number }[];
  seatCount: number;
  totalCost: string;
  currencyCode: string;
  purchaseRateToIrr?: string;
}
