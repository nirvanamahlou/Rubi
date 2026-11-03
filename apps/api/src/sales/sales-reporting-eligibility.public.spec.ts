import { describe, expect, it, vi } from 'vitest';
import type { DatabaseClient } from '@nora/database';
import { readSalesReportingEligibility } from './sales-reporting-eligibility.public';

describe('Sales-owned reporting eligibility', () => {
  it('does not let generic reporting access replace native contract access', async () => {
    await expect(
      readSalesReportingEligibility({} as DatabaseClient, {
        userId: 'user',
        branchIds: ['branch'],
        permissions: ['reporting.read'],
      }),
    ).rejects.toThrow();
  });
  it('restricts own readers to their branch and owner, excludes drafts and cancellations without reading prices', async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 'contract' }]);
    const client = { salesContract: { findMany } } as unknown as DatabaseClient;
    expect(
      await readSalesReportingEligibility(client, {
        userId: 'user',
        branchIds: ['branch'],
        permissions: ['sales.contracts.read.own'],
      }),
    ).toEqual(['contract']);
    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      where: {
        ownerUserId: 'user',
        branchId: { in: ['branch'] },
        confirmedAt: { not: null },
        status: {
          in: ['CONFIRMED', 'SENT_TO_RESERVATIONS', 'IN_PROGRESS', 'COMPLETED'],
        },
      },
      select: { id: true },
      take: 10001,
    });
  });
  it('does not silently truncate eligible contracts', async () => {
    const client = {
      salesContract: {
        findMany: vi
          .fn()
          .mockResolvedValue(
            Array.from({ length: 10001 }, (_, n) => ({ id: String(n) })),
          ),
      },
    } as unknown as DatabaseClient;
    await expect(
      readSalesReportingEligibility(client, {
        userId: 'user',
        branchIds: ['branch'],
        permissions: ['sales.contracts.read.all'],
      }),
    ).rejects.toThrow('بازه');
  });
});
