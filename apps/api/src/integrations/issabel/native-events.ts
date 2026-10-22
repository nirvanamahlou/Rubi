import { createHash } from 'node:crypto';
import type { TelephonyEventV1, TelephonyNumberV1 } from '@nora/contracts';
import type { AmiMessage } from './ami';
import { issabelCallerName } from './caller-name';

/** Native queue capture only. No inferred dialplan, extension owner or outbound call. */
export const nativeEventNames = new Set([
  'QueueCallerJoin',
  'AgentCalled',
  'AgentConnect',
  'QueueCallerAbandon',
  'Hangup',
]);
const identity = (value: string | undefined): value is string =>
  !!value && /^[a-zA-Z0-9_.:-]{1,100}$/.test(value);
export const nativeEventId = (root: string, kind: string, leg = '') =>
  createHash('sha256')
    .update(JSON.stringify(['ami-native-v1', root, kind, leg]))
    .digest('hex');
const phone = (value: string | undefined): TelephonyNumberV1 => {
  if (value && /^\+?\d{3,15}$/.test(value)) return { kind: 'KNOWN', value };
  return {
    kind: /^(anonymous|restricted|withheld|private)$/i.test(value ?? '')
      ? 'WITHHELD'
      : 'UNKNOWN',
    value: null,
  };
};

/** Observed queue member Interface, never display name, caller ID or dialplan Exten. */
export function answeredExtension(message: AmiMessage): string | null {
  if (message.event !== 'AgentConnect') return null;
  return (
    /^Local\/(\d{2,10})@from-queue\/n$/.exec(message.interface ?? '')?.[1] ??
    null
  );
}

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
  const kind = ['Hangup', 'QueueCallerAbandon'].includes(message.event!)
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
  const firstAnswer = await lookup(nativeEventId(root, 'answer'));
  const eventId =
    message.event === 'QueueCallerJoin'
      ? anchorId
      : kind === 'ENDED'
        ? nativeEventId(
            root,
            message.event === 'QueueCallerAbandon' ? 'abandon' : 'end',
          )
        : kind === 'ANSWERED'
          ? firstAnswer && firstAnswer.legId !== destinationLeg
            ? nativeEventId(root, 'answer', destinationLeg)
            : nativeEventId(root, 'answer')
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
  const answered = kind === 'ENDED' ? firstAnswer : null;
  // Never use a later agent leg's display name as the external caller's name.
  const callerName = anchor
    ? anchor.callerName
    : issabelCallerName(message.calleridname);
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
    ...(callerName ? { callerName } : {}),
    destination: anchor?.destination ?? { kind: 'UNKNOWN', value: null },
    companyLine: null,
    // Technical answer evidence only. Native ingress independently suppresses recipients.
    extension: answeredExtension(message),
    queue: message.queue ?? anchor?.queue ?? null,
    occurredAt,
    sequence: null,
    terminalForCall: message.event === 'Hangup',
    endReason:
      kind === 'ENDED'
        ? answered
          ? 'COMPLETED'
          : message.event === 'QueueCallerAbandon'
            ? 'NO_ANSWER'
            : 'UNKNOWN'
        : null,
    recordingReference: null,
  };
}
