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
      meta: { page: 1, pageSize: 25, hasMore: false, services: [] },
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
        {
          contractNumber: 'MATCH',
          serviceSelections: [{ kind: 'INSURANCE', clientKey: 'i' }],
        },
        {
          contractNumber: 'MATCH',
          serviceSelections: [{ kind: 'HOTEL', clientKey: 'h' }],
        },
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
        {
          contractNumber: 'MATCH',
          serviceSelections: [{ kind: 'TRANSFER', clientKey: 't' }],
        },
      ];
      snapshots.push({
        contractNumber: 'MIX',
        serviceSelections: [
          { kind: 'HOTEL', clientKey: 'h' },
          { kind: 'INSURANCE', clientKey: 'i' },
          { kind: 'TRANSFER', clientKey: 't_out' },
          { kind: 'TRANSFER', clientKey: 't_in' },
        ],
        hotelSelection: { serviceClientKey: 'h', checkInDate: '2026-10-15' },
      } as (typeof snapshots)[number]);
      const mixedId = '22222222-2222-4222-8222-000000000032';
      let actualRows: {
        id: string;
        clientKey: string;
        status: string;
        sortAt: string | null;
        purchasedAt: string | null;
      }[] = [];
      const insert = Array.from(
        { length: 33 },
        (_, i) =>
          `('${`22222222-2222-4222-8222-${String(i).padStart(12, '0')}`}', '${i === 31 ? '33333333-3333-4333-8333-333333333333' : branch}', '${i === 32 ? '2026-10-07' : '2026-10-08'}', '${JSON.stringify(snapshots[i === 32 ? 5 : i < 5 ? i : 0])}'::jsonb)`,
      ).join(',');
      const literal = (value: unknown) =>
        typeof value === 'boolean'
          ? String(value)
          : typeof value === 'number'
            ? String(value)
            : `'${String(value).replaceAll("'", "''")}'`;
      h.query.mockImplementation(async (sql: Prisma.Sql) => {
        const fixture = `BEGIN; CREATE TEMP TABLE "ReservationIntake" ("id" uuid,"branchId" uuid,"receivedAt" timestamptz,"snapshot" jsonb); INSERT INTO "ReservationIntake" VALUES ${insert}; CREATE TEMP TABLE "ReservationServicePurchase" ("intakeId" uuid,"serviceClientKey" text,"coveredServiceClientKeys" jsonb,version int,"createdAt" timestamptz); CREATE TEMP TABLE "ReservationHotelPurchase" ("intakeId" uuid,"createdAt" timestamptz); INSERT INTO "ReservationServicePurchase" VALUES ('${mixedId}','h',NULL,1,'2026-10-01'),('${mixedId}','h',NULL,2,'2026-10-09 23:59:59+00'),('${mixedId}','t_out','["t_out","t_in"]'::jsonb,3,'2026-10-11'); INSERT INTO "ReservationHotelPurchase" VALUES ('22222222-2222-4222-8222-000000000002','2026-10-10'); PREPARE purchase_inbox AS SELECT row_to_json(r) FROM (${sql.text}) r; EXECUTE purchase_inbox(${sql.values.map(literal).join(',')}); ROLLBACK;`;
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
        actualRows = output
          .trim()
          .split(/\r?\n/)
          .filter(Boolean)
          .map((row) => JSON.parse(row));
        return actualRows;
      });
      expect(
        (
          await h.service.purchaseInbox([branch], {
            kind: 'INSURANCE',
            contractNumber: 'MATCH',
          })
        ).meta.hasMore,
      ).toBe(true);
      expect(h.findMany.mock.calls.at(-1)![0].where.id.in).toHaveLength(25);
      await h.service.purchaseInbox([branch], {
        kind: 'INSURANCE',
        contractNumber: 'MATCH',
        page: '2',
      });
      expect(h.findMany.mock.calls.at(-1)![0].where.id.in).toHaveLength(2);
      await h.service.purchaseInbox([branch], {
        kind: 'HOTEL',
        contractNumber: 'MATCH',
      });
      expect(h.findMany.mock.calls.at(-1)![0].where.id.in).toHaveLength(2);
      await h.service.purchaseInbox([branch], { kind: 'FLIGHT' });
      expect(h.findMany.mock.calls.at(-1)![0].where.id.in).toHaveLength(1);
      await h.service.purchaseInbox([branch], {
        kind: 'TRANSFER',
        contractNumber: 'MATCH',
      });
      expect(h.findMany.mock.calls.at(-1)![0].where.id.in).toHaveLength(1);
      await h.service.purchaseInbox([branch], {
        contractNumber: 'MIX',
        status: 'UNREGISTERED',
      });
      expect(actualRows.map((r) => r.clientKey)).toEqual(['i']);
      await h.service.purchaseInbox([branch], {
        contractNumber: 'MIX',
        status: 'REGISTERED',
        dateBy: 'PURCHASE',
        from: '2026-10-09',
        to: '2026-10-09',
      });
      expect(actualRows).toHaveLength(1);
      expect(actualRows[0]!.purchasedAt).toBe('2026-10-09T23:59:59.000Z');
      await h.service.purchaseInbox([branch], {
        contractNumber: 'MIX',
        dateBy: 'PURCHASE',
        to: '2026-10-08',
      });
      expect(actualRows).toHaveLength(0);
      await h.service.purchaseInbox([branch], {
        contractNumber: 'MIX',
        dateBy: 'CHECK_IN',
        from: '2026-10-15',
        to: '2026-10-15',
      });
      expect(actualRows.map((r) => r.clientKey)).toEqual(['h']);
      await h.service.purchaseInbox([branch], {
        contractNumber: 'MIX',
        dateBy: 'PURCHASE',
        direction: 'ASC',
      });
      expect(actualRows.map((r) => r.clientKey)).toEqual([
        'h',
        't_in',
        't_out',
        'i',
      ]);
      await h.service.purchaseInbox([branch], {
        dateBy: 'ENTRY',
        direction: 'ASC',
      });
      expect(actualRows[0]!.id).toBe(mixedId);
      await h.service.purchaseInbox([branch], {
        dateBy: 'ENTRY',
        from: '2026-10-07',
        to: '2026-10-07',
      });
      expect(actualRows).toHaveLength(4);
      await h.service.purchaseInbox([branch], {
        kind: 'HOTEL',
        contractNumber: 'MATCH',
        status: 'REGISTERED',
        dateBy: 'PURCHASE',
        from: '2026-10-10',
        to: '2026-10-10',
      });
      expect(actualRows).toHaveLength(1);
      await h.service.purchaseInbox([branch], {
        kind: 'FLIGHT',
        status: 'UNREGISTERED',
      });
      expect(actualRows).toHaveLength(0);
      await h.service.purchaseInbox(
        [branch],
        {
          kind: 'FLIGHT',
          status: 'REGISTERED',
          dateBy: 'PURCHASE',
          from: '2026-10-09',
          to: '2026-10-09',
        },
        [
          {
            id: 'flight',
            branchId: branch,
            offerId: 'offer',
            referenceId: 'offer',
            registered: true,
            entryAt: '2026-10-01',
            departureAt: '2026-10-20',
            purchasedAt: '2026-10-09',
          },
        ],
      );
      expect(actualRows).toHaveLength(1);
      h.findMany.mockClear();
      await h.service.purchaseInbox([branch], { contractNumber: 'NO MATCH' });
      expect(h.findMany).not.toHaveBeenCalled();
    });
  },
);
