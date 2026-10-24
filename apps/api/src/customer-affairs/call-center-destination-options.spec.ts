import 'reflect-metadata';
import { expect, it, vi } from 'vitest';
import { CallCenterService } from './call-center.service';
import type { AuthenticatedActor } from '@nora/contracts';
const actor = {
  userId: 'user',
  branchIds: ['branch-a'],
  permissions: [
    'customer_affairs.call_center.read',
    'customer_affairs.call_center.calls.create',
  ],
} as AuthenticatedActor;
it('checks permission, branch and operator scope before calling the HR public directory', async () => {
  const where = vi.fn().mockResolvedValue({ branchId: 'branch-a' });
  const options = vi
    .fn()
    .mockResolvedValue([
      { label: 'Expert Sales - Synthetic - 404', extension: '404' },
    ]);
  const service = new CallCenterService(
    {} as never,
    {} as never,
    { where } as never,
    { options } as never,
  );
  await expect(
    service.destinationOptions(actor, 'branch-b'),
  ).rejects.toMatchObject({ status: 403 });
  await expect(
    service.destinationOptions({ ...actor, permissions: [] }, 'branch-a'),
  ).rejects.toMatchObject({ status: 403 });
  expect(options).not.toHaveBeenCalled();
  expect(
    (await service.destinationOptions(actor, 'branch-a')).data,
  ).toHaveLength(1);
  expect(where).toHaveBeenCalledWith(actor, 'branch-a');
  where.mockRejectedValueOnce(Error('scope denied'));
  await expect(service.destinationOptions(actor, 'branch-a')).rejects.toThrow(
    'scope denied',
  );
  expect(options).toHaveBeenCalledTimes(1);
});
