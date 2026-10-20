import { Prisma } from '@nora/database';

export interface CustomerFinancialReleaseFacts {
  contractId: string;
  branchId: string;
  salesOwnerUserId: string;
  hasConfirmedPayment: boolean;
  fullySettled: boolean;
  cancelled?: boolean;
}

/** Revocation only: a balance change never grants a financial release. */
export async function revokeObsoleteCustomerRelease(
  tx: Prisma.TransactionClient,
  facts: CustomerFinancialReleaseFacts,
  actorId: string,
) {
  await tx.$queryRaw(
    Prisma.sql`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${facts.contractId}, 0))`,
  );
  const current = await tx.financeCustomerDocumentDeliveryRevision.findFirst({
    where: { contractId: facts.contractId, branchId: facts.branchId },
    orderBy: { version: 'desc' },
  });
  if (!current?.approved) return;
  const invalid =
    facts.cancelled ||
    (current.basis === 'FULL_SETTLEMENT' && !facts.fullySettled) ||
    (current.basis === 'AFTER_RECEIPT' && !facts.hasConfirmedPayment);
  if (!invalid) return;
  await tx.financeCustomerDocumentDeliveryRevision.create({
    data: {
      contractId: facts.contractId,
      branchId: facts.branchId,
      version: current.version + 1,
      approved: false,
      basis: current.basis,
      reason: facts.cancelled
        ? 'لغو خودکار مجوز تحویل پس از لغو قرارداد'
        : 'لغو خودکار مجوز تحویل پس از تغییر مانده یا استرداد وجه',
      actorUserId: actorId,
    },
  });
}
