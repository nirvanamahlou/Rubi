/** Internal contract only. No provider protocol or authentication is implied. */
export type TelephonyEventKind =
  'RINGING' | 'ANSWERED' | 'ENDED' | 'RECORDING_READY' | 'TRANSFERRED';
export interface TelephonyNumberV1 {
  kind: 'KNOWN' | 'WITHHELD' | 'UNKNOWN';
  value: string | null;
}
export interface TelephonyEventV1 {
  schemaVersion: 1;
  connectionId: string;
  externalEventId: string;
  externalCallId: string;
  rootCallId: string | null;
  legId: string | null;
  kind: TelephonyEventKind;
  direction: 'IN' | 'OUT';
  caller: TelephonyNumberV1;
  /** Optional, unverified provider display name; never an identity/routing key. */
  callerName?: string | null;
  destination: TelephonyNumberV1;
  companyLine: string | null;
  extension: string | null;
  queue: string | null;
  occurredAt: string;
  sequence: number | null;
  /** Only a provider adapter with a documented root-terminal signal may set true. */
  terminalForCall: boolean;
  endReason:
    'COMPLETED' | 'NO_ANSWER' | 'CANCELLED' | 'FAILED' | 'UNKNOWN' | null;
  /** Opaque provider reference, never a browser playback URL. */
  recordingReference: string | null;
}
export interface TelephonyReconciliationPort {
  reconcile(
    connectionId: string,
    cursor: string | null,
  ): Promise<
    | { supported: false }
    | { supported: true; events: TelephonyEventV1[]; nextCursor: string | null }
  >;
}
