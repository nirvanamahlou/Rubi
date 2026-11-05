import { createHash, randomUUID } from 'node:crypto';
import type { Prisma } from '@nora/database';

type SavedFollowupCall = {
  id: string;
  contactId: string;
  ticketId: string | null;
  origin: string | null;
  occurredAt: Date;
  outcome: string | null;
};

const FOLLOWUP_OUTCOMES = new Set([
  'ANSWERED',
  'NO_ANSWER',
  'BUSY',
  'FAILED',
  'WRONG_NUMBER',
]);

/** All pending IDs participate, so even a backdated new receipt invalidates a decision. */
export function pendingReviewToken(
  receipts: readonly { id: string; reviewedAt?: Date | null }[],
): string | null {
  const ids = receipts
    .filter((receipt) => receipt.reviewedAt == null)
    .map((receipt) => receipt.id)
    .sort();
  return ids.length
    ? createHash('sha256').update(JSON.stringify(ids)).digest('hex')
    : null;
}

/** Called only after an authorized call save, inside that same transaction. */
export async function recordCallRequestReview(
  tx: Prisma.TransactionClient,
  input: {
    branchId: string;
    actorUserId: string;
    call: SavedFollowupCall;
    synthetic: boolean | undefined;
    completedAt?: Date;
  },
): Promise<boolean> {
  const { call, branchId, actorUserId } = input;
  if (
    call.origin !== 'TELEPHONY' ||
    input.synthetic !== false ||
    !call.ticketId ||
    !call.outcome ||
    !FOLLOWUP_OUTCOMES.has(call.outcome)
  )
    return false;

  // The caller locks the call first. SHARE prevents reassignment/closure racing
  // this receipt; never upgrade this lock (manager decisions use FOR UPDATE).
  await tx.$queryRaw`SELECT id FROM customer_affairs_tickets WHERE id=${call.ticketId}::uuid FOR SHARE`;
  const ticket = await tx.customerAffairsTicket.findFirst({
    where: {
      id: call.ticketId,
      branchId,
      callCenterContactId: call.contactId,
      category: 'CALL_CENTER_REQUEST',
      status: { not: 'CLOSED' },
      executionOwnerUserId: actorUserId,
      createdAt: { lte: call.occurredAt },
    },
    select: { id: true, version: true },
  });
  if (!ticket) return false;

  const id = randomUUID();
  const completedAt = input.completedAt ?? new Date();
  const created = await tx.callCenterRequestReview.createMany({
    data: {
      id,
      ticketId: ticket.id,
      callId: call.id,
      completedByUserId: actorUserId,
      completedAt,
    },
    skipDuplicates: true,
  });
  // A reviewed call saved again must not requeue or refresh its completion date.
  if (!created.count) return false;
  await tx.customerAffairsAuditEvent.create({
    data: {
      branchId,
      actorUserId,
      entityType: 'CALL_CENTER_REQUEST',
      entityId: ticket.id,
      action: 'REQUEST_FOLLOWUP_RECORDED',
      version: ticket.version,
      afterSnapshot: { reviewId: id, callId: call.id },
      occurredAt: completedAt,
    },
  });
  return true;
}
