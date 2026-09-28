import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import type { DatabaseService } from '../database/database.service';
import type { IamService } from '../iam/iam.service';
import type { MasterHrDirectory } from '../master-data/master-hr-directory';
import { HrDirectoryService } from './hr-directory.service';

describe('HrDirectoryService document branch names', () => {
  it('reads only active HR branches in the actor scope and maps their names', async () => {
    const findMany = vi.fn().mockResolvedValue([
      { branchId: 'branch-a', values: [' نیایش سیر '] },
      { branchId: 'branch-a', values: ['نام قدیمی'] },
      { branchId: 'branch-b', values: ['جهان باستان'] },
    ]);
    const service = new HrDirectoryService(
      { client: { hrRecord: { findMany } } } as unknown as DatabaseService,
      {} as IamService,
      {} as MasterHrDirectory,
    );
    const actor = { branchIds: ['branch-a', 'branch-b'] } as AuthenticatedActor;

    expect(await service.documentBranchNames(actor)).toEqual(
      new Map([
        ['branch-a', 'نیایش سیر'],
        ['branch-b', 'جهان باستان'],
      ]),
    );
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          branchId: { in: actor.branchIds },
          section: 'organization',
          tab: 'branches',
          status: 'فعال',
          deletedAt: null,
        },
      }),
    );
  });
});
