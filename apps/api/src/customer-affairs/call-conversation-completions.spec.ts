import 'reflect-metadata';
import { afterEach, expect, it, vi } from 'vitest';
import { missedCallbackContacts } from './call-center-callbacks';
import { conversationCompletions } from './call-conversation-completions';

afterEach(() => vi.unstubAllEnvs());
const at = (hour: number) =>
  new Date(`2026-11-01T${String(hour).padStart(2, '0')}:00:00Z`);
const receipt = (hour: number, extra = {}) => ({
  entityId: 'miss',
  entityType: 'CALL_CENTER_CALL',
  occurredAt: at(hour),
  afterSnapshot: null,
  beforeSnapshot: null,
  ...extra,
});
function setup(
  outcome = 'ANSWERED',
  receipts = [receipt(12)],
  newerMiss = false,
) {
  vi.stubEnv('CALL_CENTER_CALLBACK_MANAGER_IDS', '');
  const rows = [
    {
      id: 'miss',
      contactId: 'contact',
      origin: 'TELEPHONY',
      outcome,
      direction: 'INBOUND',
      occurredAt: at(10),
      encryptedPayload: { phone: '2025550101' },
      keyVersion: 1,
      telephonySession: {
        id: 'session',
        synthetic: false,
        keyVersion: 1,
        encryptedTechnical: {
          first: { direction: 'IN' },
          state: 'ENDED',
          unanswered: true,
        },
      },
    },
  ];
  if (newerMiss)
    rows.push({
      ...rows[0]!,
      id: 'new-miss',
      outcome: 'NO_ANSWER',
      occurredAt: at(14),
    });
  const audit = vi.fn().mockResolvedValue(receipts);
  const tx = {
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce([
        { id: 'contact', candidates: rows.map((r) => r.id) },
      ])
      .mockResolvedValue([]),
    callCenterCall: { findMany: async () => rows },
    customerAffairsAuditEvent: { findMany: audit },
  };
  return { tx, rows, audit };
}
async function pending(f: ReturnType<typeof setup>) {
  return missedCallbackContacts(
    f.tx as never,
    { decrypt: (v: unknown) => v } as never,
    'branch',
    {} as never,
    {} as never,
    at(18),
  );
}
it('an audited saved conversation clears callback need without rewriting PBX evidence', async () => {
  const f = setup();
  expect(await pending(f)).toEqual([]);
  expect(f.rows[0]?.telephonySession.encryptedTechnical.unanswered).toBe(true);
  expect(f.audit).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        branchId: 'branch',
        actorUserId: { not: null },
        occurredAt: { lte: at(18) },
      }),
    }),
  );
});
it('does not accept an outcome without an authorized save receipt', async () => {
  expect(await pending(setup('ANSWERED', []))).toHaveLength(1);
});
it('unsuccessful retry results do not resolve a missed contact', async () => {
  expect(await pending(setup('BUSY'))).toHaveLength(1);
});
it('a later missed call reopens the contact', async () => {
  expect(await pending(setup('ANSWERED', [receipt(12)], true))).toMatchObject([
    { callId: 'new-miss' },
  ]);
});
it('editing an already answered record does not extend its resolution time', async () => {
  const f = setup(
    'ANSWERED',
    [
      receipt(12),
      receipt(16, {
        afterSnapshot: { outcome: 'ANSWERED' },
        beforeSnapshot: { outcome: 'ANSWERED' },
      }),
    ],
    true,
  );
  expect(await pending(f)).toMatchObject([{ callId: 'new-miss' }]);
});
it('uses the explicit successful transition rather than an earlier unsuccessful save', async () => {
  const f = setup(
    'ANSWERED',
    [
      receipt(11, {
        afterSnapshot: { outcome: 'NO_ANSWER' },
        beforeSnapshot: { outcome: null },
      }),
      receipt(15, {
        afterSnapshot: { outcome: 'ANSWERED' },
        beforeSnapshot: { outcome: 'NO_ANSWER' },
      }),
    ],
    true,
  );
  expect(await pending(f)).toEqual([]);
});
it('recognizes SAVE receipts by exact telephony session identity', async () => {
  const f = setup('ANSWERED', [
    receipt(12, { entityType: 'TELEPHONY_CALL', entityId: 'session' }),
  ]);
  expect(
    (
      await conversationCompletions(f.tx as never, 'branch', f.rows, at(18))
    ).get('miss'),
  ).toBe(at(12).getTime());
});
it('a new explicit successful conversation can resolve a reopened missed contact', async () => {
  const f = setup(
    'ANSWERED',
    [
      receipt(12, {
        beforeSnapshot: { outcome: null },
        afterSnapshot: { outcome: 'ANSWERED' },
      }),
      receipt(16, {
        beforeSnapshot: { outcome: 'NO_ANSWER' },
        afterSnapshot: { outcome: 'ANSWERED' },
      }),
    ],
    true,
  );
  expect(await pending(f)).toEqual([]);
});
