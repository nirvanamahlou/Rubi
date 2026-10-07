import { execFileSync } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@nora/database';
import type { DatabaseService } from '../database/database.service';
import { ReservationsPublicService } from './reservations-public.service';
const branch = '11111111-1111-4111-8111-111111111111';
function harness() {
  const query = vi.fn().mockResolvedValue([]);
  const findMany = vi.fn().mockResolvedValue([]);
  return {
    query,
    findMany,
    service: new ReservationsPublicService({
      client: { $queryRaw: query, reservationIntake: { findMany } },
    } as unknown as DatabaseService),
  };
}
describe('reservation purchases inbox boundary', () => {
  it('does not read any records for an empty branch scope', async () => {
    const h = harness();
    expect(await h.service.purchaseInbox([], {})).toEqual({
      data: [],
      meta: { page: 1, pageSize: 25, hasMore: false },
    });
    expect(h.query).not.toHaveBeenCalled();
  });
  it.each([
    { page: '0' },
    { page: '1.5' },
    { kind: 'INVALID' },
    { contractNumber: 'x'.repeat(101) },
    { contractNumber: ['a'] },
  ])('rejects invalid filters before database access: %j', async (options) => {
    const h = harness();
    await expect(
      h.service.purchaseInbox([branch], options as { page?: string }),
    ).rejects.toThrow();
    expect(h.query).not.toHaveBeenCalled();
  });
  it('applies branch/category/search and pagination in the query before hydration', async () => {
    const h = harness();
    h.query.mockResolvedValue(
      Array.from({ length: 26 }, (_, i) => ({ id: String(i) })),
    );
    const result = await h.service.purchaseInbox([branch], {
      page: '2',
      kind: 'INSURANCE',
      contractNumber: "CTR'42",
    });
    const sql = h.query.mock.calls[0]![0] as Prisma.Sql;
    expect(sql.values).toContain(branch);
    expect(sql.values).toContain('INSURANCE');
    expect(sql.values).toContain("CTR'42");
    expect(sql.text).not.toContain("CTR'42");
    expect(sql.values.at(-1)).toBe(25);
    expect(h.findMany.mock.calls[0]![0].where.id.in).toHaveLength(25);
    expect(h.findMany.mock.calls[0]![0].where.branchId.in).toEqual([branch]);
    expect(result.meta.hasMore).toBe(true);
  });
});
describe.skipIf(!process.env.RESERVATION_PURCHASE_QUERY_CONTAINER)(
  'purchase selection SQL with isolated temporary PostgreSQL fixtures',
  () => {
    it('includes unpurchased contracts, respects branches and filters before pagination', async () => {
      const h = harness();
      const snapshots = [
        { contractNumber: 'MATCH', serviceSelections: [{ kind: 'INSURANCE' }] },
        { contractNumber: 'MATCH', serviceSelections: [{ kind: 'HOTEL' }] },
        {
          contractNumber: 'MATCH',
          serviceSelections: [],
          hotelSelection: { serviceClientKey: 'h' },
        },
        {
          contractNumber: 'MATCH',
          serviceSelections: [],
          selectedTicketOfferIds: ['offer'],
        },
        { contractNumber: 'MATCH', serviceSelections: [{ kind: 'TRANSFER' }] },
      ];
      const insert = Array.from(
        { length: 32 },
        (_, i) =>
          `('${`22222222-2222-4222-8222-${String(i).padStart(12, '0')}`}', '${i === 31 ? '33333333-3333-4333-8333-333333333333' : branch}', '2026-10-07', '${JSON.stringify(snapshots[i < 5 ? i : 0])}'::jsonb)`,
      ).join(',');
      const literal = (value: unknown) =>
        typeof value === 'boolean'
          ? String(value)
          : typeof value === 'number'
            ? String(value)
            : `'${String(value).replaceAll("'", "''")}'`;
      h.query.mockImplementation(async (sql: Prisma.Sql) => {
        const fixture = `BEGIN; CREATE TEMP TABLE "ReservationIntake" ("id" uuid,"branchId" uuid,"receivedAt" timestamptz,"snapshot" jsonb); INSERT INTO "ReservationIntake" VALUES ${insert}; PREPARE purchase_inbox AS ${sql.text}; EXECUTE purchase_inbox(${sql.values.map(literal).join(',')}); ROLLBACK;`;
        const output = execFileSync(
          'docker',
          [
            'exec',
            '-i',
            process.env.RESERVATION_PURCHASE_QUERY_CONTAINER!,
            'sh',
            '-c',
            'psql -v ON_ERROR_STOP=1 -qAt -U "$POSTGRES_USER" -d postgres',
          ],
          { input: fixture, encoding: 'utf8' },
        );
        return output
          .trim()
          .split(/\r?\n/)
          .filter(Boolean)
          .map((id) => ({ id }));
      });
      expect(
        (await h.service.purchaseInbox([branch], { kind: 'INSURANCE' })).meta
          .hasMore,
      ).toBe(true);
      expect(h.findMany.mock.calls.at(-1)![0].where.id.in).toHaveLength(25);
      await h.service.purchaseInbox([branch], { kind: 'INSURANCE', page: '2' });
      expect(h.findMany.mock.calls.at(-1)![0].where.id.in).toHaveLength(2);
      await h.service.purchaseInbox([branch], { kind: 'HOTEL' });
      expect(h.findMany.mock.calls.at(-1)![0].where.id.in).toHaveLength(2);
      await h.service.purchaseInbox([branch], { kind: 'FLIGHT' });
      expect(h.findMany.mock.calls.at(-1)![0].where.id.in).toHaveLength(1);
      await h.service.purchaseInbox([branch], { kind: 'TRANSFER' });
      expect(h.findMany.mock.calls.at(-1)![0].where.id.in).toHaveLength(1);
      h.findMany.mockClear();
      await h.service.purchaseInbox([branch], { contractNumber: 'NO MATCH' });
      expect(h.findMany).not.toHaveBeenCalled();
    });
  },
);
