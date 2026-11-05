import type { DatabaseClient } from '@nora/database';
import type { CallCenterCrypto } from './call-center.crypto';
import { callSearchMetadata } from './call-center-search';

/** Operator-only reconciliation of derived flags; never changes call facts. */
export async function reconcileCallCompletion(
  db: DatabaseClient,
  crypto: CallCenterCrypto,
  callId: string,
  apply = false,
) {
  return db.$transaction(async (tx) => {
    // Same lock order as business completion and telephony updates.
    await tx.$queryRaw`SELECT id FROM call_center_telephony_sessions WHERE "callId"=${callId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM customer_affairs_calls WHERE id=${callId}::uuid FOR UPDATE`;
    const call = await tx.callCenterCall.findUnique({
      where: { id: callId },
      include: { contact: true, telephonySession: true },
    });
    if (!call || !call.needsCompletion || call.origin === 'SYNTHETIC')
      return 'UNCHANGED';
    const session = call.telephonySession;
    if (session && (session.synthetic || session.state !== 'ENDED'))
      return 'SKIPPED_ACTIVE';
    const saved = await tx.customerAffairsAuditEvent.findFirst({
      where: {
        branchId: call.contact.branchId,
        OR: [
          {
            entityId: callId,
            entityType: 'CALL_CENTER_CALL',
            action: { in: ['CREATE', 'COMPLETE_CALL'] },
          },
          ...(session
            ? [
                {
                  entityId: session.id,
                  entityType: 'TELEPHONY_CALL',
                  action: 'SAVE',
                },
              ]
            : []),
        ],
      },
      select: { id: true },
    });
    if (!saved) return 'SKIPPED_UNSAVED';
    const payload = crypto.decrypt<{
      name: string;
      phone: string;
      subject: string;
      source: string;
      operator: string;
    }>(
      call.encryptedPayload,
      call.keyVersion,
      `call:${call.id}:${call.contactId}`,
    );
    if (
      callSearchMetadata(crypto, call.contact.branchId, payload, call.outcome)
        .needsCompletion
    )
      return 'STILL_INCOMPLETE';
    if (!apply) return 'WOULD_REPAIR';
    await tx.callCenterCall.update({
      where: { id: callId },
      data: { needsCompletion: false },
    });
    if (session)
      await tx.callCenterTelephonySession.update({
        where: { id: session.id },
        data: { completed: true, version: { increment: 1 } },
      });
    await tx.customerAffairsAuditEvent.create({
      data: {
        branchId: call.contact.branchId,
        entityId: callId,
        entityType: 'CALL_CENTER_CALL',
        action: 'RECONCILE_CALL_COMPLETION',
        reason: 'Optional caller identity must not block saved call completion',
        version: (session?.version ?? 0) + 1,
        beforeSnapshot: {
          needsCompletion: true,
          sessionCompleted: session?.completed ?? null,
        },
        afterSnapshot: { needsCompletion: false },
      },
    });
    return 'REPAIRED';
  });
}
