import { describe, it, expect, vi } from 'vitest';
import { CustomerAffairsRepository } from './customer-affairs.repository';

describe('Workbench queries and personal removal', () => {
  it('filters calendar referrals through the ticket category', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repo = new CustomerAffairsRepository({
      client: { customerAffairsReferral: { findMany } },
    } as never);
    await repo.workbenchReferrals('user', ['branch']);
    const query = findMany.mock.calls[0]![0];
    expect(query.where).not.toHaveProperty('category');
    expect(query.where.ticket).toEqual({
      branchId: { in: ['branch'] },
      category: { not: 'CALL_CENTER_REQUEST' },
    });
  });
  it('hides a request only in the removing user inbox', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repo = new CustomerAffairsRepository({
      client: { customerAffairsTicket: { findMany } },
    } as never);
    await repo.workbenchRequests('user', ['branch']);
    expect(findMany.mock.calls[0]![0].where.timeline).toEqual({
      none: { type: 'WORKBENCH_REMOVED', actorUserId: 'user' },
    });
  });
  it('denies deletion of an unrelated request without an audit mutation', async () => {
    const tx = {
      customerAffairsTicket: { findFirst: vi.fn().mockResolvedValue(null) },
      customerAffairsTimeline: { upsert: vi.fn() },
    };
    const repo = new CustomerAffairsRepository({
      client: { $transaction: (fn: (tx: unknown) => unknown) => fn(tx) },
    } as never);
    await expect(
      repo.removeWorkbenchRequest('ticket', 'user', ['branch']),
    ).rejects.toThrow();
    expect(tx.customerAffairsTimeline.upsert).not.toHaveBeenCalled();
    expect(tx.customerAffairsTicket.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'ticket',
          branchId: { in: ['branch'] },
          category: { startsWith: 'WORKBENCH_' },
          OR: [
            { createdByUserId: 'user' },
            {
              timeline: {
                some: {
                  type: 'WORKBENCH_RECIPIENT_REVIEW',
                  outcome: 'APPROVED',
                  actorUserId: 'user',
                },
              },
            },
            { executionOwnerUserId: 'user' },
            {
              timeline: {
                some: { type: 'WORKBENCH_SUBSTITUTE', summary: 'user' },
              },
            },
          ],
        },
      }),
    );
  });
  it('applies author, branch and exact tracking number before paging personal status lookups', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repo = new CustomerAffairsRepository({
      client: { customerAffairsTicket: { findMany } },
    } as never);
    await repo.workbenchRequests('reviewer', ['local'], {
      trackingNumber: 'CA-T-2026-BFFFFFFA',
    });
    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      take: 101,
      where: {
        createdByUserId: 'reviewer',
        trackingNumber: 'CA-T-2026-BFFFFFFA',
        branchId: { in: ['local'] },
        category: { startsWith: 'WORKBENCH_' },
        timeline: {
          none: { type: 'WORKBENCH_REMOVED', actorUserId: 'reviewer' },
        },
      },
    });
  });
});
