import type { Prisma } from '@nora/database';

/** Resolve protected phone identities without exposing contact values. */
export function customerIdsForPhoneFingerprints(
  db: Prisma.TransactionClient,
  fingerprints: string[],
) {
  return db.customerContact.findMany({
    where: { type: 'PHONE', valueFingerprint: { in: fingerprints } },
    select: { customerId: true, valueFingerprint: true },
  });
}
