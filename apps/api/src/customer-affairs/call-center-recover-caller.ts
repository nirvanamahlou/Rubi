import type { DatabaseClient } from '@nora/database';
import { ConflictException, NotFoundException } from '@nestjs/common';
import type { CallCenterCrypto } from './call-center.crypto';
import { normalizedCallPhone } from './call-center.service';
import { callSearchMetadata } from './call-center-search';
import type { TelephonyTechnical } from './telephony-state';

/** Operator-invoked recovery only; deliberately not exposed as an HTTP endpoint. */
export async function recoverStoredCaller(
  db: DatabaseClient,
  crypto: CallCenterCrypto,
  callId: string,
) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM call_center_telephony_sessions WHERE "callId"=${callId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM customer_affairs_calls WHERE id=${callId}::uuid FOR UPDATE`;
    const call = await tx.callCenterCall.findUnique({
      where: { id: callId },
      include: { contact: true, telephonySession: true },
    });
    if (
      !call ||
      call.origin !== 'TELEPHONY' ||
      !call.telephonySession ||
      call.telephonySession.synthetic
    )
      throw new NotFoundException();
    const session = call.telephonySession;
    const technical = crypto.decrypt<TelephonyTechnical>(
      session.encryptedTechnical,
      session.keyVersion,
      `telephony:${session.id}`,
    );
    const number =
      technical.first.direction === 'IN'
        ? technical.first.caller
        : technical.first.destination;
    if (number.kind !== 'KNOWN' || !number.value)
      throw new ConflictException('No recorded caller evidence');
    const phone = normalizedCallPhone(number.value);
    const payload = crypto.decrypt<{
      phone: string;
      name: string;
      subject: string;
      source: string;
      operator: string;
      note: string;
    }>(
      call.encryptedPayload,
      call.keyVersion,
      `call:${call.id}:${call.contactId}`,
    );
    if (payload.phone === phone) return { changed: false, callId };
    if (
      payload.phone ||
      (await tx.callCenterCall.count({
        where: { contactId: call.contactId },
      })) !== 1
    )
      throw new ConflictException('Manual reconciliation required');
    const fingerprint = crypto.fingerprint(phone);
    const collision = await tx.callCenterContact.findUnique({
      where: {
        branchId_phoneFingerprint: {
          branchId: call.contact.branchId,
          phoneFingerprint: fingerprint,
        },
      },
    });
    if (collision && collision.id !== call.contactId)
      throw new ConflictException(
        'Existing contact requires explicit reconciliation',
      );
    payload.phone = phone;
    await tx.callCenterContact.update({
      where: { id: call.contactId },
      data: { phoneFingerprint: fingerprint },
    });
    await tx.callCenterCall.update({
      where: { id: callId },
      data: {
        encryptedPayload: crypto.encrypt(
          payload,
          `call:${call.id}:${call.contactId}`,
        ),
        keyVersion: crypto.keyVersion,
        ...callSearchMetadata(
          crypto,
          call.contact.branchId,
          payload,
          call.outcome,
        ),
      },
    });
    await tx.callCenterTelephonySession.update({
      where: { id: session.id },
      data: { version: { increment: 1 } },
    });
    await tx.customerAffairsAuditEvent.create({
      data: {
        branchId: call.contact.branchId,
        entityType: 'CALL_CENTER_CALL',
        entityId: callId,
        action: 'RECOVER_RECORDED_CALLER',
        reason:
          'Restore number from original encrypted telephony evidence; no inferred prefix',
        version: session.version + 1,
      },
    });
    return { changed: true, callId };
  });
}
