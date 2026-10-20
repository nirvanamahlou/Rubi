import { vi } from 'vitest';

/** Transaction fake for cash-command unit tests; PostgreSQL tests prove durability. */
export function financialEventStore() {
  const rows = new Map<string, { sourceKey: string; fingerprint: string }>();
  return {
    createMany: vi.fn(
      async ({
        data,
      }: {
        data: { sourceKey: string; fingerprint: string }[];
      }) => {
        for (const row of data)
          if (!rows.has(row.sourceKey)) rows.set(row.sourceKey, row);
        return { count: rows.size };
      },
    ),
    findUniqueOrThrow: vi.fn(
      async ({ where }: { where: { sourceKey: string } }) => {
        const row = rows.get(where.sourceKey);
        if (!row) throw new Error('Missing durable event');
        return row;
      },
    ),
  };
}
