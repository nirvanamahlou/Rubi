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
