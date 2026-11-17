import { Prisma } from '@nora/database';
export function purchaseBankInvoice(
  tx: Prisma.TransactionClient,
  id: string,
  branchId: string,
  issuer?: string | null,
) {
  return tx.procurementInvoice.findFirst({
    where: {
      id,
      ...(issuer ? { issuerLegalEntityId: issuer } : {}),
      procurementInvoiceRequestid: { branchId },
    },
    select: { totalAmount: true, currencyCode: true },
  });
}

export const brokerInvoicesSql = () =>
  Prisma.sql`SELECT id,"totalAmount" AS amount,"currencyCode" AS currency FROM procurement_invoice`;
