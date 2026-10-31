import { BadRequestException } from '@nestjs/common';
import type { TelephonyEventV1, TelephonyNumberV1 } from '@nora/contracts';
const fail = (): never => {
  throw new BadRequestException('Invalid internal telephony v1 event.');
};
export function validateTelephonyEvent(
  input: unknown,
  policy: { maxAgeSeconds: number; maxFutureSeconds: number },
  now = new Date(),
  enforceClock = true,
): TelephonyEventV1 {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Buffer.byteLength(JSON.stringify(input)) > 16384
  )
    return fail();
  const e = input as Record<string, unknown>;
  const keys = [
    'schemaVersion',
    'connectionId',
    'externalEventId',
    'externalCallId',
    'rootCallId',
    'legId',
    'kind',
    'direction',
    'caller',
    'destination',
    'companyLine',
    'extension',
    'queue',
    'occurredAt',
    'sequence',
    'terminalForCall',
    'endReason',
    'recordingReference',
  ];
  if (
    Object.keys(e).some((k) => !keys.includes(k) && k !== 'callerName') ||
    keys.some((k) => !(k in e))
  )
    return fail();
  const str = (k: string, nullable = false, max = 128) => {
    const v = e[k];
    if (nullable && v === null) return;
    if (
      typeof v !== 'string' ||
      !v.trim() ||
      v.length > max ||
      [...v].some((c) => c.charCodeAt(0) < 32)
    )
      fail();
  };
  for (const k of [
    'connectionId',
    'externalEventId',
    'externalCallId',
    'occurredAt',
  ])
    str(k);
  for (const k of [
    'rootCallId',
    'legId',
    'companyLine',
    'extension',
    'queue',
    'recordingReference',
  ])
    str(k, true, k === 'recordingReference' ? 512 : 128);
  const number = (v: unknown): TelephonyNumberV1 => {
    if (!v || typeof v !== 'object') return fail();
    const n = v as TelephonyNumberV1;
    if (
      Object.keys(v).some((k) => !['kind', 'value'].includes(k)) ||
      !['KNOWN', 'WITHHELD', 'UNKNOWN'].includes(n.kind)
    )
      return fail();
    if (
      n.kind === 'KNOWN'
        ? typeof n.value !== 'string' || !/^\+?[0-9]{3,15}$/.test(n.value)
        : n.value !== null
    )
      return fail();
    return { kind: n.kind, value: n.value };
  };
  if (
    typeof e.connectionId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      e.connectionId,
    )
  )
    return fail();
  number(e.caller);
  if ('callerName' in e) {
    str('callerName', true, 160);
    if (
      typeof e.callerName === 'string' &&
      /[\u007f\u202a-\u202e\u2066-\u2069]/u.test(e.callerName)
    )
      fail();
  }
  number(e.destination);
  if (
    e.schemaVersion !== 1 ||
    ![
      'RINGING',
      'ANSWERED',
      'ENDED',
      'RECORDING_READY',
      'TRANSFERRED',
    ].includes(String(e.kind)) ||
    !['IN', 'OUT'].includes(String(e.direction)) ||
    typeof e.terminalForCall !== 'boolean'
  )
    return fail();
  if (
    e.sequence !== null &&
    (!Number.isSafeInteger(e.sequence) || Number(e.sequence) < 0)
  )
    return fail();
  if (
    e.endReason !== null &&
    !['COMPLETED', 'NO_ANSWER', 'CANCELLED', 'FAILED', 'UNKNOWN'].includes(
      String(e.endReason),
    )
  )
    return fail();
  if (e.kind !== 'ENDED' && (e.terminalForCall || e.endReason !== null))
    return fail();
  if ((e.kind === 'RECORDING_READY') !== (e.recordingReference !== null))
    return fail();
  const at = Date.parse(String(e.occurredAt));
  if (
    !/(?:Z|[+-]\d{2}:\d{2})$/.test(String(e.occurredAt)) ||
    !Number.isFinite(at) ||
    (enforceClock &&
      (at < now.getTime() - policy.maxAgeSeconds * 1000 ||
        at > now.getTime() + policy.maxFutureSeconds * 1000))
  )
    return fail();
  return {
    ...Object.fromEntries(keys.map((k) => [k, e[k]])),
    ...('callerName' in e ? { callerName: e.callerName } : {}),
    caller: number(e.caller),
    destination: number(e.destination),
    occurredAt: new Date(at).toISOString(),
  } as unknown as TelephonyEventV1;
}
