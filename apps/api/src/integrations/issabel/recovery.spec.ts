import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import type { TelephonyEventV1 } from '@nora/contracts';
import {
  CallRecovery,
  INITIAL_RECOVERY_MS,
  type RecoverySource,
} from './recovery';
import { TelephonyIntegrationService } from '../telephony.service';
import { IssabelRecoveryService } from './recovery.service';

const id = '11111111-1111-4111-8111-111111111111';
const now = new Date('2026-10-24T12:00:00Z');
const initial = new Date(+now - INITIAL_RECOVERY_MS).toISOString();
const event: TelephonyEventV1 = {
  schemaVersion: 1,
  connectionId: id,
  externalEventId: 'cdr:leg1:end',
  externalCallId: 'root1',
  rootCallId: 'root1',
  legId: 'leg1',
  kind: 'ENDED',
  direction: 'IN',
  caller: { kind: 'WITHHELD', value: null },
  destination: { kind: 'UNKNOWN', value: null },
  companyLine: null,
  extension: null,
  queue: null,
  occurredAt: initial,
  sequence: null,
  terminalForCall: true,
  endReason: 'NO_ANSWER',
  recordingReference: null,
};
function fixture() {
  let state: { start: string; through: string } | null = null;
  const journal = {
    loadOrStart: vi.fn(
      async (start: string) => (state ??= { start, through: start }),
    ),
    advance: vi.fn(async (expected: string, through: string) => {
      if (state?.through !== expected) return false;
      state = { ...state, through };
      return true;
    }),
  };
  const source = {
    ready: vi.fn(async () => true),
    snapshot: vi.fn(async () => ({
      retainedFrom: initial,
      finalizedThrough: now.toISOString(),
    })),
    page: vi.fn<RecoverySource['page']>(async () => ({
      calls: [],
      next: null,
    })),
  };
  const ingest = vi.fn<(event: TelephonyEventV1) => Promise<void>>(
    async () => {},
  );
  return {
    journal,
    source,
    ingest,
    run: () => new CallRecovery(id, source, journal, ingest),
  };
}
describe('durable historical recovery', () => {
  it('commits only after the last page and pauses when source reads time out', async () => {
    const f = fixture();
    f.source.page
      .mockResolvedValueOnce({ calls: [], next: 'page2' })
      .mockImplementationOnce(async () => {
        expect(f.journal.advance).not.toHaveBeenCalled();
        return { calls: [], next: null };
      });
    expect(await f.run().run(now)).toBe('ADVANCED');
    expect(f.journal.advance).toHaveBeenCalledOnce();
    vi.useFakeTimers();
    try {
      const stalled = fixture();
      stalled.source.ready.mockReturnValue(new Promise(() => {}));
      const run = stalled.run();
      const pending = expect(run.run(now)).rejects.toThrow('SOURCE_TIMEOUT');
      expect(await run.run(now)).toBe('BUSY');
      await vi.advanceTimersByTimeAsync(30001);
      await pending;
      expect(stalled.journal.advance).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
  it('starts seven days back and persists progress across restarts with overlap', async () => {
    const f = fixture();
    await f.run().run(now);
    await f.run().run(new Date(+now + 86400000));
    expect(f.journal.loadOrStart).toHaveBeenNthCalledWith(1, initial);
    expect(f.source.page.mock.calls[1]![0].from).toBe(
      '2026-10-17T12:55:00.000Z',
    );
    expect(f.journal.advance.mock.calls[1]![0]).toBe(
      '2026-10-17T13:00:00.000Z',
    );
  });
  it('never starts a cursor while source/policy is not ready', async () => {
    const f = fixture();
    f.source.ready.mockResolvedValue(false);
    expect(await f.run().run(now)).toBe('NOT_READY');
    expect(f.journal.loadOrStart).not.toHaveBeenCalled();
  });
  it('does not skip a retention gap', async () => {
    const f = fixture();
    f.source.snapshot.mockResolvedValue({
      retainedFrom: now.toISOString(),
      finalizedThrough: now.toISOString(),
    });
    await expect(f.run().run(now)).rejects.toThrow('RETENTION_GAP');
    expect(f.journal.advance).not.toHaveBeenCalled();
  });
  it('does not advance on a partial-page ingest failure and retries the same identities', async () => {
    const f = fixture();
    f.source.page.mockResolvedValue({
      calls: [{ endedAt: initial, events: [event] }],
      next: null,
    });
    f.ingest.mockRejectedValueOnce(Error('offline'));
    await expect(f.run().run(now)).rejects.toThrow('offline');
    expect(f.journal.advance).not.toHaveBeenCalled();
    expect(await f.run().run(now)).toBe('ADVANCED');
    expect(f.ingest).toHaveBeenCalledTimes(2);
    expect(f.ingest.mock.calls[0]).toEqual(f.ingest.mock.calls[1]);
  });
  it('rejects repeating pagination tokens without checkpointing', async () => {
    const f = fixture();
    f.source.page.mockResolvedValue({ calls: [], next: 'same' });
    await expect(f.run().run(now)).rejects.toThrow('INVALID_CURSOR');
    expect(f.journal.advance).not.toHaveBeenCalled();
  });
  it('rejects foreign connection, missing correlation and future call events', async () => {
    for (const bad of [
      { ...event, connectionId: 'other' },
      { ...event, rootCallId: null },
      { ...event, occurredAt: now.toISOString() },
    ]) {
      const f = fixture();
      f.source.page.mockResolvedValue({
        calls: [{ endedAt: initial, events: [bad] }],
        next: null,
      });
      await expect(f.run().run(now)).rejects.toThrow();
      expect(f.ingest).not.toHaveBeenCalled();
    }
  });
  it('does not advance when finalized source time has not advanced', async () => {
    const f = fixture();
    f.source.snapshot.mockResolvedValue({
      retainedFrom: initial,
      finalizedThrough: initial,
    });
    expect(await f.run().run(now)).toBe('CAUGHT_UP');
    expect(f.source.page).not.toHaveBeenCalled();
  });
  it('does not overwrite a concurrent checkpoint', async () => {
    const f = fixture();
    f.journal.advance.mockResolvedValue(false);
    expect(await f.run().run(now)).toBe('CONCURRENT_RUN');
  });
  it('registers no polling work without a verified source adapter', async () => {
    const events = { receiveRecovered: vi.fn() };
    const service = new IssabelRecoveryService(
      {} as never,
      new ConfigService({
        ISSABEL_RECOVERY_ENABLED: 'true',
        ISSABEL_CONNECTION_ID: id,
      }),
      events as never,
    );
    service.onModuleInit();
    await service.onModuleDestroy();
    expect(events.receiveRecovered).not.toHaveBeenCalled();
  });
});

describe('private recovery ingress', () => {
  function ingress(enabled = true) {
    let saved: unknown;
    const tx = {
      $queryRaw: vi.fn(async () => []),
      integrationTelephonyInbox: {
        findUnique: vi.fn(async () => null),
        count: vi.fn(async () => 0),
        create: vi.fn(async () => ({})),
      },
      integrationTelephonyMapping: { findUnique: vi.fn() },
    };
    const db = {
      client: {
        integrationTelephonyConnection: {
          findUnique: async () => ({
            id,
            active: true,
            synthetic: false,
            maxAgeSeconds: 60,
            maxFutureSeconds: 30,
          }),
        },
        integrationTelephonyInbox: {
          findUnique: vi.fn(async () => ({ status: 'DONE' })),
        },
        $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
      },
    };
    const service = new TelephonyIntegrationService(
      db as never,
      new ConfigService({
        ISSABEL_ENABLED: 'true',
        ISSABEL_CONNECTION_ID: id,
        ISSABEL_RECOVERY_ENABLED: enabled ? 'true' : 'false',
        ISSABEL_USER_NOTIFICATIONS_ENABLED: 'true',
        ISSABEL_EVENT_MODE: 'NATIVE_QUEUE_CAPTURE',
      }),
      {
        crypto: {
          fingerprint: (v: string) => v,
          encrypt: (v: unknown) => {
            saved = v;
            return 'encrypted';
          },
          keyVersion: 1,
        },
      } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    vi.spyOn(service, 'process').mockResolvedValue({ processed: true });
    return { service, tx, db, saved: () => saved };
  }
  it('rejects old live ingress but accepts recovered history with no popup recipient', async () => {
    const f = ingress();
    await expect(f.service.receive(event, 'ISSABEL')).rejects.toThrow();
    await f.service.receiveRecovered({ ...event, extension: '105' });
    expect(f.saved()).toMatchObject({ recipient: null });
    expect(f.tx.integrationTelephonyMapping.findUnique).not.toHaveBeenCalled();
    expect(f.service.process).toHaveBeenCalledOnce();
  });
  it('fails closed when recovery is disabled or projection is not completed', async () => {
    await expect(
      ingress(false).service.receiveRecovered(event),
    ).rejects.toThrow('disabled');
    const f = ingress();
    f.db.client.integrationTelephonyInbox.findUnique.mockResolvedValue({
      status: 'DEAD',
    });
    await expect(f.service.receiveRecovered(event)).rejects.toThrow(
      'incomplete',
    );
  });
  it('does not accept future recovered events', async () => {
    await expect(
      ingress().service.receiveRecovered({
        ...event,
        occurredAt: new Date(Date.now() + 86400000).toISOString(),
      }),
    ).rejects.toThrow('future');
  });
});
