import { describe, it, expect, vi } from 'vitest';
import type {
  AuthenticatedActor,
  SalesContractPartyCorrectionV1,
} from '@nora/contracts';
import { SalesPartyCorrectionService } from './sales-party-correction.service';
const oldId = '10000000-0000-4000-8000-000000000001',
  newId = '10000000-0000-4000-8000-000000000002';
const actor = {
  userId: 'owner',
  branchIds: ['branch'],
  permissions: ['sales.contracts.update.own', 'finance.receipt.approve'],
} as unknown as AuthenticatedActor;
const input: SalesContractPartyCorrectionV1 = {
  version: 3,
  reason: 'Synthetic correction',
  customerId: newId,
  buyerContact: null,
  transferFinancialHistory: true,
};
function setup(overrides: Record<string, unknown> = {}) {
  const row = {
    id: 'contract',
    customerId: oldId,
    payerCustomerId: oldId,
    branchId: 'branch',
    ownerUserId: 'owner',
    assignedUserId: null,
    status: 'SENT_TO_RESERVATIONS',
    version: 3,
    buyerContact: { encrypted: 'prior' },
    ...overrides,
  };
  const tx = {
    salesContract: {
      findUnique: vi.fn().mockResolvedValue(row),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    salesContractAuditEvent: { create: vi.fn().mockResolvedValue({}) },
    salesReceiptAllocation: { count: vi.fn().mockResolvedValue(0) },
  };
  const database = {
    client: {
      $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    },
  };
  const customers = {
    resolveSnapshot: vi
      .fn()
      .mockResolvedValue({ id: newId, displayName: 'Synthetic agency' }),
  };
  const crypto = { protect: vi.fn().mockReturnValue({ encrypted: 'new' }) };
  const service = new SalesPartyCorrectionService(
    database as never,
    customers as never,
    crypto as never,
  );
  return { service, tx, customers, crypto, database };
}
describe('contract counterparty correction', () => {
  it('rejects a nonowner even if the contract was assigned to them', async () => {
    const s = setup({ ownerUserId: 'other', assignedUserId: actor.userId });
    await expect(s.service.correct('contract', input, actor)).rejects.toThrow(
      'مجوز',
    );
    expect(s.tx.salesContract.updateMany).not.toHaveBeenCalled();
  });
  it('moves buyer and payer together without replacing any contract-owned receipts', async () => {
    const s = setup();
    expect(await s.service.correct('contract', input, actor)).toEqual({
      data: { version: 4 },
    });
    expect(s.tx.salesContract.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'contract', version: 3, status: { not: 'CANCELLED' } },
        data: expect.objectContaining({
          customerId: newId,
          payerCustomerId: newId,
          customerNameSnapshot: 'Synthetic agency',
          version: { increment: 1 },
        }),
      }),
    );
    expect(s.tx.salesContractAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          beforeSnapshot: expect.objectContaining({
            customerId: oldId,
            payerCustomerId: oldId,
          }),
          afterSnapshot: expect.objectContaining({
            customerId: newId,
            payerCustomerId: newId,
            transferFinancialHistory: true,
          }),
        }),
      }),
    );
  });
  it('encrypts contact data in the contract and audit', async () => {
    const s = setup();
    await s.service.correct(
      'contract',
      {
        ...input,
        buyerContact: {
          name: 'Synthetic person',
          phone: '09120000000',
          address: 'Synthetic address',
          postalCode: '1234567890',
        },
      },
      actor,
    );
    expect(s.crypto.protect).toHaveBeenCalled();
    const persisted =
      JSON.stringify(s.tx.salesContract.updateMany.mock.calls) +
      JSON.stringify(s.tx.salesContractAuditEvent.create.mock.calls);
    expect(persisted).not.toContain('09120000000');
    expect(persisted).not.toContain('Synthetic address');
  });
  it.each([
    { branchId: 'other' },
    { ownerUserId: 'other' },
    { status: 'CANCELLED' },
    { version: 4 },
  ])('rejects out-of-scope or stale contracts %j', async (overrides) => {
    const s = setup(overrides);
    await expect(s.service.correct('contract', input, actor)).rejects.toThrow();
    expect(s.tx.salesContract.updateMany).not.toHaveBeenCalled();
  });
  it('requires financial authority for a counterparty transfer', async () => {
    const s = setup();
    await expect(
      s.service.correct('contract', input, {
        ...actor,
        permissions: ['sales.contracts.update.own'],
      }),
    ).rejects.toThrow();
    expect(s.tx.salesContract.updateMany).not.toHaveBeenCalled();
  });
  it('allows contact-only correction without transferring financial ownership', async () => {
    const s = setup();
    await s.service.correct(
      'contract',
      { ...input, customerId: oldId },
      { ...actor, permissions: ['sales.contracts.update.own'] },
    );
    expect(s.tx.salesContractAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          afterSnapshot: expect.objectContaining({
            transferFinancialHistory: false,
          }),
        }),
      }),
    );
  });
  it('rejects a concurrent update without recording a successful audit', async () => {
    const s = setup();
    s.tx.salesContract.updateMany.mockResolvedValue({ count: 0 });
    await expect(s.service.correct('contract', input, actor)).rejects.toThrow();
    expect(s.tx.salesContractAuditEvent.create).not.toHaveBeenCalled();
  });
  it('does not update when the new customer is inaccessible', async () => {
    const s = setup();
    s.customers.resolveSnapshot.mockRejectedValue(new Error('Forbidden'));
    await expect(s.service.correct('contract', input, actor)).rejects.toThrow();
    expect(s.tx.salesContract.updateMany).not.toHaveBeenCalled();
  });
  it('rejects incomplete contact data and unconfirmed transfer', async () => {
    const s = setup();
    await expect(
      s.service.correct(
        'contract',
        { ...input, transferFinancialHistory: false } as never,
        actor,
      ),
    ).rejects.toThrow();
    await expect(
      s.service.correct(
        'contract',
        {
          ...input,
          buyerContact: {
            name: 'Name',
            phone: 'bad',
            address: 'A',
            postalCode: 'bad',
          },
        },
        actor,
      ),
    ).rejects.toThrow();
    expect(s.tx.salesContract.updateMany).not.toHaveBeenCalled();
  });
});

it.each(['', '   '])(
  'accepts an optional empty postal code %j during contact correction',
  async (postalCode) => {
    const s = setup();
    await s.service.correct(
      'contract',
      {
        ...input,
        buyerContact: {
          name: 'Synthetic Person',
          phone: '09120000000',
          address: 'Synthetic Address',
          postalCode,
        },
      },
      actor,
    );
    expect(s.tx.salesContract.updateMany).toHaveBeenCalledOnce();
    expect(s.crypto.protect).toHaveBeenCalled();
  },
);
it('still rejects a supplied invalid postal code', async () => {
  const s = setup();
  await expect(
    s.service.correct(
      'contract',
      {
        ...input,
        buyerContact: {
          name: 'Synthetic Person',
          phone: '09120000000',
          address: 'Synthetic Address',
          postalCode: '123',
        },
      },
      actor,
    ),
  ).rejects.toThrow();
  expect(s.tx.salesContract.updateMany).not.toHaveBeenCalled();
});
