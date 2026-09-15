import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { ReportingService, type ReportingActor } from './reporting.service';

const actor: ReportingActor = {
  userId: '11111111-1111-4111-8111-111111111111',
  branchIds: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
  permissions: [
    'reporting.read',
    'reporting.share',
    'reporting.sales.read',
  ],
};

function repository(overrides: Record<string, unknown> = {}) {
  return {
    savedReportById: vi.fn().mockResolvedValue({
      id: '22222222-2222-4222-8222-222222222222',
      ownerUserId: actor.userId,
      reportCode: 'sales_by_service_route',
    }),
    sharingCandidates: vi.fn().mockResolvedValue([
      {
        id: '33333333-3333-4333-8333-333333333333',
        displayName: 'کاربر مجاز',
        username: 'report.viewer',
        permissions: ['reporting.read', 'reporting.sales.read'],
      },
    ]),
    sharedRecipientIds: vi.fn().mockResolvedValue([]),
    replaceSavedReportShares: vi.fn().mockResolvedValue({
      savedReportId: '22222222-2222-4222-8222-222222222222',
      recipientUserIds: ['33333333-3333-4333-8333-333333333333'],
    }),
    ...overrides,
  };
}

describe('reporting direct sharing', () => {
  it('shares only with an active candidate that can read the report', async () => {
    const repo = repository();
    const service = new ReportingService(repo as never);

    await expect(
      service.shareSavedReport(
        '22222222-2222-4222-8222-222222222222',
        ['33333333-3333-4333-8333-333333333333'],
        actor,
      ),
    ).resolves.toMatchObject({
      recipientUserIds: ['33333333-3333-4333-8333-333333333333'],
    });
    expect(repo.replaceSavedReportShares).toHaveBeenCalledWith(
      '22222222-2222-4222-8222-222222222222',
      actor.userId,
      ['33333333-3333-4333-8333-333333333333'],
    );
  });

  it('does not allow a non-owner to change recipients', async () => {
    const service = new ReportingService(
      repository({
        savedReportById: vi.fn().mockResolvedValue({
          ownerUserId: '44444444-4444-4444-8444-444444444444',
          reportCode: 'sales_by_service_route',
        }),
      }) as never,
    );
    await expect(
      service.shareSavedReport(
        '22222222-2222-4222-8222-222222222222',
        ['33333333-3333-4333-8333-333333333333'],
        actor,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a recipient without report permission', async () => {
    const service = new ReportingService(repository() as never);
    await expect(
      service.shareSavedReport(
        '22222222-2222-4222-8222-222222222222',
        ['55555555-5555-4555-8555-555555555555'],
        actor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
