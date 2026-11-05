import { expect, it, vi } from 'vitest';
import { ReservationRequestsController } from './reservations-runtime.module';
it('authorizes the intake before loading its current contract details', async () => {
  const detail = vi
    .fn()
    .mockResolvedValue({ contractId: 'canonical-contract' });
  const generalDetails = vi
    .fn()
    .mockResolvedValue({ customerName: 'Contract party' });
  const controller = new ReservationRequestsController(
    undefined as never,
    undefined as never,
    undefined as never,
    { detail } as never,
    undefined as never,
    undefined as never,
    undefined as never,
    { generalDetails } as never,
  );
  const actor = { permissions: ['reservations.read'], branchIds: ['branch'] };
  expect(
    await controller.generalDetails('request', { actor } as never),
  ).toEqual({ data: { customerName: 'Contract party' } });
  expect(detail).toHaveBeenCalledWith('request', ['branch']);
  expect(generalDetails).toHaveBeenCalledWith('canonical-contract', actor);
  await expect(
    controller.generalDetails('request', {
      actor: { permissions: [], branchIds: ['branch'] },
    } as never),
  ).rejects.toThrow();
  detail.mockRejectedValueOnce(new Error('out of scope'));
  await expect(
    controller.generalDetails('foreign', { actor } as never),
  ).rejects.toThrow('out of scope');
  expect(generalDetails).toHaveBeenCalledTimes(1);
});
