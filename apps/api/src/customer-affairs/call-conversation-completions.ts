import type { Prisma } from '@nora/database';

/** Business callback resolution only. Never creates a PBX answer or access grant. */
export async function conversationCompletions(
  tx: Prisma.TransactionClient,
  branchId: string,
  calls: {
    id: string;
    outcome: string | null;
    telephonySession?: { id: string } | null;
  }[],
  asOf: Date,
) {
  const eligible = calls.filter((call) => call.outcome === 'ANSWERED');
  if (!eligible.length) return new Map<string, number>();
  const identities = new Map<string, string>();
  for (const call of eligible) {
    identities.set(`CALL_CENTER_CALL:${call.id}`, call.id);
    if (call.telephonySession)
      identities.set(`TELEPHONY_CALL:${call.telephonySession.id}`, call.id);
  }
  const result = new Map<string, number>();
  let cursor: string | undefined;
  for (;;) {
    const receipts = await tx.customerAffairsAuditEvent.findMany({
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: 500,
      where: {
        branchId,
        actorUserId: { not: null },
        occurredAt: { lte: asOf },
        OR: [
          {
            entityType: 'CALL_CENTER_CALL',
            action: 'COMPLETE_CALL',
            entityId: { in: eligible.map((c) => c.id) },
          },
          {
            entityType: 'TELEPHONY_CALL',
            action: 'SAVE',
            entityId: {
              in: eligible.flatMap((c) =>
                c.telephonySession ? [c.telephonySession.id] : [],
              ),
            },
          },
        ],
      },
      select: {
        id: true,
        entityId: true,
        entityType: true,
        occurredAt: true,
        afterSnapshot: true,
        beforeSnapshot: true,
      },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
    });
    for (const receipt of receipts) {
      const id = identities.get(`${receipt.entityType}:${receipt.entityId}`);
      if (!id) continue;
      const after = receipt.afterSnapshot as { outcome?: string } | null;
      const before = receipt.beforeSnapshot as { outcome?: string } | null;
      // New receipts explicitly describe the transition. Legacy compatibility uses
      // the first authorized save, not a later edit that could hide a newer miss.
      if (
        after &&
        (after.outcome !== 'ANSWERED' || before?.outcome === 'ANSWERED')
      )
        continue;
      if (!after && result.has(id)) continue;
      result.set(id, receipt.occurredAt.getTime());
    }
    if (receipts.length < 500) break;
    cursor = receipts.at(-1)!.id;
  }
  return result;
}
