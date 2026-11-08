import 'reflect-metadata';
import { expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import { TravelWorkflowService } from './travel-workflow.service';
import { initialTravelWorkflow } from './travel-workflow';

function fixture() {
  const state = {
    ...initialTravelWorkflow(),
    branding: {
      kind: 'OWN',
      referenceId: 'company',
      name: 'Synthetic',
      logoFileId: null,
    },
    supplierFormSettings: { brokerId: 'broker', text: { remarks: 'NOTE' } },
  };
  const tx = {
    $queryRaw: vi.fn(),
    reservationWorkflowRevision: {
      findFirst: vi.fn().mockResolvedValue({ state }),
      create: vi.fn().mockResolvedValue({ id: 'revision' }),
    },
  };
  const transaction = vi.fn(async (cb: (tx: unknown) => unknown) => cb(tx));
  const mail = {
    prepare: vi.fn().mockResolvedValue({ id: 'queued' }),
    enqueue: vi.fn(),
  };
  type D = ConstructorParameters<typeof TravelWorkflowService>;
  const service = new TravelWorkflowService(
    { client: { $transaction: transaction } } as unknown as D[0],
    {
      current: vi
        .fn()
        .mockResolvedValue({ data: { legalEntity: { id: 'company' } } }),
    } as unknown as D[1],
    {} as D[2],
    {} as D[3],
    {} as D[4],
    undefined,
    mail as unknown as D[6],
  );
  vi.spyOn(service, 'detail').mockResolvedValue({
    workflow: state,
    branchId: 'branch',
    snapshot: {
      passengerIds: [],
      contractNumber: 'TEST',
      serviceSelections: [],
      ticketSelections: [],
    },
  } as never);
  const actor = {
    userId: 'actor',
    branchIds: ['branch'],
    permissions: ['reservations.documents.manage'],
  } as AuthenticatedActor;
  return { service, actor, tx, transaction, mail };
}
it('stores workflow and queued mail in exactly the same transaction', async () => {
  const f = fixture();
  await f.service.update(
    'intake',
    { action: 'REQUEST_SUPPLIER', expectedVersion: 0, note: '' },
    f.actor,
  );
  expect(f.mail.enqueue).toHaveBeenCalledWith(
    f.tx,
    { id: 'queued' },
    'revision',
  );
  expect(f.tx.reservationWorkflowRevision.create).toHaveBeenCalledOnce();
  expect(f.transaction).toHaveBeenCalledOnce();
});
it('does not create a sent revision when SMTP preflight fails', async () => {
  const f = fixture();
  f.mail.prepare.mockRejectedValue(new Error('NOT_READY'));
  await expect(
    f.service.update(
      'intake',
      { action: 'REQUEST_SUPPLIER', expectedVersion: 0, note: '' },
      f.actor,
    ),
  ).rejects.toThrow('NOT_READY');
  expect(f.transaction).not.toHaveBeenCalled();
});
it('rejects unauthorized users before preparing any email', async () => {
  const f = fixture();
  await expect(
    f.service.update(
      'intake',
      { action: 'REQUEST_SUPPLIER', expectedVersion: 0, note: '' },
      { ...f.actor, permissions: [] },
    ),
  ).rejects.toThrow();
  expect(f.mail.prepare).not.toHaveBeenCalled();
});
it('does not enqueue stale requests and propagates queue failures to rollback the transaction', async () => {
  const f = fixture();
  await expect(
    f.service.update(
      'intake',
      { action: 'REQUEST_SUPPLIER', expectedVersion: 9, note: '' },
      f.actor,
    ),
  ).rejects.toThrow();
  expect(f.mail.enqueue).not.toHaveBeenCalled();
  f.mail.enqueue.mockRejectedValue(new Error('QUEUE_FAILED'));
  await expect(
    f.service.update(
      'intake',
      { action: 'REQUEST_SUPPLIER', expectedVersion: 0, note: '' },
      f.actor,
    ),
  ).rejects.toThrow('QUEUE_FAILED');
});
