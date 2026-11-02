import 'reflect-metadata';
import type { AuthenticatedActor } from '@nora/contracts';
import { expect, it, vi } from 'vitest';
import { CallCenterWorkflowService } from './call-center-workflow.service';
it('intersects registrar, current team and request status with every queue count and paginated row query', async () => {
  const count = vi.fn().mockResolvedValue(0),
    findMany = vi.fn().mockResolvedValue([]);
  const tx = { customerAffairsTicket: { count, findMany } };
  const registrants = vi.fn().mockResolvedValue(['author']);
  const service = new CallCenterWorkflowService(
    {
      client: { $transaction: async (fn: (tx: unknown) => unknown) => fn(tx) },
    } as never,
    {} as never,
    { registrants } as never,
    { deadlines: async () => [], requestPredicate: () => ({}) } as never,
    {} as never,
    { scoped: () => false } as never,
  );
  const actor: AuthenticatedActor = {
    userId: 'reader',
    sessionId: 'test-session',
    permissions: ['customer_affairs.call_center.read'],
    branchIds: ['branch'],
  };
  await service.queue(actor, undefined, 'ALL', 2, {
    teamId: 'team',
    agentId: 'author',
    requestStatus: 'IN_PROGRESS',
  });
  expect(registrants).toHaveBeenCalledWith(['branch'], 'team');
  const where = findMany.mock.calls[0]![0].where;
  expect(where.branchId).toEqual({ in: ['branch'] });
  expect(where.AND).toEqual(
    expect.arrayContaining([
      { createdByUserId: { in: ['author'] } },
      { createdByUserId: 'author' },
      { status: { in: ['NEW', 'IN_PROGRESS'] } },
    ]),
  );
  expect(findMany.mock.calls[0]![0]).toMatchObject({ skip: 50, take: 50 });
  for (const [arg] of count.mock.calls)
    expect(arg.where.AND).toEqual(where.AND);
});
