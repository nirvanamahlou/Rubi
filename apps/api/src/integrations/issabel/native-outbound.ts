import type { TelephonyEventV1 } from '@nora/contracts';
import type { AmiMessage } from './ami';
import { nativeEventId } from './native-events';

export const outboundEventNames = new Set(['DialBegin', 'DialEnd', 'Hangup']);
const identity = (v: string | undefined): v is string =>
  !!v && /^[a-zA-Z0-9_.:-]{1,100}$/.test(v);
const peer = (v: string | undefined) =>
  /^(SIP|PJSIP)\/(.+)-[a-f0-9]{8,}$/i.exec(v ?? '');

/** Explicit source extensions + trunk allowlist; never infer outbound from CallerID. */
export async function normalizeNativeOutbound(
  connectionId: string,
  message: AmiMessage,
  extensions: readonly string[],
  trunks: readonly string[],
  lookup: (id: string) => Promise<TelephonyEventV1 | null>,
  receivedAt = new Date(),
): Promise<TelephonyEventV1 | null> {
  if (
    !outboundEventNames.has(message.event ?? '') ||
    !extensions.length ||
    !trunks.length
  )
    return null;
  const root = message.linkedid,
    leg = message.uniqueid;
  if (!identity(root) || !identity(leg) || root !== leg) return null;
  const anchorId = nativeEventId(root, 'outbound-anchor');
  const anchor = await lookup(anchorId);
  if (!anchor && message.event !== 'DialBegin') return null;
  const source = peer(message.channel);
  if (!source || !extensions.includes(source[2]!)) return null;
  if (anchor && anchor.extension !== source[2]) return null;
  const destination = peer(message.destchannel);
  if (
    message.event !== 'Hangup' &&
    (!destination ||
      !trunks.includes(`${destination[1]}/${destination[2]}`) ||
      !identity(message.destuniqueid))
  )
    return null;
  // Parallel/fallback trunks retain one call root. Every additional leg needs its
  // own persisted DialBegin; an orphan DialEnd cannot establish a destination.
  const additionalLeg =
    anchor &&
    message.event !== 'Hangup' &&
    anchor.legId !== message.destuniqueid;
  const legAnchorId = nativeEventId(
    root,
    'outbound-leg',
    message.destuniqueid ?? '',
  );
  if (
    additionalLeg &&
    message.event !== 'DialBegin' &&
    !(await lookup(legAnchorId))
  )
    return null;
  const number = message.dialstring?.split('/');
  if (
    message.event === 'DialBegin' &&
    (!number ||
      number.length !== 2 ||
      number[0] !== destination?.[2] ||
      !/^\+?\d{7,15}$/.test(number[1]!))
  )
    return null;
  if (
    anchor &&
    message.event === 'DialBegin' &&
    number?.[1] !== anchor.destination.value
  )
    return null;
  const kind =
    message.event === 'DialBegin'
      ? 'RINGING'
      : message.event === 'DialEnd' && message.dialstatus === 'ANSWER'
        ? 'ANSWERED'
        : 'ENDED';
  const id =
    message.event === 'DialBegin'
      ? additionalLeg
        ? legAnchorId
        : anchorId
      : nativeEventId(
          root,
          `outbound-${message.event}`,
          message.destuniqueid ?? root,
        );
  const existing = await lookup(id);
  if (existing) return existing;
  if (message.timestamp && !/^\d{10}(?:\.\d{1,6})?$/.test(message.timestamp))
    throw Error('NATIVE_TIMESTAMP_INVALID');
  return {
    schemaVersion: 1,
    connectionId,
    externalEventId: id,
    externalCallId: root,
    rootCallId: root,
    legId: message.event === 'Hangup' ? root : message.destuniqueid!,
    kind,
    direction: 'OUT',
    caller: { kind: 'KNOWN', value: source[2]! },
    destination: anchor?.destination ?? { kind: 'KNOWN', value: number![1]! },
    extension: source[2]!,
    companyLine: null,
    queue: null,
    occurredAt: message.timestamp
      ? new Date(Number(message.timestamp) * 1000).toISOString()
      : receivedAt.toISOString(),
    sequence: null,
    terminalForCall: message.event === 'Hangup',
    endReason:
      kind === 'ENDED'
        ? message.dialstatus === 'BUSY'
          ? 'FAILED'
          : message.dialstatus === 'NOANSWER'
            ? 'NO_ANSWER'
            : 'UNKNOWN'
        : null,
    recordingReference: null,
  };
}
