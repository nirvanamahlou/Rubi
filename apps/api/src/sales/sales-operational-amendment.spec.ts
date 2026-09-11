import 'reflect-metadata';
import { expect, it, vi } from 'vitest';
import { SalesOperationalAmendmentService } from './sales-operational-amendment.module';
import type { AuthenticatedActor, VoucherSettingsV1 } from '@rubi/contracts';
it('checks Sales scope and preserves existing metadata with a versioned audit', async () => {
  const row = {
    id: 'c',
    branchId: 'b',
    ownerUserId: 'u',
    version: 2,
    status: 'CONFIRMED',
    services: [
      { id: 's', kind: 'HOTEL', metadata: { reservationNote: 'KEEP' } },
    ],
  };
  const tx = {
    salesContract: {
      findUnique: vi.fn().mockResolvedValue(row),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    salesContractService: { update: vi.fn() },
    salesContractAuditEvent: { create: vi.fn() },
  };
  const actor = {
    userId: 'u',
    branchIds: ['b'],
    permissions: ['sales.contracts.update.own'],
  } as unknown as AuthenticatedActor;
  const service = new SalesOperationalAmendmentService();
  type Tx = Parameters<typeof service.apply>[0];
  await expect(
    service.apply(
      tx as unknown as Tx,
      'c',
      1,
      {} as VoucherSettingsV1,
      actor,
      'edit',
    ),
  ).rejects.toThrow();
  await expect(
    service.apply(
      tx as unknown as Tx,
      'c',
      2,
      {} as VoucherSettingsV1,
      { ...actor, permissions: [] },
      'edit',
    ),
  ).rejects.toThrow();
  expect(tx.salesContractService.update).not.toHaveBeenCalled();
  await service.apply(
    tx as unknown as Tx,
    'c',
    2,
    {} as VoucherSettingsV1,
    actor,
    'edit',
  );
  const metadata =
    tx.salesContractService.update.mock.calls[0]![0].data.metadata;
  expect(metadata.reservationNote).toBe('KEEP');
  expect(
    JSON.parse(metadata.reservationFormAmendment).targetContractVersion,
  ).toBe(3);
  expect(tx.salesContractAuditEvent.create).toHaveBeenCalledOnce();
  expect(tx.salesContract.updateMany.mock.calls[0]![0].data).toEqual({
    version: { increment: 1 },
  });
});
