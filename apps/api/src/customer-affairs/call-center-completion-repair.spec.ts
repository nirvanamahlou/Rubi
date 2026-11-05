import type { DatabaseClient } from '@nora/database';
import { describe, expect, it, vi } from 'vitest';

import { reconcileCallCompletion } from './call-center-completion-repair';
import type { CallCenterCrypto } from './call-center.crypto';

type Evidence = {
  branchId: string;
  entityId: string;
  entityType: string;
  action: string;
};

function fixture() {
  const payload = {
    name: '',
    phone: '',
    subject: 'Synthetic completed call',
    source: 'سایت',
    operator: 'داخلی 103',
  };
  const call = {
    id: 'call-a',
    contactId: 'contact-a',
    contact: { branchId: 'branch-a' },
    origin: 'TELEPHONY',
    needsCompletion: true,
    encryptedPayload: 'opaque-test-envelope',
    keyVersion: 1,
    outcome: 'ANSWERED' as string | null,
    telephonySession: {
      id: 'session-a',
      state: 'ENDED',
      synthetic: false,
      completed: false,
      version: 3,
    } as {
      id: string;
      state: string;
      synthetic: boolean;
      completed: boolean;
      version: number;
    } | null,
  };
  const evidence: Evidence[] = [
    {
      branchId: 'branch-a',
      entityId: 'call-a',
      entityType: 'CALL_CENTER_CALL',
      action: 'COMPLETE_CALL',
    },
  ];
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    callCenterCall: {
      findUnique: vi.fn().mockImplementation(async () => call),
      update: vi.fn().mockImplementation(async ({ data }) => {
        Object.assign(call, data);
        return call;
      }),
    },
    callCenterTelephonySession: {
      update: vi.fn().mockResolvedValue({}),
    },
    customerAffairsAuditEvent: {
      findFirst: vi.fn().mockImplementation(async ({ where }) => {
        const found = evidence.some(
          (item) =>
            item.branchId === where.branchId &&
            where.OR.some(
              (term: {
                entityId: string;
                entityType: string;
                action: string | { in: string[] };
              }) =>
                item.entityId === term.entityId &&
                item.entityType === term.entityType &&
                (typeof term.action === 'string'
                  ? item.action === term.action
                  : term.action.in.includes(item.action)),
            ),
        );
        return found ? { id: 'evidence-a' } : null;
      }),
      create: vi.fn().mockResolvedValue({}),
    },
  };
  const transaction = vi.fn().mockImplementation(async (run) => run(tx));
  const db = { $transaction: transaction } as unknown as DatabaseClient;
  const decrypt = vi.fn().mockImplementation(() => payload);
  const crypto = {
    decrypt,
    fingerprint: vi.fn().mockReturnValue('synthetic-search-token'),
  } as unknown as CallCenterCrypto;
  return { db, crypto, tx, transaction, call, evidence, payload, decrypt };
}

function expectNoWrites(tx: ReturnType<typeof fixture>['tx']) {
  expect(tx.callCenterCall.update).not.toHaveBeenCalled();
  expect(tx.callCenterTelephonySession.update).not.toHaveBeenCalled();
  expect(tx.customerAffairsAuditEvent.create).not.toHaveBeenCalled();
}

describe('operator-only call completion reconciliation', () => {
  it('previews a repair without modifying call/session flags or creating an audit', async () => {
    const f = fixture();
    expect(await reconcileCallCompletion(f.db, f.crypto, f.call.id)).toBe(
      'WOULD_REPAIR',
    );
    expectNoWrites(f.tx);
    expect(f.decrypt).toHaveBeenCalledWith(
      'opaque-test-envelope',
      1,
      'call:call-a:contact-a',
    );
    expect(f.transaction).toHaveBeenCalledOnce();
    const locks = f.tx.$queryRaw.mock.calls.map(([sql]) => sql.join('?'));
    expect(locks[0]).toContain('call_center_telephony_sessions');
    expect(locks[1]).toContain('customer_affairs_calls');
  });

  it('changes only derived flags, increments the session version and audits once across replay', async () => {
    const f = fixture();
    expect(await reconcileCallCompletion(f.db, f.crypto, f.call.id, true)).toBe(
      'REPAIRED',
    );
    expect(f.tx.callCenterCall.update).toHaveBeenCalledWith({
      where: { id: 'call-a' },
      data: { needsCompletion: false },
    });
    expect(f.tx.callCenterTelephonySession.update).toHaveBeenCalledWith({
      where: { id: 'session-a' },
      data: { completed: true, version: { increment: 1 } },
    });
    expect(f.tx.customerAffairsAuditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        branchId: 'branch-a',
        entityId: 'call-a',
        entityType: 'CALL_CENTER_CALL',
        action: 'RECONCILE_CALL_COMPLETION',
        version: 4,
        beforeSnapshot: { needsCompletion: true, sessionCompleted: false },
        afterSnapshot: { needsCompletion: false },
      }),
    });
    expect(await reconcileCallCompletion(f.db, f.crypto, f.call.id, true)).toBe(
      'UNCHANGED',
    );
    expect(f.tx.callCenterCall.update).toHaveBeenCalledOnce();
    expect(f.tx.customerAffairsAuditEvent.create).toHaveBeenCalledOnce();
  });

  it.each(['CREATE', 'COMPLETE_CALL'])(
    'accepts same-branch %s evidence for a call without a telephony session',
    async (action) => {
      const f = fixture();
      f.call.telephonySession = null;
      f.evidence[0]!.action = action;
      expect(
        await reconcileCallCompletion(f.db, f.crypto, f.call.id, true),
      ).toBe('REPAIRED');
      expect(f.tx.callCenterTelephonySession.update).not.toHaveBeenCalled();
      expect(f.tx.customerAffairsAuditEvent.create).toHaveBeenCalledOnce();
    },
  );

  it('accepts a saved business form on the exact terminal telephony session', async () => {
    const f = fixture();
    f.evidence[0] = {
      branchId: 'branch-a',
      entityId: 'session-a',
      entityType: 'TELEPHONY_CALL',
      action: 'SAVE',
    };
    expect(await reconcileCallCompletion(f.db, f.crypto, f.call.id, true)).toBe(
      'REPAIRED',
    );
  });

  it.each([
    { branchId: 'branch-other' },
    { entityId: 'call-other' },
    { entityType: 'TELEPHONY_CALL' },
    { action: 'RECONCILE_CALL_COMPLETION' },
    { action: 'SAVE' },
    { action: 'PROVIDER_ANSWERED' },
  ])('does not use unrelated evidence: %j', async (wrong) => {
    const f = fixture();
    Object.assign(f.evidence[0]!, wrong);
    expect(await reconcileCallCompletion(f.db, f.crypto, f.call.id, true)).toBe(
      'SKIPPED_UNSAVED',
    );
    expectNoWrites(f.tx);
    expect(f.decrypt).not.toHaveBeenCalled();
  });

  it('does not use another session SAVE as business evidence', async () => {
    const f = fixture();
    f.evidence[0] = {
      branchId: 'branch-a',
      entityId: 'session-other',
      entityType: 'TELEPHONY_CALL',
      action: 'SAVE',
    };
    expect(await reconcileCallCompletion(f.db, f.crypto, f.call.id, true)).toBe(
      'SKIPPED_UNSAVED',
    );
    expectNoWrites(f.tx);
  });

  it('preserves an unsaved call with provider-populated business-looking fields', async () => {
    const f = fixture();
    f.evidence.length = 0;
    expect(await reconcileCallCompletion(f.db, f.crypto, f.call.id, true)).toBe(
      'SKIPPED_UNSAVED',
    );
    expectNoWrites(f.tx);
  });

  it.each(['RINGING', 'ANSWERED', 'TRANSFERRED'])(
    'does not retire an active %s session',
    async (state) => {
      const f = fixture();
      f.call.telephonySession!.state = state;
      expect(
        await reconcileCallCompletion(f.db, f.crypto, f.call.id, true),
      ).toBe('SKIPPED_ACTIVE');
      expectNoWrites(f.tx);
      expect(f.tx.customerAffairsAuditEvent.findFirst).not.toHaveBeenCalled();
    },
  );

  it.each(['call', 'session'])(
    'preserves synthetic %s records',
    async (kind) => {
      const f = fixture();
      if (kind === 'call') f.call.origin = 'SYNTHETIC';
      else f.call.telephonySession!.synthetic = true;
      await reconcileCallCompletion(f.db, f.crypto, f.call.id, true);
      expectNoWrites(f.tx);
      expect(f.decrypt).not.toHaveBeenCalled();
    },
  );

  it.each([{ subject: '' }, { source: 'نامشخص' }, { operator: 'نامشخص' }])(
    'preserves genuinely incomplete saved information: %j',
    async (missing) => {
      const f = fixture();
      Object.assign(f.payload, missing);
      expect(
        await reconcileCallCompletion(f.db, f.crypto, f.call.id, true),
      ).toBe('STILL_INCOMPLETE');
      expectNoWrites(f.tx);
    },
  );

  it('preserves a saved call with no outcome', async () => {
    const f = fixture();
    f.call.outcome = null;
    expect(await reconcileCallCompletion(f.db, f.crypto, f.call.id, true)).toBe(
      'STILL_INCOMPLETE',
    );
    expectNoWrites(f.tx);
  });

  it('does nothing if the call was removed or already reconciled', async () => {
    const f = fixture();
    f.tx.callCenterCall.findUnique.mockResolvedValueOnce(null);
    expect(await reconcileCallCompletion(f.db, f.crypto, f.call.id, true)).toBe(
      'UNCHANGED',
    );
    f.call.needsCompletion = false;
    expect(await reconcileCallCompletion(f.db, f.crypto, f.call.id, true)).toBe(
      'UNCHANGED',
    );
    expectNoWrites(f.tx);
  });
});
