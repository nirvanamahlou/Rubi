import type { TelephonyEventV1 } from '@nora/contracts';

export const INITIAL_RECOVERY_MS = 7 * 86400000;
export const RECOVERY_OVERLAP_MS = 5 * 60000;
const WINDOW_MS = 3600000;

/** A server-only adapter, not a browser/CDR upload API. Implement only after the
 * actual read-only source, UTC conversion, linked IDs and access policy are verified.
 * Query finalized calls by end time in [from, through); include every known leg.
 * A stable snapshot must include late-arriving CDRs before advancing finalizedThrough.
 */
export interface RecoverySource {
  ready(): Promise<boolean>;
  snapshot(): Promise<{ retainedFrom: string; finalizedThrough: string }>;
  page(input: {
    from: string;
    through: string;
    cursor: string | null;
    limit: number;
  }): Promise<{
    calls: { endedAt: string; events: TelephonyEventV1[] }[];
    next: string | null;
  }>;
}
export interface RecoveryJournal {
  loadOrStart(initialFrom: string): Promise<{ start: string; through: string }>;
  advance(expectedThrough: string, through: string): Promise<boolean>;
}
const timestamp = (value: string) => {
  if (!/^\d{4}-.*Z$/.test(value) || !Number.isFinite(Date.parse(value)))
    throw Error('RECOVERY_INVALID_TIME');
  return Date.parse(value);
};

/** At-least-once replay; cursor advances only after every receipt is projected.
 * Failed/partial windows replay from the durable cursor with stable identities.
 */
export class CallRecovery {
  private busy = false;
  constructor(
    private readonly connectionId: string,
    private readonly source: RecoverySource,
    private readonly journal: RecoveryJournal,
    private readonly ingest: (event: TelephonyEventV1) => Promise<void>,
  ) {}

  async run(now = new Date()) {
    if (this.busy) return 'BUSY';
    this.busy = true;
    const deadline = Date.now() + 30000;
    const bounded = async <T>(operation: Promise<T>): Promise<T> => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          operation,
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject(Error('RECOVERY_SOURCE_TIMEOUT')),
              Math.max(1, deadline - Date.now()),
            );
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    };
    try {
      if (!(await bounded(this.source.ready()))) return 'NOT_READY';
      const state = await this.journal.loadOrStart(
        new Date(now.getTime() - INITIAL_RECOVERY_MS).toISOString(),
      );
      const start = timestamp(state.start),
        previous = timestamp(state.through);
      if (previous < start || previous > now.getTime())
        throw Error('RECOVERY_INVALID_CHECKPOINT');
      const snapshot = await bounded(this.source.snapshot());
      const from = Math.max(start, previous - RECOVERY_OVERLAP_MS);
      const end = Math.min(
        timestamp(snapshot.finalizedThrough),
        now.getTime(),
        previous + WINDOW_MS,
      );
      if (end <= previous) return 'CAUGHT_UP';
      if (timestamp(snapshot.retainedFrom) > from)
        throw Error('RECOVERY_RETENTION_GAP');
      const through = new Date(end).toISOString();
      let cursor: string | null = null;
      const seen = new Set<string>();
      for (let pages = 0; pages < 1000; pages++) {
        if (Date.now() >= deadline) throw Error('RECOVERY_TIME_BUDGET');
        const page: Awaited<ReturnType<RecoverySource['page']>> = await bounded(
          this.source.page({
            from: new Date(from).toISOString(),
            through,
            cursor,
            limit: 100,
          }),
        );
        if (!Array.isArray(page.calls) || page.calls.length > 100)
          throw Error('RECOVERY_INVALID_PAGE');
        for (const call of page.calls) {
          const ended = timestamp(call.endedAt);
          if (
            ended < from ||
            ended >= end ||
            !Array.isArray(call.events) ||
            !call.events.length ||
            call.events.length > 512
          )
            throw Error('RECOVERY_INVALID_CALL');
          const root = call.events[0]!.rootCallId;
          if (
            !root ||
            !call.events.some((e) => e.kind === 'ENDED' && e.terminalForCall)
          )
            throw Error('RECOVERY_UNCORRELATED_CALL');
          // Validate the entire call before accepting any of its events.
          for (const event of call.events)
            if (
              event.connectionId !== this.connectionId ||
              event.rootCallId !== root ||
              timestamp(event.occurredAt) > ended
            )
              throw Error('RECOVERY_INVALID_EVENT_SCOPE');
          for (const event of call.events) {
            if (Date.now() >= deadline) throw Error('RECOVERY_TIME_BUDGET');
            await this.ingest(event);
          }
        }
        if (page.next === null)
          return (await this.journal.advance(state.through, through))
            ? 'ADVANCED'
            : 'CONCURRENT_RUN';
        if (
          typeof page.next !== 'string' ||
          !page.next ||
          page.next.length > 2048 ||
          seen.has(page.next)
        )
          throw Error('RECOVERY_INVALID_CURSOR');
        seen.add(page.next);
        cursor = page.next;
      }
      throw Error('RECOVERY_PAGE_LIMIT');
    } finally {
      this.busy = false;
    }
  }
}
