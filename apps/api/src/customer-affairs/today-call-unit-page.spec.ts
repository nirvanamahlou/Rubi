import { expect, it, vi } from 'vitest';
import { Prisma } from '@nora/database';
import { todayCallUnitPage } from './today-call-unit-page';

it('counts matches across batches before paging and uses the presented destination', async () => {
  const rows = Array.from({ length: 205 }, (_, index) => ({
    id: String(index),
    callCount: 3n,
  }));
  const raw = vi
    .fn()
    .mockResolvedValueOnce(rows.slice(0, 200))
    .mockResolvedValueOnce(rows.slice(200));
  const findMany = vi.fn(
    async ({ where }: { where: { id: { in: string[] } } }) =>
      where.id.in.map((id) => ({ id })),
  );
  const tx = {
    $queryRaw: raw,
    callCenterCall: { findMany },
  } as unknown as Prisma.TransactionClient;
  const present = vi.fn(async (calls: { id: string }[]) =>
    calls.map((call) => ({
      ...call,
      direction: 'INBOUND',
      operator: 'old label',
      answerRecipient: { label: Number(call.id) % 2 === 0 ? 'فروش' : 'مالی' },
    })),
  );
  const result = await todayCallUnitPage(
    tx,
    Prisma.sql`TRUE`,
    { page: 11, pageSize: 10, unit: 'فروش' },
    present as unknown as Parameters<typeof todayCallUnitPage>[3],
  );
  expect(result.total).toBe(103);
  expect(result.data.map((row) => row.call.id)).toEqual(['200', '202', '204']);
  expect(result.data.every((row) => row.callCount === 3)).toBe(true);
  expect(raw).toHaveBeenCalledTimes(2);
});

it('returns an empty filtered page without inventing a total', async () => {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    callCenterCall: { findMany: vi.fn().mockResolvedValue([]) },
  } as unknown as Prisma.TransactionClient;
  expect(
    await todayCallUnitPage(
      tx,
      Prisma.sql`FALSE`,
      { page: 1, pageSize: 20, unit: 'نامشخص' },
      async () => [],
    ),
  ).toEqual({ data: [], total: 0 });
});
