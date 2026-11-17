import type { Prisma } from '@nora/database';
import { brokerPurchasesSql } from '../../reservations/bank-obligation.public';
import { brokerInvoicesSql } from '../../procurement/bank-obligation.public';
/** One credit per purchase, regardless of the number of transfer tranches. */
export async function brokerBalances(
  tx: Prisma.TransactionClient,
  book: { id: string; branchId: string },
  brokerId: string,
  issuer: string | null,
  end: Date,
) {
  return tx.$queryRaw<
    {
      currency: string;
      credit: string;
      debit: string;
      balance: string;
      pending: string;
    }[]
  >`
 WITH transfers AS (
   SELECT * FROM finance_broker_transfers WHERE "bookId"=${book.id}::uuid AND "brokerId"=${brokerId}::uuid AND "sentAt"<${end}
 ), purchases AS (
   SELECT p.id,p.amount,p.currency,'R' AS kind FROM (${brokerPurchasesSql(book.branchId, brokerId, issuer, end)}) p
   UNION ALL
   SELECT c.id,c."invoiceAmount",c."currencyCode",'T' FROM "FinanceTicketPurchaseCostRevision" c WHERE c.id IN(SELECT "costId" FROM transfers)
   UNION ALL
   SELECT i.id,i.amount,i.currency,'I' FROM (${brokerInvoicesSql()}) i WHERE i.id IN(SELECT "invoiceId" FROM transfers)
 ), balances AS (
  SELECT p.*,CASE p.kind WHEN 'R' THEN (SELECT coalesce(sum(coalesce(s."paidAmount",CASE WHEN s.status='PAID' THEN p.amount ELSE 0 END)),0) FROM "FinanceSupplierPaymentRevision" s WHERE s."purchaseId"=p.id AND coalesce(s."transferAt",s."createdAt")<${end})
  WHEN 'T' THEN (SELECT coalesce(sum(s."paidAmount"),0) FROM "FinanceTicketPurchasePaymentRevision" s WHERE s."costRevisionId"=p.id AND s."transferAt"<${end})
  ELSE (SELECT coalesce(sum(s."paidAmount"),0) FROM finance_procurement_invoice_revisions s WHERE s."sourceId"=p.id AND s."transferAt"<${end}) END AS paid FROM purchases p)
 SELECT b.currency,sum(b.amount)::text AS credit,sum(b.paid)::text AS debit,(sum(b.amount)-sum(b.paid))::text AS balance,
 (SELECT coalesce(sum(t.amount),0)::text FROM transfers t WHERE t.currency=b.currency AND (t."receivedAt" IS NULL OR t."receivedAt">=${end})) AS pending
 FROM balances b GROUP BY b.currency ORDER BY b.currency`;
}
