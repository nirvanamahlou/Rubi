import type {
  MarketingCampaignInputV1,
  MarketingCampaignViewV1,
} from '@nora/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { marketingApi } from '../api/records-client';
import {
  ensureCampaignPublicationAttempt,
  executeCampaignPublication,
} from './durable-records';

vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'https://api.example.test',
}));
vi.mock('@/modules/notifications/api/client', () => ({
  notifyNotificationFeedChanged: vi.fn(),
}));

const input: MarketingCampaignInputV1 = {
  internalCode: 'RECOVERY',
  name: 'Original',
  campaignType: 'SALE',
  objective: 'Test',
  executionCompany: 'NIAYESH_SEIR_SAHAR',
  channels: ['SMS'],
  ownerUserId: 'actor',
  salesTarget: '10',
  targetCurrencyCode: 'IRR',
  budgetAmount: '12.1234',
  budgetCurrencyCode: 'IRR',
  startsAt: '2026-10-01T00:00:00.000Z',
  endsAt: '2026-11-01T00:00:00.000Z',
  frequencyCap: 1,
};
type Operation = 'create' | 'update' | 'publish';
type Failure =
  | 'reject'
  | 'lost'
  | 'unreadable'
  | 'server-after-commit'
  | 'server-before-commit'
  | 'forbidden'
  | 'conflict';

// HTTP boundary harness: durable rows + replay ledger, CAS before every new
// update/publication, and response loss *after* commit. No permissive mocks.
function server() {
  let row: MarketingCampaignViewV1 | undefined;
  let creates = 0;
  const ledger = new Map<string, string>();
  const failures = new Map<Operation, Failure>();
  const calls: Array<{
    operation: Operation;
    key: string;
    payload: Record<string, unknown>;
  }> = [];
  const response = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status });
  const fetch = vi.fn(async (url: string, init: RequestInit) => {
    const operation: Operation = url.endsWith('/publication')
      ? 'publish'
      : init.method === 'PATCH'
        ? 'update'
        : 'create';
    const payload = JSON.parse(init.body as string) as Record<string, unknown>;
    const key = new Headers(init.headers).get('idempotency-key')!;
    calls.push({ operation, key, payload });
    const failure = failures.get(operation);
    failures.delete(operation);
    if (failure === 'reject')
      return response(400, { message: 'Rejected without mutation' });
    if (failure === 'forbidden')
      return response(403, { message: 'Access revoked' });
    if (failure === 'conflict')
      return response(409, {
        code: 'IDEMPOTENCY_CONFLICT',
        message: 'Replay blocked',
      });
    if (failure === 'server-before-commit')
      return response(503, { message: 'Unavailable before commit' });
    const ledgerKey = `${operation}:${key}`;
    const fingerprint = JSON.stringify(payload);
    if (ledger.has(ledgerKey)) {
      if (ledger.get(ledgerKey) !== fingerprint)
        return response(409, { code: 'IDEMPOTENCY_CONFLICT' });
    } else {
      if (operation === 'create') {
        creates++;
        row = {
          ...payload,
          id: `entity-${creates}`,
          branchId: 'branch',
          version: 1,
          status: 'DRAFT',
        } as unknown as MarketingCampaignViewV1;
      } else {
        if (
          !row ||
          !url.includes(row.id) ||
          payload.expectedVersion !== row.version
        )
          return response(409, {
            code: 'CONCURRENT_MODIFICATION',
            message: 'Stale CAS',
          });
        row = {
          ...row,
          ...(operation === 'update' ? payload : { status: 'ACTIVE' as const }),
          version: row.version + 1,
        };
      }
      ledger.set(ledgerKey, fingerprint);
    }
    if (failure === 'lost') throw new TypeError('Response lost after commit');
    if (failure === 'unreadable') return new Response('{', { status: 200 });
    if (failure === 'server-after-commit')
      return response(502, { message: 'Gateway lost committed response' });
    return response(200, { data: row });
  });
  vi.stubGlobal('fetch', fetch);
  let key = 0;
  let attempt = ensureCampaignPublicationAttempt(
    null,
    input,
    () => `intent-${++key}`,
  );
  return {
    calls,
    ledger,
    get row() {
      return row;
    },
    get creates() {
      return creates;
    },
    get pending() {
      return attempt.pending;
    },
    fail(operation: Operation, mode: Failure) {
      failures.set(operation, mode);
    },
    run(desired = input) {
      attempt = ensureCampaignPublicationAttempt(attempt, desired);
      return executeCampaignPublication(
        attempt,
        desired,
        'branch',
        marketingApi,
      );
    },
  };
}
afterEach(() => vi.unstubAllGlobals());

describe('campaign command outcome matrix through the real API client', () => {
  it('permits corrected new intent after definitive create rejection', async () => {
    const state = server();
    state.fail('create', 'reject');
    await expect(state.run()).rejects.toMatchObject({ status: 400 });
    expect(state.pending).toBeUndefined();
    const corrected = { ...input, name: 'Corrected' };
    await state.run(corrected);
    expect(state.calls.slice(0, 2).map((call) => call.payload.name)).toEqual([
      'Original',
      'Corrected',
    ]);
    expect(state.calls[0]!.key).not.toBe(state.calls[1]!.key);
    expect(state.creates).toBe(1);
    expect(state.row).toMatchObject({
      id: 'entity-1',
      name: 'Corrected',
      status: 'ACTIVE',
      version: 2,
    });
  });

  it.each([
    'lost',
    'unreadable',
    'server-after-commit',
    'server-before-commit',
  ] as const)(
    'reconciles uncertain create (%s) before correction',
    async (failure) => {
      const state = server();
      state.fail('create', failure);
      await expect(state.run()).rejects.toThrow();
      await state.run({ ...input, name: 'Corrected' });
      expect(state.calls[0]).toEqual(state.calls[1]);
      expect(state.creates).toBe(1);
      expect(state.row).toMatchObject({
        id: 'entity-1',
        name: 'Corrected',
        status: 'ACTIVE',
        version: 3,
      });
    },
  );

  it.each(['lost', 'unreadable', 'server-after-commit'] as const)(
    'replays uncertain update (%s) at its original version before newer correction',
    async (failure) => {
      const state = server();
      state.fail('create', 'lost');
      await expect(state.run()).rejects.toThrow();
      state.fail('update', failure);
      await expect(
        state.run({ ...input, name: 'First correction' }),
      ).rejects.toThrow();
      await state.run({ ...input, name: 'Second correction' });
      const updates = state.calls.filter((call) => call.operation === 'update');
      expect(updates[0]).toEqual(updates[1]);
      expect(updates.map((call) => call.payload.expectedVersion)).toEqual([
        1, 1, 2,
      ]);
      expect(state.creates).toBe(1);
      expect(state.row).toMatchObject({
        name: 'Second correction',
        status: 'ACTIVE',
        version: 4,
      });
    },
  );

  it.each(['lost', 'unreadable', 'server-after-commit'] as const)(
    'replays uncertain publication (%s) before editing its committed entity',
    async (failure) => {
      const state = server();
      state.fail('publish', failure);
      await expect(state.run()).rejects.toThrow();
      await state.run({ ...input, name: 'Corrected after publication' });
      const publications = state.calls.filter(
        (call) => call.operation === 'publish',
      );
      expect(publications).toHaveLength(2);
      expect(publications[0]).toEqual(publications[1]);
      expect(state.calls.at(-1)).toMatchObject({
        operation: 'update',
        payload: { expectedVersion: 2 },
      });
      expect(state.creates).toBe(1);
      expect(state.ledger.size).toBe(3);
      expect(state.row).toMatchObject({
        name: 'Corrected after publication',
        status: 'ACTIVE',
        version: 3,
      });
    },
  );

  it.each(['update', 'publish'] as const)(
    'allows corrected intent after definitive %s rejection',
    async (operation) => {
      const state = server();
      if (operation === 'update') {
        state.fail('create', 'lost');
        await expect(state.run()).rejects.toThrow();
      }
      state.fail(operation, 'reject');
      await expect(
        state.run({ ...input, name: 'Rejected correction' }),
      ).rejects.toMatchObject({ status: 400 });
      expect(state.pending).toBeUndefined();
      await state.run({ ...input, name: 'Accepted correction' });
      const commands = state.calls.filter(
        (call) => call.operation === operation,
      );
      expect(commands[0]!.key).not.toBe(commands[1]!.key);
      expect(state.creates).toBe(1);
      expect(state.row).toMatchObject({
        name: 'Accepted correction',
        status: 'ACTIVE',
      });
    },
  );

  it.each(['create', 'update', 'publish'] as const)(
    'retains uncertain %s through revoked permission and replay conflicts',
    async (operation) => {
      const state = server();
      if (operation === 'update') {
        state.fail('create', 'lost');
        await expect(state.run()).rejects.toThrow();
      }
      state.fail(operation, 'lost');
      await expect(
        state.run({ ...input, name: 'Uncertain' }),
      ).rejects.toThrow();
      const pending = structuredClone(state.pending);
      for (const failure of ['forbidden', 'conflict'] as const) {
        state.fail(operation, failure);
        await expect(
          state.run({ ...input, name: 'Must wait' }),
        ).rejects.toThrow();
        expect(state.pending).toEqual(pending);
      }
      await state.run({ ...input, name: 'Final correction' });
      const commands = state.calls.filter((call) => call.key === pending!.key);
      expect(commands).toHaveLength(4);
      commands.forEach((command) => expect(command).toEqual(commands[0]));
      expect(state.creates).toBe(1);
      expect(state.row).toMatchObject({
        name: 'Final correction',
        status: 'ACTIVE',
      });
    },
  );

  it('owns an immutable snapshot when the caller changes nested input after response loss', async () => {
    const state = server();
    const mutable = { ...input, channels: ['SMS'] };
    state.fail('create', 'lost');
    await expect(state.run(mutable)).rejects.toThrow();
    mutable.channels.push('EMAIL');
    await state.run(mutable);
    expect(state.calls[0]).toEqual(state.calls[1]);
    expect(state.row?.channels).toEqual(['SMS', 'EMAIL']);
    expect(state.creates).toBe(1);
  });
});
