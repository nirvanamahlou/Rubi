import type {
  FinanceInboxItemV1,
  FinanceTicketCostCommandV1,
} from '@nora/contracts';
import { ticketPurchaseTotal } from './ticket-purchase-total';
export async function prepareTicketPayment(
  item: FinanceInboxItemV1,
  draft: { seatCount: string; unitCost: string; currencyCode: string },
  record: (
    requestId: string,
    input: FinanceTicketCostCommandV1,
  ) => Promise<{
    data: {
      id: string;
      version: number;
      invoiceAmount: string;
      currencyCode: string;
      seatCount: number;
      unitCost: string;
    };
  }>,
): Promise<FinanceInboxItemV1> {
  const ticket = item.ticketPurchase;
  if (!ticket) throw new Error('درخواست خرید بلیط معتبر نیست.');
  if (ticket.paymentCount > 0) return item;
  const invoice = ticketPurchaseTotal(draft.seatCount, draft.unitCost);
  if (!invoice || !/^[A-Z]{3}$/.test(draft.currencyCode))
    throw new Error('تعداد صندلی، قیمت خرید و ارز را کامل کنید.');
  if (
    ticket.seatCount === Number(draft.seatCount) &&
    ticketPurchaseTotal('1', ticket.unitCost ?? '') ===
      ticketPurchaseTotal('1', draft.unitCost) &&
    item.amount?.currencyCode === draft.currencyCode &&
    item.amount.amount === invoice
  )
    return item;
  const { data } = await record(item.sourceReference, {
    version: 1,
    seatCount: Number(draft.seatCount),
    unitCost: draft.unitCost,
    currencyCode: draft.currencyCode,
  });
  return {
    ...item,
    sourceContextReference: data.id,
    sourceVersion: data.version,
    amount: { amount: data.invoiceAmount, currencyCode: data.currencyCode },
    settlement: { paidAmount: '0', remainingAmount: data.invoiceAmount },
    ticketPurchase: {
      ...ticket,
      seatCount: data.seatCount,
      unitCost: data.unitCost,
    },
  };
}
