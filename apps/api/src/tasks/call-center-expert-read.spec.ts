import { it, expect, vi } from 'vitest';
import { callCenterExpertTasks } from './call-center-read';
it('reads current tasks only for authorized assignees and never exposes title/history payload', async () => {
  const findMany = vi
    .fn()
    .mockResolvedValue([{ assigneeUserId: 'u', dueAt: null }]);
  expect(
    await callCenterExpertTasks(
      { automationTask: { findMany } } as never,
      'b',
      ['u'],
    ),
  ).toEqual([{ ownerId: 'u', dueAt: null }]);
  expect(findMany).toHaveBeenCalledWith({
    where: {
      branchId: 'b',
      sourceModule: 'CALL_CENTER',
      status: 'OPEN',
      assigneeUserId: { in: ['u'] },
    },
    select: { assigneeUserId: true, dueAt: true },
    orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
    take: 10001,
  });
});
