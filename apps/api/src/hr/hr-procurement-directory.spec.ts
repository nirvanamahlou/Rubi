import type { AuthenticatedActor } from '@nora/contracts';
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service';
import { HrProcurementDirectory } from './hr-procurement-directory';

const actor: AuthenticatedActor = {
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: '22222222-2222-4222-8222-222222222222',
  branchIds: ['branch-empty', 'branch-with-hr', 'branch-other'],
  permissions: ['procurement.request.create'],
};

describe('HR procurement directory', () => {
  it('selects the first authorized branch that has active employees', async () => {
    const findMany = vi.fn().mockResolvedValue([
      { branchId: 'branch-other' },
      { branchId: 'branch-with-hr' },
    ]);
    const directory = new HrProcurementDirectory({
      client: { hrEmployee: { findMany } },
    } as unknown as DatabaseService);

    await expect(directory.preferredBranch(actor)).resolves.toBe(
      'branch-with-hr',
    );
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          branchId: { in: actor.branchIds },
          status: 'فعال',
          deletedAt: null,
        }),
      }),
    );
  });

  it('returns no default when authorized branches have no active employee', async () => {
    const directory = new HrProcurementDirectory({
      client: { hrEmployee: { findMany: vi.fn().mockResolvedValue([]) } },
    } as unknown as DatabaseService);

    await expect(directory.preferredBranch(actor)).resolves.toBeNull();
  });
});
