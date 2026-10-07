import type { TicketCatalogPurchaseV1 } from './index';
export interface TicketPurchaseInboxItemV1 {
  request: TicketCatalogPurchaseV1;
  cost: {
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
