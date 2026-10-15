import type { TicketCatalogPurchaseV1 } from './index';
export interface TicketPurchaseInboxItemV1 {
  request: TicketCatalogPurchaseV1;
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
