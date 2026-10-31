import type { TelephonyEventV1 } from '@nora/contracts';
export interface TelephonyTechnical {
  first: TelephonyEventV1;
  receivedAt: string;
  state: 'RINGING' | 'ANSWERED' | 'ENDED' | 'UNKNOWN';
  legs: Record<string, { state: string; at: string; sequence: number | null }>;
  recordings: string[];
  answered?: boolean;
  lastAnswer?: { extension: string; at: string };
  /** Trusted answer evidence for all employees, including transferred calls. */
  answers?: { extension: string; at: string }[];
  destinations?: {
    extension: string | null;
    queue: string | null;
    at: string;
  }[];
  unanswered?: boolean;
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
  // Preserve the earliest known business event even when the recording/end
  // arrived first. Receipt time is separate and terminal state stays monotone.
  if (
    event.kind !== 'RECORDING_READY' &&
    (next.first.kind === 'RECORDING_READY' ||
      event.occurredAt < next.first.occurredAt)
  )
    next.first = event;
  const legId = `leg:${event.legId ?? event.externalCallId}`;
  if (event.kind === 'ANSWERED' && event.extension) {
    const answers = next.answers ?? (next.lastAnswer ? [next.lastAnswer] : []);
    next.answers = answers;
    const existingAnswer = answers.find((a) => a.extension === event.extension);
    if (!existingAnswer || event.occurredAt < existingAnswer.at)
      next.answers = [
        ...answers.filter((a) => a.extension !== event.extension),
        { extension: event.extension, at: event.occurredAt },
      ].sort(
        (a, b) =>
          a.at.localeCompare(b.at) || a.extension.localeCompare(b.extension),
      );
  }
  if (
    ['RINGING', 'TRANSFERRED', 'ANSWERED'].includes(event.kind) &&
    (event.extension || event.queue)
  ) {
    const destinations = next.destinations ?? [];
    if (
      !destinations.some(
        (d) => d.extension === event.extension && d.queue === event.queue,
      )
    )
      next.destinations = [
        ...destinations,
        {
          extension: event.extension,
          queue: event.queue,
          at: event.occurredAt,
        },
      ];
  }
  // Answer evidence is sticky even when delivered after a terminal event.
  if (event.kind === 'ANSWERED' || event.endReason === 'COMPLETED')
    next.answered = true;
  if (event.kind === 'ENDED' && event.endReason === 'NO_ANSWER')
    next.unanswered = true;
  if (
    event.kind === 'ANSWERED' &&
    event.extension &&
    (!next.lastAnswer ||
      Date.parse(event.occurredAt) > Date.parse(next.lastAnswer.at))
  )
    next.lastAnswer = { extension: event.extension, at: event.occurredAt };
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
