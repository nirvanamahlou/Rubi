import { revokeObsoleteCustomerRelease } from './financial-release.public';
import { describe, expect, it, vi } from 'vitest';
import { FinanceDeliveryService } from './finance-delivery.module';
const facts = {
  contractId: 'contract',
  branchId: 'branch',
  salesOwnerUserId: 'sales',
  hasConfirmedPayment: false,
  fullySettled: false,
};
const actor = {
  userId: 'reservations',
  permissions: ['reservations.documents.manage'],
};
const command = {
  expectedVersion: 0,
  approved: true,
  basis: 'RESERVATION_PERMISSION' as const,
  reason: 'Supplier has authorized document delivery',
};
function setup(current: unknown = null) {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    financeCustomerDocumentDeliveryRevision: {
      findFirst: vi.fn().mockResolvedValue(current),
      create: vi.fn().mockImplementation(({ data }) => ({
        ...data,
        createdAt: new Date('2026-10-24T00:00:00Z'),
      })),
    },
  };
  const notifications = { createWithinTransaction: vi.fn() };
  const service = new FinanceDeliveryService(
    {
      client: { $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) },
    } as never,
    notifications as never,
  );
  return { tx, notifications, service };
}
describe('reservation delivery override', () => {
  it('allows an authorized reservation maker without payment or settlement and stores the explicit basis/reason/actor', async () => {
    const { service, tx, notifications } = setup();
    const result = await service.updateCustomerContract(
      command,
      facts,
      actor,
      async () => facts,
    );
    expect(result).toMatchObject({
      version: 1,
      approved: true,
      basis: 'RESERVATION_PERMISSION',
      reason: command.reason,
      updatedByUserId: 'reservations',
    });
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(
      tx.financeCustomerDocumentDeliveryRevision.create,
    ).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contractId: 'contract',
        branchId: 'branch',
        basis: 'RESERVATION_PERMISSION',
        actorUserId: 'reservations',
        secondApproverRef: null,
        exceptionExpiresAt: null,
      }),
    });
    expect(notifications.createWithinTransaction).toHaveBeenCalledOnce();
  });
  it.each(
    [[], ['reservations.read'], ['finance.financial_release.approve']].map(
      (permissions) => ({ permissions }),
    ),
  )(
    'does not let another permission set grant reservation authority (%s)',
    async ({ permissions }) => {
      const { service, tx } = setup();
      await expect(
        service.updateCustomerContract(command, facts, {
          ...actor,
          permissions,
        }),
      ).rejects.toThrow('مجوز');
      expect(
        tx.financeCustomerDocumentDeliveryRevision.create,
      ).not.toHaveBeenCalled();
    },
  );
  it.each(['', '  ', 'four', 'x'.repeat(501)])(
    'requires a real bounded reason',
    async (reason) => {
      const { service, tx } = setup();
      await expect(
        service.updateCustomerContract({ ...command, reason }, facts, actor),
      ).rejects.toThrow();
      expect(
        tx.financeCustomerDocumentDeliveryRevision.create,
      ).not.toHaveBeenCalled();
    },
  );
  it('rechecks cancellation after acquiring the lock', async () => {
    const { service, tx } = setup();
    await expect(
      service.updateCustomerContract(command, facts, actor, async () => ({
        ...facts,
        cancelled: true,
      })),
    ).rejects.toThrow('لغوشده');
    expect(
      tx.financeCustomerDocumentDeliveryRevision.create,
    ).not.toHaveBeenCalled();
  });
  it('rejects stale revisions and cannot replace another active authorization', async () => {
    const { service, tx } = setup({
      version: 1,
      approved: true,
      basis: 'FULL_SETTLEMENT',
    });
    await expect(
      service.updateCustomerContract(command, facts, actor),
    ).rejects.toThrow('هم‌زمان');
    await expect(
      service.updateCustomerContract(
        { ...command, expectedVersion: 1 },
        facts,
        actor,
      ),
    ).rejects.toThrow('مسیر دیگری');
    expect(
      tx.financeCustomerDocumentDeliveryRevision.create,
    ).not.toHaveBeenCalled();
  });
  it('lets reservations revoke its own pathway and Finance revoke it too', async () => {
    for (const who of [
      actor,
      { userId: 'finance', permissions: ['finance.financial_release.approve'] },
    ]) {
      const { service } = setup({
        version: 1,
        approved: true,
        basis: 'RESERVATION_PERMISSION',
      });
      expect(
        await service.updateCustomerContract(
          { ...command, expectedVersion: 1, approved: false },
          facts,
          who,
        ),
      ).toMatchObject({ approved: false, version: 2 });
    }
  });
  it('cannot revoke another pathway by substituting a reservation basis', async () => {
    const { service, tx } = setup({
      version: 1,
      approved: false,
      basis: 'FULL_SETTLEMENT',
    });
    await expect(
      service.updateCustomerContract(
        { ...command, expectedVersion: 1, approved: false },
        facts,
        actor,
      ),
    ).rejects.toThrow('فقط');
    expect(
      tx.financeCustomerDocumentDeliveryRevision.create,
    ).not.toHaveBeenCalled();
  });
});

it('retains the explicit reservation override on a balance change but revokes it on cancellation', async () => {
  const { tx } = setup({
    version: 3,
    approved: true,
    basis: 'RESERVATION_PERMISSION',
  });
  await revokeObsoleteCustomerRelease(
    tx as never,
    { ...facts, cancelled: false },
    'actor',
  );
  expect(
    tx.financeCustomerDocumentDeliveryRevision.create,
  ).not.toHaveBeenCalled();
  await revokeObsoleteCustomerRelease(
    tx as never,
    { ...facts, cancelled: true },
    'actor',
  );
  expect(
    tx.financeCustomerDocumentDeliveryRevision.create,
  ).toHaveBeenCalledWith({
    data: expect.objectContaining({
      version: 4,
      approved: false,
      basis: 'RESERVATION_PERMISSION',
      actorUserId: 'actor',
    }),
  });
});
