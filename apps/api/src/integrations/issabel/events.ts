import { createHash } from 'node:crypto';
import type { TelephonyEventV1, TelephonyNumberV1 } from '@nora/contracts';
import type { AmiMessage } from './ami';
import { issabelCallerName } from './caller-name';

const phone = (value: string | undefined): TelephonyNumberV1 =>
  value && /^\+?\d{3,15}$/.test(value)
    ? { kind: 'KNOWN', value }
    : { kind: value === 'WITHHELD' ? 'WITHHELD' : 'UNKNOWN', value: null };

/** Explicit custom-dialplan facts; no inference from a ring-group leg Hangup. */
export function normalizeIssabelEvent(
  connectionId: string,
  message: AmiMessage,
): TelephonyEventV1 | null {
  if (message.event !== 'UserEvent' || message.userevent !== 'NoraCall')
    return null;
  if (message.schemaversion !== '1') throw Error('ISSABEL_EVENT_VERSION');
  const kind = message.kind;
  if (
    !['RINGING', 'ANSWERED', 'ENDED', 'TRANSFERRED'].includes(kind ?? '') ||
    !['IN', 'OUT'].includes(message.direction ?? '') ||
    !/^\d{10}(?:\.\d{1,3})?$/.test(message.occurredat ?? '') ||
    !message.externalcallid ||
    !message.rootcallid ||
    (message.terminalforcall !== '0' && message.terminalforcall !== '1') ||
    (message.extension && !/^\d{2,10}$/.test(message.extension))
  )
    throw Error('ISSABEL_INVALID_FACT');
  const event: TelephonyEventV1 = {
    schemaVersion: 1,
    connectionId,
    externalEventId: '',
    externalCallId: message.externalcallid,
    rootCallId: message.rootcallid,
    legId: message.externalcallid,
    kind: kind as TelephonyEventV1['kind'],
    direction: message.direction as 'IN' | 'OUT',
    caller: phone(message.caller),
    ...(issabelCallerName(message.calleridname)
      ? { callerName: issabelCallerName(message.calleridname) }
      : {}),
    destination: phone(message.destination),
    companyLine: message.companyline || null,
    extension: message.extension || null,
    queue: message.queue || null,
    occurredAt: new Date(Number(message.occurredat) * 1000).toISOString(),
    sequence: null,
    terminalForCall: message.terminalforcall === '1',
    endReason:
      kind === 'ENDED' &&
      ['COMPLETED', 'NO_ANSWER', 'CANCELLED', 'FAILED', 'UNKNOWN'].includes(
        message.endreason ?? '',
      )
        ? (message.endreason as TelephonyEventV1['endReason'])
        : null,
    recordingReference: null,
  };
  event.externalEventId = createHash('sha256')
    .update(JSON.stringify(event))
    .digest('hex');
  return event;
}
