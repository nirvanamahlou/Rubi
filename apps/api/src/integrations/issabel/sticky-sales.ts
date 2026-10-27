import { randomUUID } from 'node:crypto';
import type { Prisma } from '@nora/database';
import type { TelephonyEventV1 } from '@nora/contracts';
import type { CallCenterCrypto } from '../../customer-affairs/call-center.crypto';
import { normalizedCallPhone } from '../../customer-affairs/call-center.service';

export function affinityPhone(value: string): string | null {
  if (value.length > 64) return null;
  try {
    return normalizedCallPhone(value);
  } catch {
    return null;
  }
}
const key = (
  crypto: CallCenterCrypto,
  connection: string,
  queue: string,
  phone: string,
) =>
  crypto.fingerprint(
    JSON.stringify(['sticky-sales:v1', connection, queue, phone]),
  );

/** Same transaction as the durable Inbox; a retry cannot create a second answer. */
export async function recordNativeAnswer(
  tx: Prisma.TransactionClient,
  crypto: CallCenterCrypto,
  event: TelephonyEventV1,
  inboxId: string,
) {
  if (event.kind !== 'ANSWERED' || event.direction !== 'IN' || !event.queue)
    return;
  const phone =
    event.caller.kind === 'KNOWN'
      ? affinityPhone(event.caller.value ?? '')
      : null;
  const id = randomUUID();
  await tx.integrationTelephonyAnswer.create({
    data: {
      id,
      connectionId: event.connectionId,
      inboxId,
      queue: event.queue,
      phoneFingerprint: phone
        ? key(crypto, event.connectionId, event.queue, phone)
        : null,
      answeredAt: new Date(event.occurredAt),
      keyVersion: crypto.keyVersion,
      encryptedAnswer: crypto.encrypt(
        { extension: event.extension },
        `telephony:answer:${id}`,
      ),
    },
  });
}

export type MemberSnapshot = {
  queue: string;
  observedAt: Date;
  members: readonly {
    extension: string;
    active: boolean;
    paused: boolean;
    available: boolean;
  }[];
};
export type StickyDecision =
  | { kind: 'FALLBACK'; queue: string; reason: string }
  | {
      kind: 'PREFER';
      extension: string;
      ringSeconds: 10;
      fallbackQueue: string;
    };
export const fallback = (queue: string, reason: string): StickyDecision => ({
  kind: 'FALLBACK',
  queue,
  reason,
});

/** Internal server-only decision port. It never dials, changes a queue or assigns an ERP user. */
export async function selectPreviousAgent(
  tx: Prisma.TransactionClient,
  crypto: CallCenterCrypto,
  connectionId: string,
  queue: string,
  rawPhone: string,
  snapshot: MemberSnapshot | null,
  now = new Date(),
): Promise<StickyDecision> {
  const phone = affinityPhone(rawPhone);
  if (!phone) return fallback(queue, 'UNKNOWN_NUMBER');
  if (
    !snapshot ||
    snapshot.queue !== queue ||
    !Number.isFinite(snapshot.observedAt.getTime()) ||
    snapshot.observedAt > now ||
    now.getTime() - snapshot.observedAt.getTime() > 5000
  )
    return fallback(queue, 'AVAILABILITY_UNKNOWN');
  const rows = await tx.integrationTelephonyAnswer.findMany({
    where: {
      connectionId,
      queue,
      phoneFingerprint: key(crypto, connectionId, queue, phone),
    },
    orderBy: [{ answeredAt: 'desc' }, { id: 'desc' }],
    take: 2,
    select: {
      id: true,
      answeredAt: true,
      encryptedAnswer: true,
      keyVersion: true,
    },
  });
  if (!rows[0]) return fallback(queue, 'NO_ANSWER_HISTORY');
  if (rows[0].answeredAt > now) return fallback(queue, 'HISTORY_TIME_INVALID');
  // Equal timestamps cannot establish the last real agent. Never break this tie by UUID.
  if (rows[1]?.answeredAt.getTime() === rows[0].answeredAt.getTime())
    return fallback(queue, 'AMBIGUOUS_ANSWER_ORDER');
  let extension: string | null;
  try {
    extension = crypto.decrypt<{ extension: string | null }>(
      rows[0].encryptedAnswer,
      rows[0].keyVersion,
      `telephony:answer:${rows[0].id}`,
    ).extension;
  } catch {
    return fallback(queue, 'HISTORY_UNAVAILABLE');
  }
  if (extension === null) return fallback(queue, 'UNKNOWN_ANSWERING_EXTENSION');
  if (typeof extension !== 'string' || !/^\d{2,10}$/.test(extension))
    return fallback(queue, 'HISTORY_UNAVAILABLE');
  const members = snapshot.members.filter((m) => m.extension === extension);
  if (members.length !== 1 || !members[0]!.active)
    return fallback(queue, 'NOT_A_CURRENT_MEMBER');
  if (members[0]!.paused || !members[0]!.available)
    return fallback(queue, 'AGENT_UNAVAILABLE');
  return { kind: 'PREFER', extension, ringSeconds: 10, fallbackQueue: queue };
}
