import type { TelephonyEventV1, TelephonyNumberV1 } from '@nora/contracts';
import type { AmiMessage } from './ami';
import { issabelCallerName } from './caller-name';
import { nativeEventId } from './native-events';

export const companyInboundEvents = new Set([
  'Newchannel',
  'DialBegin',
  'DialEnd',
  'QueueCallerJoin',
  'AgentCalled',
  'AgentConnect',
  'QueueCallerAbandon',
  'Hangup',
]);
const validId = (value: string | undefined): value is string =>
  !!value && /^[a-zA-Z0-9_.:-]{1,100}$/.test(value);
const endpoint = (channel: string | undefined) =>
  /^(SIP|PJSIP)\/([a-zA-Z0-9_.-]+)-[a-f0-9]{8,}$/i.exec(channel ?? '');
const number = (value: string | undefined): TelephonyNumberV1 =>
  value && /^\+?\d{3,15}$/.test(value)
    ? { kind: 'KNOWN', value }
    : {
        kind: /^(anonymous|restricted|withheld|private)$/i.test(value ?? '')
          ? 'WITHHELD'
          : 'UNKNOWN',
        value: null,
      };

/** External origin is established by a verified trunk channel, never by CallerID.
 * Root identity survives queues, direct dials and transfers. A leg end is not a
 * root end. All lookup results are persisted receipts, so restarts are safe.
 */
export async function normalizeCompanyInbound(
  connectionId: string,
  message: AmiMessage,
  trunks: readonly string[],
  extensions: readonly string[],
  lookup: (id: string) => Promise<TelephonyEventV1 | null>,
  receivedAt = new Date(),
): Promise<TelephonyEventV1 | null> {
  if (
    !companyInboundEvents.has(message.event ?? '') ||
    !trunks.length ||
    !extensions.length
  )
    return null;
  const root = message.linkedid,
    leg = message.uniqueid;
  if (!validId(root) || !validId(leg)) return null;
  const anchorId = nativeEventId(root, 'company-inbound-anchor');
  const anchor = await lookup(anchorId);
  const source = endpoint(message.channel);
  if (
    !anchor &&
    !(
      root === leg &&
      source &&
      trunks.includes(`${source[1]}/${source[2]}`) &&
      ['Newchannel', 'DialBegin', 'QueueCallerJoin'].includes(message.event!)
    )
  )
    return null;
  if (message.event === 'Newchannel' && (root !== leg || anchor))
    return anchor && root === leg ? anchor : null;
  const destination = endpoint(message.destchannel);
  const member =
    /^(?:Local\/(\d{2,10})@from-queue\/n|(?:SIP|PJSIP)\/(\d{2,10}))$/.exec(
      message.interface ?? '',
    );
  const extension = ['AgentCalled', 'AgentConnect'].includes(message.event!)
    ? (member?.[1] ?? member?.[2] ?? destination?.[2])
    : destination?.[2];
  const isDial = [
    'DialBegin',
    'DialEnd',
    'AgentCalled',
    'AgentConnect',
  ].includes(message.event!);
  if (
    isDial &&
    (!extension ||
      !extensions.includes(extension) ||
      !validId(message.destuniqueid))
  )
    return null;
  const queueEvent = [
    'QueueCallerJoin',
    'AgentCalled',
    'AgentConnect',
    'QueueCallerAbandon',
  ].includes(message.event!);
  if (queueEvent && !validId(message.queue)) return null;
  if (message.event === 'Hangup' && root !== leg) return null;
  const kind =
    message.event === 'AgentConnect' ||
    (message.event === 'DialEnd' && message.dialstatus === 'ANSWER')
      ? 'ANSWERED'
      : ['Hangup', 'QueueCallerAbandon', 'DialEnd'].includes(message.event!)
        ? 'ENDED'
        : 'RINGING';
  const id = !anchor
    ? anchorId
    : nativeEventId(
        root,
        `company-${message.event}`,
        `${message.destuniqueid ?? leg}:${message.queue ?? ''}`,
      );
  const existing = await lookup(id);
  if (existing) return existing;
  if (
    message.timestamp !== undefined &&
    !/^\d{10}(?:\.\d{1,6})?$/.test(message.timestamp)
  )
    throw Error('NATIVE_TIMESTAMP_INVALID');
  const callerName = anchor
    ? anchor.callerName
    : issabelCallerName(message.calleridname);
  return {
    schemaVersion: 1,
    connectionId,
    externalEventId: id,
    externalCallId: root,
    rootCallId: root,
    legId: isDial ? message.destuniqueid! : leg,
    kind,
    direction: 'IN',
    caller: anchor?.caller ?? number(message.calleridnum),
    ...(callerName ? { callerName } : {}),
    destination: anchor?.destination ?? { kind: 'UNKNOWN', value: null },
    extension: isDial ? extension! : null,
    companyLine: anchor?.companyLine ?? null,
    queue: queueEvent ? message.queue! : null,
    occurredAt: message.timestamp
      ? new Date(Number(message.timestamp) * 1000).toISOString()
      : receivedAt.toISOString(),
    sequence: null,
    terminalForCall: message.event === 'Hangup',
    endReason:
      kind !== 'ENDED'
        ? null
        : message.event === 'QueueCallerAbandon' ||
            ['NOANSWER', 'CANCEL'].includes(message.dialstatus ?? '')
          ? 'NO_ANSWER'
          : ['BUSY', 'CONGESTION', 'CHANUNAVAIL'].includes(
                message.dialstatus ?? '',
              )
            ? 'FAILED'
            : 'UNKNOWN',
    recordingReference: null,
  };
}
