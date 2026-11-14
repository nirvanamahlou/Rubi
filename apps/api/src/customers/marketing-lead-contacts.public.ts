import type { DatabaseService } from '../database/database.service';

export function marketingLeadContacts(
  database: DatabaseService,
  fingerprints: string[],
) {
  if (!fingerprints.length) return [];
  return database.client.customerContact.findMany({
    where: { type: 'PHONE', valueFingerprint: { in: fingerprints } },
    select: { valueFingerprint: true, customerId: true },
  });
}
