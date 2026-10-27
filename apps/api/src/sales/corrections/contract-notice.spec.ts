import { ForbiddenException } from '@nestjs/common';
import { expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import { ContractNoticeService } from './contract-notice.service';
const actor = {
  userId: 'operator',
  branchIds: ['branch'],
  permissions: ['reservations.read', 'reservations.documents.manage'],
} as AuthenticatedActor;
function setup() {
  const row = {
    id: 'contract',
    branchId: 'branch',
    version: 3,
    status: 'CONFIRMED',
    services: [
      {
        id: 'a',
        metadata: {
          contractNotice: 'Original 120123',
          reservationNote: 'Private',
          legacyServicePartiesV2: 'KEEP',
        },
      },
      { id: 'b', metadata: { contractNotice: 'Old duplicate', keep: true } },
      { id: 'c', metadata: { other: 'KEEP' } },
    ],
  };
  const tx = {
    salesContract: {
      findFirst: vi.fn(
        async ({ where }: { where: { branchId: { in: string[] } } }) =>
          where.branchId.in.includes(row.branchId) ? row : null,
      ),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    salesContractService: { update: vi.fn() },
    salesContractAuditEvent: { create: vi.fn() },
  };
  const db = {
    client: {
      ...tx,
      $transaction: vi.fn(async (run: (value: typeof tx) => unknown) =>
        run(tx),
      ),
    },
  };
  return { row, tx, db, service: new ContractNoticeService(db as never) };
}
it('reads the printed notice and limits a read-only actor without exposing internal notes', async () => {
  const t = setup();
  await expect(
    t.service.read('contract', {
      ...actor,
      permissions: ['reservations.read'],
    }),
  ).resolves.toEqual({ version: 3, notice: 'Original 120123', canEdit: false });
});
it.each(['', ' Edited 120123\nSecond line '])(
  'saves or clears the authoritative Notice, preserving unrelated service data (%s)',
  async (notice) => {
    const t = setup();
    await expect(
      t.service.save('contract', { expectedVersion: 3, notice }, actor),
    ).resolves.toEqual({ version: 4, notice: notice.trim(), canEdit: true });
    expect(t.tx.salesContract.updateMany).toHaveBeenCalledWith({
      where: { id: 'contract', version: 3, status: 'CONFIRMED' },
      data: { version: { increment: 1 } },
    });
    expect(t.tx.salesContractService.update.mock.calls.map(([x]) => x)).toEqual(
      [
        {
          where: { id: 'a' },
          data: {
            metadata: {
              ...t.row.services[0]!.metadata,
              contractNotice: notice.trim(),
            },
          },
        },
        {
          where: { id: 'b' },
          data: {
            metadata: {
              ...t.row.services[1]!.metadata,
              contractNotice: notice.trim(),
            },
          },
        },
      ],
    );
    expect(t.tx.salesContractAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorUserId: actor.userId,
          afterSnapshot: {
            correction: 'NOTICE',
            version: 4,
            notice: notice.trim(),
          },
        }),
      }),
    );
    expect(t.db.client.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' },
    );
  },
);
it('adds a first Notice to a contract without one', async () => {
  const t = setup();
  t.row.services = [{ id: 'c', metadata: { other: 'KEEP' } }] as never;
  await t.service.save(
    'contract',
    { expectedVersion: 3, notice: 'New' },
    actor,
  );
  expect(t.tx.salesContractService.update).toHaveBeenCalledWith({
    where: { id: 'c' },
    data: { metadata: { other: 'KEEP', contractNotice: 'New' } },
  });
});
it.each([
  { permissions: [] },
  { permissions: ['reservations.read'] },
  { permissions: ['reservations.documents.manage'] },
] as { permissions: AuthenticatedActor['permissions'] }[])(
  'rejects unauthorized writes (%j)',
  async ({ permissions }) => {
    const t = setup();
    await expect(
      t.service.save(
        'contract',
        { expectedVersion: 3, notice: 'Bad' },
        { ...actor, permissions },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(t.db.client.$transaction).not.toHaveBeenCalled();
  },
);
it('rejects an outside branch on reads and writes before any mutation', async () => {
  const t = setup();
  const outside = { ...actor, branchIds: ['other'] };
  await expect(t.service.read('contract', outside)).rejects.toThrow();
  await expect(
    t.service.save('contract', { expectedVersion: 3, notice: 'Bad' }, outside),
  ).rejects.toThrow();
  expect(t.tx.salesContract.updateMany).not.toHaveBeenCalled();
});
it.each([
  null,
  { expectedVersion: 3, notice: 12 },
  { expectedVersion: 0, notice: 'x' },
  { expectedVersion: 3, notice: 'x', prices: [] },
  { expectedVersion: 3, notice: 'x'.repeat(5001) },
])('rejects malformed or unrelated fields (%j)', async (raw) => {
  const t = setup();
  await expect(t.service.save('contract', raw, actor)).rejects.toThrow();
  expect(t.db.client.$transaction).not.toHaveBeenCalled();
});
it.each(['CANCELLED', 'DRAFT', 'PENDING_CONFIRMATION'])(
  'does not edit closed or unconfirmed contracts (%s)',
  async (status) => {
    const t = setup();
    t.row.status = status;
    await expect(t.service.read('contract', actor)).resolves.toMatchObject({
      canEdit: false,
    });
    await expect(
      t.service.save('contract', { expectedVersion: 3, notice: 'Bad' }, actor),
    ).rejects.toThrow();
    expect(t.tx.salesContract.updateMany).not.toHaveBeenCalled();
  },
);
it('rejects stale versions and CAS loss without note/audit writes', async () => {
  const t = setup();
  await expect(
    t.service.save('contract', { expectedVersion: 2, notice: 'Bad' }, actor),
  ).rejects.toThrow();
  t.tx.salesContract.updateMany.mockResolvedValue({ count: 0 });
  await expect(
    t.service.save('contract', { expectedVersion: 3, notice: 'Bad' }, actor),
  ).rejects.toThrow();
  expect(t.tx.salesContractService.update).not.toHaveBeenCalled();
  expect(t.tx.salesContractAuditEvent.create).not.toHaveBeenCalled();
});
