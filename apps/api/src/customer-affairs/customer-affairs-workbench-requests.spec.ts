import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';

import { CustomerAffairsService } from './customer-affairs.service';

const actor = {
  userId: 'owner-1',
  branchIds: ['branch-1'],
  permissions: [],
} as unknown as AuthenticatedActor;

describe('CustomerAffairsService workbenchRequests', () => {
  it('returns the submitted request description for the owner workspace', async () => {
    const repository = {
      workbenchRequests: vi.fn().mockResolvedValue([
        {
          id: 'request-1',
          trackingNumber: 'CA-T-1',
          subject: 'درخواست مرخصی',
          description: 'لطفاً مرخصی روز دوشنبه بررسی شود.',
          executionUnit: 'منابع انسانی',
          status: 'NEW',
          priority: 'URGENT',
          nextActionAt: new Date('2026-09-28T08:00:00.000Z'),
          updatedAt: new Date('2026-09-27T08:00:00.000Z'),
        },
      ]),
    };
    const service = new CustomerAffairsService(
      repository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.workbenchRequests(actor)).resolves.toEqual({
      data: [
        expect.objectContaining({
          description: 'لطفاً مرخصی روز دوشنبه بررسی شود.',
        }),
      ],
    });
    expect(repository.workbenchRequests).toHaveBeenCalledWith('owner-1', [
      'branch-1',
    ]);
  });

  it('shows HR-directed workbench requests only to a branch recipient', async () => {
    const repository = {
      hrWorkbenchRequests: vi.fn().mockResolvedValue([
        {
          id: 'request-1',
          trackingNumber: 'CA-T-1',
          subject: 'نیاز پرسنلی',
          description: 'شرح درخواست',
          executionUnit: 'منابع انسانی',
          status: 'NEW',
          priority: 'NORMAL',
          nextActionAt: new Date('2026-09-28T08:00:00.000Z'),
          updatedAt: new Date('2026-09-27T08:00:00.000Z'),
        },
      ]),
    };
    const directory = {
      workbenchFeedbackRecipientUserIds: vi
        .fn()
        .mockResolvedValue([actor.userId]),
    };
    const service = new CustomerAffairsService(
      repository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      directory as never,
    );
    const result = await service.hrWorkbenchRequests(actor);
    expect(repository.hrWorkbenchRequests).toHaveBeenCalledWith(['branch-1']);
    expect(result.data[0]?.description).toBe('شرح درخواست');
    directory.workbenchFeedbackRecipientUserIds.mockResolvedValue([]);
    await expect(service.hrWorkbenchRequests(actor)).resolves.toEqual({
      data: [],
    });
  });
});
