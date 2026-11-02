import { expect, it, vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ReservationRequestsController } from './reservations-runtime.module';
it('returns only completion and scopes the source to the authenticated branches', async () => {
  const purchaseContext = vi.fn().mockResolvedValue({
    snapshot: { serviceSelections: [{ clientKey: 'hotel', kind: 'HOTEL' }] },
    servicePurchases: [
      { serviceClientKey: 'hotel', amount: '123', supplierName: 'private' },
    ],
  });
  const controller = new ReservationRequestsController(
    { purchaseContext } as never,
    undefined as never,
    undefined as never,
    undefined as never,
    undefined as never,
    undefined as never,
    undefined as never,
  );
  const request = {
    actor: { permissions: ['reservations.read'], branchIds: ['branch'] },
  } as never;
  expect(await controller.purchaseCompletion('intake', request)).toEqual({
    data: { complete: true },
  });
  expect(purchaseContext).toHaveBeenCalledWith('intake', ['branch']);
  await expect(
    controller.purchaseCompletion('intake', {
      actor: { permissions: [], branchIds: ['branch'] },
    } as never),
  ).rejects.toBeInstanceOf(ForbiddenException);
  expect(purchaseContext).toHaveBeenCalledTimes(1);
  purchaseContext.mockRejectedValueOnce(new NotFoundException());
  await expect(
    controller.purchaseCompletion('foreign-intake', request),
  ).rejects.toBeInstanceOf(NotFoundException);
});
