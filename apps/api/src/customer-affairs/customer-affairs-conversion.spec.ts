import { describe, expect, it, vi } from 'vitest';
import { CustomerAffairsService } from './customer-affairs.service';
const actor = {
  userId: 'user',
  branchIds: ['branch'],
  permissions: ['customers.create'],
};
const input = {
  firstName: 'نام',
  lastName: 'خانوادگی',
  nationalId: 'not-used-by-mocked-owner',
  expectedVersion: 2,
};
function setup(overrides: Record<string, unknown> = {}) {
  const tx = {
    $queryRaw: vi.fn(),
    customerAffairsLead: {
      findUnique: vi
        .fn()
        .mockResolvedValue({
          id: 'lead',
          branchId: 'branch',
          version: 2,
          stage: 'QUALIFIED',
          customerId: null,
          ...overrides,
        }),
      update: vi.fn(),
    },
    customerAffairsTimeline: { create: vi.fn() },
    customerAffairsAuditEvent: { create: vi.fn() },
  };
  const customers = {
    createPersonWithinTransaction: vi
      .fn()
      .mockResolvedValue({ id: 'customer' }),
  };
  const service = new CustomerAffairsService(
    { transaction: (fn: (tx: unknown) => unknown) => fn(tx) } as never,
    customers as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  vi.spyOn(service, 'getLead').mockResolvedValue({ data: {} } as never);
  return { tx, customers, service };
}
describe('Atomic lead customer conversion', () => {
  it('uses the owning Customers public service in the same transaction and audits only the reference', async () => {
    const { service, customers, tx } = setup();
    await service.convertLeadCustomer('lead', input, actor as never);
    expect(customers.createPersonWithinTransaction).toHaveBeenCalledWith(
      input,
      actor,
      'branch',
      tx,
    );
    expect(tx.customerAffairsLead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ customerId: 'customer' }),
      }),
    );
    expect(
      JSON.stringify(tx.customerAffairsAuditEvent.create.mock.calls),
    ).not.toContain(input.nationalId);
  });
  it('replays an already linked lead without creating another customer', async () => {
    const { service, customers } = setup({ customerId: 'existing' });
    await service.convertLeadCustomer('lead', input, actor as never);
    expect(customers.createPersonWithinTransaction).not.toHaveBeenCalled();
  });
  it('rejects stale, foreign-branch and terminal leads before creation', async () => {
    for (const change of [
      { version: 3 },
      { branchId: 'foreign' },
      { stage: 'LOST' },
    ]) {
      const { service, customers } = setup(change);
      await expect(
        service.convertLeadCustomer('lead', input, actor as never),
      ).rejects.toThrow();
      expect(customers.createPersonWithinTransaction).not.toHaveBeenCalled();
    }
  });
  it('does not link or audit if the Customers owner rejects creation', async () => {
    const { service, customers, tx } = setup();
    customers.createPersonWithinTransaction.mockRejectedValue(
      new Error('duplicate'),
    );
    await expect(
      service.convertLeadCustomer('lead', input, actor as never),
    ).rejects.toThrow('duplicate');
    expect(tx.customerAffairsLead.update).not.toHaveBeenCalled();
    expect(tx.customerAffairsAuditEvent.create).not.toHaveBeenCalled();
  });
});
