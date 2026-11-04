import { describe, expect, it } from 'vitest';
import type { TelephonyEventV1 } from '@nora/contracts';
import { applyTelephonyEvent } from './telephony-state';
const e: TelephonyEventV1 = {
  schemaVersion: 1,
  connectionId: 'connection',
  externalEventId: 'event',
  externalCallId: 'call',
  rootCallId: null,
  legId: null,
  kind: 'RINGING',
  direction: 'IN',
  caller: { kind: 'WITHHELD', value: null },
  destination: { kind: 'UNKNOWN', value: null },
  companyLine: null,
  extension: null,
  queue: null,
  occurredAt: '2026-10-19T00:00:00Z',
  sequence: 1,
  terminalForCall: false,
  endReason: null,
  recordingReference: null,
};
describe('telephony root and leg state', () => {
  it('keeps root alive when one ringing leg ends', () => {
    const a = applyTelephonyEvent(null, e, new Date());
    const b = applyTelephonyEvent(
      a,
      { ...e, kind: 'ENDED', sequence: 2 },
      new Date(),
    );
    expect(b.state).toBe('RINGING');
    expect(b.legs['leg:call']?.state).toBe('ENDED');
  });
  it('does not regress terminal root or terminal leg', () => {
    const a = applyTelephonyEvent(
      null,
      { ...e, kind: 'ENDED', terminalForCall: true, sequence: 4 },
      new Date(),
    );
    const b = applyTelephonyEvent(a, e, new Date());
    expect(b.state).toBe('ENDED');
    expect(b.legs['leg:call']?.state).toBe('ENDED');
  });
  it('accepts recording after end and deduplicates reference', () => {
    const a = applyTelephonyEvent(
      null,
      { ...e, kind: 'ENDED', terminalForCall: true },
      new Date(),
    );
    const event = {
      ...e,
      kind: 'RECORDING_READY' as const,
      recordingReference: 'opaque',
    };
    const b = applyTelephonyEvent(
      applyTelephonyEvent(a, event, new Date()),
      event,
      new Date(),
    );
    expect(b.state).toBe('ENDED');
    expect(b.recordings).toEqual(['opaque']);
  });
});

it('uses only confirmed answers and retains the latest answer across late events', () => {
  const ring = applyTelephonyEvent(
    null,
    { ...e, extension: '100' },
    new Date(),
  );
  expect(ring.lastAnswer).toBeUndefined();
  const answer = applyTelephonyEvent(
    ring,
    {
      ...e,
      kind: 'ANSWERED',
      extension: '203',
      occurredAt: '2026-10-19T00:02:00Z',
    },
    new Date(),
  );
  const late = applyTelephonyEvent(
    answer,
    {
      ...e,
      kind: 'ANSWERED',
      extension: '101',
      occurredAt: '2026-10-19T00:01:00Z',
    },
    new Date(),
  );
  expect(late.lastAnswer?.extension).toBe('203');
  const end = applyTelephonyEvent(
    late,
    { ...e, kind: 'ENDED', extension: '100', terminalForCall: true },
    new Date(),
  );
  expect(end.lastAnswer?.extension).toBe('203');
  expect(end.answers?.map((answer) => answer.extension)).toEqual([
    '101',
    '203',
  ]);
});

it('does not grant answer evidence to ringing destinations and deduplicates answers', () => {
  const ring = { ...e, extension: '105', queue: '1002' };
  const first = applyTelephonyEvent(null, ring, new Date());
  const repeated = applyTelephonyEvent(first, ring, new Date());
  expect(repeated.answers).toBeUndefined();
  expect(repeated.destinations).toHaveLength(1);
  const answer = { ...ring, kind: 'ANSWERED' as const };
  const answered = applyTelephonyEvent(repeated, answer, new Date());
  const duplicate = applyTelephonyEvent(answered, answer, new Date());
  expect(duplicate.answers).toEqual([{ extension: '105', at: e.occurredAt }]);
  expect(first.answers).toBeUndefined();
  expect(duplicate.destinations).toHaveLength(1);
});

it('initializes answer history from legacy lastAnswer without losing that employee', () => {
  const previous = applyTelephonyEvent(null, e, new Date());
  previous.lastAnswer = { extension: '105', at: e.occurredAt };
  const result = applyTelephonyEvent(
    previous,
    { ...e, kind: 'ANSWERED', extension: '105' },
    new Date(),
  );
  expect(result.answers).toEqual([previous.lastAnswer]);
});
