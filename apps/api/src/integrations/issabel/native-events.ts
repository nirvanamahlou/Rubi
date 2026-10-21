import { createHash } from 'node:crypto';
import type { TelephonyEventV1, TelephonyNumberV1 } from '@nora/contracts';
import type { AmiMessage } from './ami';

/** Native queue capture only. No inferred dialplan, extension owner or outbound call. */
export const nativeEventNames = new Set([
  'QueueCallerJoin',
  'AgentCalled',
  'AgentConnect',
  'Hangup',
]);
const identity = (value: string | undefined): value is string =>
  !!value && /^[a-zA-Z0-9_.:-]{1,100}$/.test(value);
export const nativeEventId = (root: string, kind: string, leg = '') =>
  createHash('sha256')
    .update(JSON.stringify(['ami-native-v1', root, kind, leg]))
    .digest('hex');
const phone = (value: string | undefined): TelephonyNumberV1 => {
  if (value && /^\+?\d{7,15}$/.test(value)) return { kind: 'KNOWN', value };
  return {
    kind: /^(anonymous|restricted|withheld|private)$/i.test(value ?? '')
      ? 'WITHHELD'
      : 'UNKNOWN',
    value: null,
  };
};

export async function normalizeNativeQueueEvent(
  connectionId: string,
  message: AmiMessage,
  queues: readonly string[],
  lookup: (externalEventId: string) => Promise<TelephonyEventV1 | null>,
  receivedAt = new Date(),
): Promise<TelephonyEventV1 | null> {
  if (!nativeEventNames.has(message.event ?? '')) return null;
  const root = message.linkedid,
    leg = message.uniqueid;
  if (!identity(root) || !identity(leg)) return null;
  // A member/channel Hangup cannot terminate the root call (ring groups/transfers).
  if (message.event === 'Hangup' && leg !== root) return null;
  if (
    message.event !== 'Hangup' &&
    (!identity(message.queue) || !queues.includes(message.queue))
  )
    return null;

  const anchorId = nativeEventId(root, 'anchor');
  const anchor = await lookup(anchorId);
  // Do not manufacture calls from unrelated Hangups or a partially observed queue.
  if (!anchor && message.event !== 'QueueCallerJoin') return null;
  const kind =
    message.event === 'Hangup'
      ? 'ENDED'
      : message.event === 'AgentConnect'
        ? 'ANSWERED'
        : 'RINGING';
  const destinationLeg = message.destuniqueid;
  if (
    ['AgentCalled', 'AgentConnect'].includes(message.event!) &&
    !identity(destinationLeg)
  )
    return null;
  const eventId =
    message.event === 'QueueCallerJoin'
      ? anchorId
      : kind === 'ENDED'
        ? nativeEventId(root, 'end')
        : kind === 'ANSWERED'
          ? nativeEventId(root, 'answer')
          : nativeEventId(root, 'ring', destinationLeg);
  // Preserve first receipt time across retries even when AMI has no Timestamp.
  const existing = eventId === anchorId ? anchor : await lookup(eventId);
  if (existing) return existing;
  let occurredAt = receivedAt.toISOString();
  if (message.timestamp !== undefined) {
    if (!/^\d{10}(?:\.\d{1,6})?$/.test(message.timestamp))
      throw Error('NATIVE_TIMESTAMP_INVALID');
    occurredAt = new Date(Number(message.timestamp) * 1000).toISOString();
  }
  const answered =
    kind === 'ENDED' ? await lookup(nativeEventId(root, 'answer')) : null;
  return {
    schemaVersion: 1,
    connectionId,
    externalEventId: eventId,
    externalCallId: root,
    rootCallId: root,
    legId: kind === 'ENDED' ? root : (destinationLeg ?? leg),
    kind,
    direction: 'IN',
    caller: anchor?.caller ?? phone(message.calleridnum),
    destination: anchor?.destination ?? { kind: 'UNKNOWN', value: null },
    companyLine: null,
    // Deliberately no recipient/extension inference until the owner approves mapping.
    extension: null,
    queue: message.queue ?? anchor?.queue ?? null,
    occurredAt,
    sequence: null,
    terminalForCall: kind === 'ENDED',
    endReason: kind === 'ENDED' ? (answered ? 'COMPLETED' : 'UNKNOWN') : null,
    recordingReference: null,
  };
}
