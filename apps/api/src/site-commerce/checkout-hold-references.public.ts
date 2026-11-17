import type { Prisma } from '@nora/database';
/** Site Commerce owns checkout identity. Caller first authorizes the Ticket Catalog offer and operator. */
export async function readCheckoutHoldReferences(
  client: Prisma.TransactionClient,
  sessionIds: readonly string[],
  branchIds: readonly string[],
) {
  if (!sessionIds.length || !branchIds.length) return [];
  return client.websiteCheckoutSession.findMany({
    where: {
      id: { in: [...new Set(sessionIds)] },
      branchId: { in: [...branchIds] },
    },
    select: { id: true, siteCode: true, externalId: true },
  });
}
