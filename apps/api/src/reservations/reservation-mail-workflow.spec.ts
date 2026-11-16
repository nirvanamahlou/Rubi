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
    wake: vi.fn(),
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
it('resolves the request only within actor branches and stops before email preparation when inaccessible', async () => {
  const f = fixture();
  const detail = vi.mocked(f.service.detail);
  detail.mockRejectedValue(new Error('REQUEST_NOT_ACCESSIBLE'));
  await expect(
    f.service.update(
      'intake',
      { action: 'REQUEST_SUPPLIER', expectedVersion: 0, note: '' },
      f.actor,
    ),
  ).rejects.toThrow('REQUEST_NOT_ACCESSIBLE');
  expect(detail).toHaveBeenCalledWith('intake', ['branch'], true);
  expect(f.mail.prepare).not.toHaveBeenCalled();
  expect(f.transaction).not.toHaveBeenCalled();
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

it('wakes only after the outbox transaction has committed', async () => {
  const f = fixture();
  let commit!: () => void;
  const committed = new Promise<void>((resolve) => {
    commit = resolve;
  });
  let inserted!: () => void;
  const stored = new Promise<void>((resolve) => {
    inserted = resolve;
  });
  f.transaction.mockImplementation(async (cb) => {
    const result = await cb(f.tx);
    inserted();
    await committed;
    return result;
  });
  const update = f.service.update(
    'intake',
    { action: 'REQUEST_SUPPLIER', expectedVersion: 0, note: '' },
    f.actor,
  );
  await stored;
  expect(f.mail.enqueue).toHaveBeenCalledOnce();
  expect(f.mail.wake).not.toHaveBeenCalled();
  commit();
  await update;
  expect(f.mail.wake).toHaveBeenCalledOnce();
});
it('never wakes when commit fails after the outbox insert', async () => {
  const f = fixture();
  f.transaction.mockImplementation(async (cb) => {
    await cb(f.tx);
    throw new Error('COMMIT_FAILED');
  });
  await expect(
    f.service.update(
      'intake',
      { action: 'REQUEST_SUPPLIER', expectedVersion: 0, note: '' },
      f.actor,
    ),
  ).rejects.toThrow('COMMIT_FAILED');
  expect(f.mail.enqueue).toHaveBeenCalledOnce();
  expect(f.mail.wake).not.toHaveBeenCalled();
});
it('does not wake the mail dispatcher for a normal saved form', async () => {
  const f = fixture();
  await f.service.update(
    'intake',
    { action: 'NOTE', expectedVersion: 0, note: 'saved only' },
    f.actor,
  );
  expect(f.mail.wake).not.toHaveBeenCalled();
});
