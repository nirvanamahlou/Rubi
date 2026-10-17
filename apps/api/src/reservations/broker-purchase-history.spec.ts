import { describe, expect, it, vi } from 'vitest';
import { BrokerPurchaseHistory } from './broker-purchase-history';
import type { DatabaseService } from '../database/database.service';
import type { AuthenticatedActor } from '@nora/contracts';
const actor = {
  permissions: ['finance.read'],
  branchIds: ['11111111-1111-4111-8111-111111111111'],
} as unknown as AuthenticatedActor;
function setup(rows: unknown[] = []) {
  const query = vi.fn().mockResolvedValue(rows);
  return {
    query,
    service: new BrokerPurchaseHistory({
      client: { $queryRaw: query },
    } as unknown as DatabaseService),
  };
}
describe('broker purchase financial boundary', () => {
  it('rejects nonfinancial readers before database access', async () => {
    const h = setup();
    await expect(
      h.service.list('broker', { ...actor, permissions: ['master_data.read'] }),
    ).rejects.toThrow();
    expect(h.query).not.toHaveBeenCalled();
  });
  it('returns no costs for an empty branch scope without querying', async () => {
    const h = setup();
    expect(await h.service.list('broker', { ...actor, branchIds: [] })).toEqual(
      { data: [], page: 1, hasMore: false },
    );
    expect(h.query).not.toHaveBeenCalled();
  });
  it.each(['0', '-1', '1.5', 'NaN', '1000001'])(
    'rejects invalid page %s',
    async (page) => {
      const h = setup();
      await expect(h.service.list('broker', actor, page)).rejects.toThrow();
      expect(h.query).not.toHaveBeenCalled();
    },
  );
  it('bounds returned purchases and binds broker and branch as query parameters', async () => {
    const h = setup(
      Array.from({ length: 26 }, (_, id) => ({
        id: String(id),
        amount: '100.0001',
      })),
    );
    const result = await h.service.list(
      '22222222-2222-4222-8222-222222222222',
      actor,
      '2',
    );
    expect(result.data).toHaveLength(25);
    expect(result.hasMore).toBe(true);
    const sql = h.query.mock.calls[0]![0];
    expect(sql.values).toContain(actor.branchIds[0]);
    expect(sql.values).toContain('22222222-2222-4222-8222-222222222222');
    expect(sql.values).toContain(25);
  });
});
