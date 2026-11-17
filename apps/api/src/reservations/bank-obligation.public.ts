import { Prisma } from '@nora/database';
export function reservationBankPurchase(
  tx: Prisma.TransactionClient,
  id: string,
  branchId: string,
) {
  return tx.reservationServicePurchase.findFirst({
    where: { id, intake: { branchId } },
    select: {
      id: true,
      amount: true,
      currencyCode: true,
      supplierBrokerId: true,
      supplierOrganizationId: true,
      intake: { select: { contractId: true, snapshot: true } },
    },
  });
}

export async function supersededReservationPurchase(
  tx: Prisma.TransactionClient,
  id: string,
) {
  const rows = await tx.$queryRaw<
    { id: string }[]
  >`SELECT p.id FROM "ReservationServicePurchase" p JOIN "ReservationServicePurchase" n ON n."intakeId"=p."intakeId" AND n.version>p.version AND (n."batchId" IS NULL OR n."batchId" IS DISTINCT FROM p."batchId") WHERE p.id=${id}::uuid AND (n."serviceClientKey"=p."serviceClientKey" OR n."coveredServiceClientKeys" ? p."serviceClientKey" OR p."coveredServiceClientKeys" ? n."serviceClientKey" OR n."coveredServiceClientKeys" ?| ARRAY(SELECT jsonb_array_elements_text(p."coveredServiceClientKeys"))) LIMIT 1`;
  return rows.length > 0;
}
export function brokerPurchasesSql(
  branchId: string,
  brokerId: string,
  issuer: string | null,
  end: Date,
) {
  return Prisma.sql`SELECT p.id,p.amount,p."currencyCode" AS currency FROM "ReservationServicePurchase" p JOIN "ReservationIntake" i ON i.id=p."intakeId"
 WHERE i."branchId"=${branchId}::uuid AND p."createdAt"<${end}
 AND coalesce((SELECT s.status::text FROM "FinanceSupplierPaymentRevision" s WHERE s."purchaseId"=p.id AND s."createdAt"<${end} ORDER BY s.version DESC LIMIT 1),'')<>'REJECTED'
 AND (p."supplierBrokerId"=${brokerId}::uuid OR p.id IN(SELECT "purchaseId" FROM transfers))
 AND (${issuer}::uuid IS NULL OR EXISTS(SELECT 1 FROM sales_contracts c WHERE c.id=i."contractId" AND c.legal_entity_id=${issuer}::uuid AND c.finance_hidden_at IS NULL))
 AND (p.id IN(SELECT "purchaseId" FROM transfers) OR NOT EXISTS(SELECT 1 FROM "ReservationServicePurchase" n WHERE n."intakeId"=p."intakeId" AND n.version>p.version AND (n."batchId" IS NULL OR n."batchId" IS DISTINCT FROM p."batchId") AND n."createdAt"<${end} AND (n."serviceClientKey"=p."serviceClientKey" OR n."coveredServiceClientKeys" ? p."serviceClientKey" OR p."coveredServiceClientKeys" ? n."serviceClientKey" OR n."coveredServiceClientKeys" ?| ARRAY(SELECT jsonb_array_elements_text(p."coveredServiceClientKeys")))))`;
}
