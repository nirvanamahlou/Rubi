import 'reflect-metadata';
import { expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@rubi/contracts';
import { TravelWorkflowService } from './travel-workflow.service';
import { initialTravelWorkflow } from './travel-workflow';

it('persists confirmation and voucher together and notifies the sales owner in the same transaction', async () => {
  const state = {
    ...initialTravelWorkflow(),
    supplierStatus: 'REQUESTED',
    branding: {
      kind: 'OWN',
      referenceId: 'company',
      name: 'Demo',
      logoFileId: null,
    },
  };
  const create = vi.fn();
  const tx = {
    $queryRaw: vi.fn(),
    reservationWorkflowRevision: {
      findFirst: vi.fn().mockResolvedValue({ state }),
      create,
    },
  };
  const notify = vi.fn();
  type Dependencies = ConstructorParameters<typeof TravelWorkflowService>;
  const service = new TravelWorkflowService(
    {
      client: {
        $transaction: async (callback: (value: typeof tx) => unknown) =>
          callback(tx),
      },
    } as unknown as Dependencies[0],
    {} as Dependencies[1],
    {} as Dependencies[2],
    { createWithinTransaction: notify } as unknown as Dependencies[3],
  );
  vi.spyOn(service, 'detail').mockResolvedValue({
    salesOwnerUserId: 'owner',
    contractId: 'contract',
    snapshot: { passengerIds: [], contractNumber: 'DEMO' },
  } as unknown as Awaited<ReturnType<TravelWorkflowService['detail']>>);
  const result = await service.update(
    'intake',
    {
      action: 'CONFIRM_SUPPLIER',
      expectedVersion: 0,
      note: 'Confirmed',
      supplierReference: 'REF',
      acknowledgeMissingInsurance: true,
    },
    {
      userId: 'actor',
      branchIds: ['branch'],
      permissions: ['reservations.documents.manage'],
    } as AuthenticatedActor,
  );
  expect(result.voucherIssued).toBe(true);
  expect(create).toHaveBeenCalledTimes(1);
  expect(create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        state: expect.objectContaining({
          voucherIssued: true,
          supplierStatus: 'CONFIRMED',
        }),
      }),
    }),
  );
  expect(notify).toHaveBeenCalledWith(
    tx,
    expect.objectContaining({
      recipientUserIds: ['owner'],
      eventType: 'ISSUE_VOUCHER',
      entityId: 'contract',
    }),
  );
});
