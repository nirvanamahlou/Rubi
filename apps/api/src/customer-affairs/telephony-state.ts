import type { TelephonyEventV1 } from '@nora/contracts';
export interface TelephonyTechnical {
  first: TelephonyEventV1;
  receivedAt: string;
  state: 'RINGING' | 'ANSWERED' | 'ENDED' | 'UNKNOWN';
  legs: Record<string, { state: string; at: string; sequence: number | null }>;
  recordings: string[];
}
/** Terminal facts are monotone. Sequence numbers are only comparable within a leg. */
export function applyTelephonyEvent(
  previous: TelephonyTechnical | null,
  event: TelephonyEventV1,
  receivedAt: Date,
) {
  const next: TelephonyTechnical = previous
    ? structuredClone(previous)
    : {
        first: event,
        receivedAt: receivedAt.toISOString(),
        state: 'UNKNOWN',
        legs: {},
        recordings: [],
      };
  const legId = `leg:${event.legId ?? event.externalCallId}`;
  const leg = next.legs[legId];
  const older =
    leg &&
    (event.sequence !== null && leg.sequence !== null
      ? event.sequence < leg.sequence
      : event.occurredAt < leg.at);
  if (event.kind === 'RECORDING_READY') {
    if (
      event.recordingReference &&
      !next.recordings.includes(event.recordingReference)
    )
      next.recordings = [...next.recordings, event.recordingReference].slice(
        -32,
      );
    return next;
  }
  if (event.kind === 'ENDED' && event.terminalForCall) next.state = 'ENDED';
  if (older) return next;
  const state = event.kind === 'TRANSFERRED' ? 'RINGING' : event.kind;
  if (leg?.state !== 'ENDED')
    next.legs[legId] = {
      state,
      at: event.occurredAt,
      sequence: event.sequence,
    };
  if (next.state !== 'ENDED') {
    if (event.kind === 'ANSWERED') next.state = 'ANSWERED';
    else if (
      next.state === 'UNKNOWN' &&
      ['RINGING', 'TRANSFERRED'].includes(event.kind)
    )
      next.state = 'RINGING';
  }
  return next;
}
