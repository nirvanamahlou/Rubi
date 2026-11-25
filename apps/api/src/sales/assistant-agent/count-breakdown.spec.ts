import { describe, expect, it, vi } from 'vitest';
import type { DatabaseClient } from '@nora/database';
import { readContractCountBreakdown } from './count-breakdown';
import type { AgentScope } from './query.service';

const scope: AgentScope = {
  userId: 'synthetic-user',
  branchIds: ['branch-a'],
  companyId: 'company-a',
  mode: 'own',
  payments: false,
};
function setup() {
  const tx = {
    $executeRaw: vi.fn(),
    salesContract: {
      findMany: vi.fn().mockResolvedValue([
        { id: 'a', status: 'CONFIRMED' },
        { id: 'b', status: 'COMPLETED' },
        { id: 'c', status: 'CANCELLED' },
        { id: 'd', status: 'SENT_TO_RESERVATIONS' },
        { id: 'e', status: 'DRAFT' },
      ]),
    },
    reservationIntake: {
      findMany: vi.fn().mockResolvedValue([
        {
          contractId: 'c',
          workflowRevisions: [
            { state: { supplierStatus: 'CANCELLED' }, createdAt: new Date() },
          ],
        },
        {
          contractId: 'd',
          workflowRevisions: [
            { state: { supplierStatus: 'CANCELLED' }, createdAt: new Date() },
          ],
        },
        {
          contractId: 'a',
          workflowRevisions: [
            { state: { supplierStatus: 'CONFIRMED' }, createdAt: new Date() },
          ],
        },
      ]),
    },
  };
  const db = {
    $transaction: vi.fn(
      async (
        work: (client: typeof tx) => Promise<unknown>,
        options: unknown,
      ) => {
        void options;
        return work(tx);
      },
    ),
  };
  return {
    tx,
    db: db as unknown as DatabaseClient,
    transaction: db.$transaction,
  };
}
describe('native authorized contract count reconciliation', () => {
  it('uses one read-only repeatable snapshot, avoids double cancellation and separates completed from active', async () => {
    const h = setup();
    const result = await readContractCountBreakdown(h.db, scope);
    expect(result.rows).toEqual([
      {
        panel_non_cancelled: 3,
        sales_cancelled: 1,
        reservation_cancelled_only: 1,
        completed_non_cancelled: 1,
        active_panel: 2,
        total: 5,
      },
    ]);
    expect(h.transaction.mock.calls[0]![1]).toEqual({
      isolationLevel: 'RepeatableRead',
      timeout: 7000,
    });
    expect(h.tx.$executeRaw).toHaveBeenCalledTimes(2);
    expect(h.tx.reservationIntake.findMany.mock.calls[0]![0]).toMatchObject({
      where: { contractId: { in: ['a', 'b', 'c', 'd', 'e'] } },
      orderBy: [{ contractId: 'asc' }, { contractVersion: 'desc' }],
    });
  });
  it.each(['all', 'branch', 'own'] as const)(
    'enforces %s scope with hidden and selected company constraints',
    async (mode) => {
      const h = setup();
      await readContractCountBreakdown(h.db, { ...scope, mode });
      expect(h.tx.salesContract.findMany.mock.calls[0]![0].where).toEqual({
        hiddenAt: null,
        legalEntityId: 'company-a',
        ...(mode !== 'all' ? { branchId: { in: ['branch-a'] } } : {}),
        ...(mode === 'own' ? { ownerUserId: 'synthetic-user' } : {}),
      });
    },
  );
  it('does not report zero on source failure or excessive coverage', async () => {
    const h = setup();
    h.tx.reservationIntake.findMany.mockRejectedValue(new Error('unavailable'));
    await expect(readContractCountBreakdown(h.db, scope)).rejects.toThrow(
      'unavailable',
    );
    h.tx.salesContract.findMany.mockResolvedValue(
      Array(50001).fill({ id: 'x', status: 'CONFIRMED' }),
    );
    await expect(readContractCountBreakdown(h.db, scope)).rejects.toThrow(
      'COUNT_SOURCE_LIMIT',
    );
  });
  it.each(['all', 'branch', 'own'] as const)(
    'always intersects a personal count with the %s actor and selected tenant',
    async (mode) => {
      const h = setup();
      await readContractCountBreakdown(
        h.db,
        { ...scope, mode, branchIds: mode === 'all' ? [] : ['branch-a'] },
        'mine',
      );
      expect(h.tx.salesContract.findMany.mock.calls[0]![0].where).toEqual({
        hiddenAt: null,
        legalEntityId: 'company-a',
        ownerUserId: 'synthetic-user',
        ...(mode === 'all' ? {} : { branchId: { in: ['branch-a'] } }),
      });
    },
  );
});
