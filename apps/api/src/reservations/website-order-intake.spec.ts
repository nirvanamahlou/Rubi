import { expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { ReservationsPublicService } from './reservations-public.service';

it('keeps the original website intake ID and operations when Sales delivers or retries the formal handoff', async () => {
  const snapshot = {
    contractId: 'contract',
    requestId: 'confirmed-request',
    contractVersion: 3,
  };
  const branchId = 'branch';
  const row = {
    id: 'existing-reservation',
    requestId: 'contract',
    contractVersion: 1,
    status: 'QUEUED',
    fingerprint: '',
    purchaseVersion: 2,
  };
  const intake = {
    updateMany: vi.fn(async ({ where, data }) => {
      if (
        row.requestId === where.requestId &&
        where.contractId === snapshot.contractId &&
        where.branchId === branchId
      ) {
        Object.assign(row, data);
        return { count: 1 };
      }
      return { count: 0 };
    }),
    upsert: vi.fn(async ({ where }) => {
      expect(where.requestId).toBe(row.requestId);
      return row;
    }),
  };
  const service = new ReservationsPublicService({
    client: { reservationIntake: intake },
  } as never);
  for (let attempt = 0; attempt < 2; attempt++) {
    const receipt = await service.receive(snapshot as never, branchId);
    expect(receipt.id).toBe('existing-reservation');
  }
  expect(row).toMatchObject({
    contractVersion: 3,
    purchaseVersion: 2,
    fingerprint: createHash('sha256')
      .update(JSON.stringify({ branchId, snapshot }))
      .digest('hex'),
  });
});
