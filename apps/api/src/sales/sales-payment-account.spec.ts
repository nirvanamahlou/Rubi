import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { SalesService } from './sales.service';
import { SalesRepository } from './sales.repository';
import { validateSalesPayment } from './sales.domain';

const actor = {
  userId: 'owner',
  branchIds: ['branch'],
  permissions: ['sales.contracts.read.own', 'sales.payments.create'],
} as never;
const input = {
  amount: '100',
  currencyCode: 'IRR',
  dueAt: '2026-10-27T00:00:00Z',
  method: 'BANK_TRANSFER' as const,
  version: 1,
  destinationAccountId: '10000000-0000-4000-8000-000000000001',
};
describe('Sales payment destination', () => {
  it('authorizes account choices through the contract rather than general Finance access', async () => {
    const repository = {
      findById: vi.fn(async () => ({
        branchId: 'branch',
        ownerUserId: 'owner',
      })),
      paymentAccounts: vi.fn(async () => []),
    };
    const service = new SalesService(
      repository as never,
      {} as never,
      {} as never,
    );
    expect(await service.paymentAccounts('contract', actor)).toEqual({
      data: [],
    });
    expect(repository.paymentAccounts).toHaveBeenCalledWith('branch');
    repository.findById.mockResolvedValue({
      branchId: 'other',
      ownerUserId: 'other',
    });
    await expect(service.paymentAccounts('contract', actor)).rejects.toThrow();
    expect(repository.paymentAccounts).toHaveBeenCalledTimes(1);
  });
  it('rejects malformed account references while accepting legacy omission', () => {
    expect(() => validateSalesPayment(input)).not.toThrow();
    expect(() =>
      validateSalesPayment({ ...input, destinationAccountId: null }),
    ).not.toThrow();
    expect(() =>
      validateSalesPayment({ ...input, destinationAccountId: 'fake' }),
    ).toThrow('حساب مقصد');
  });
  it('persists the selected destination and audits it without confirming Finance, with replay preserved', async () => {
    const tx = {
      salesContractPaymentEntry: {
        findUnique: vi.fn(async () => null as unknown),
        create: vi.fn(
          async (input: { data: Record<string, unknown> }) => input,
        ),
      },
      salesContract: { updateMany: vi.fn(async () => ({ count: 1 })) },
      financeSettlementAccount: {
        findFirst: vi.fn(async () => ({
          id: input.destinationAccountId,
          title: 'Company',
        })),
      },
      salesContractAuditEvent: { create: vi.fn(async () => ({})) },
    };
    const repository = new SalesRepository({
      client: {
        $transaction: async (run: (tx: unknown) => unknown) => run(tx),
      },
    } as never);
    expect(
      await repository.addPayment('contract', input, 'key', 'fingerprint', {
        userId: 'owner',
        branchId: 'branch',
      }),
    ).toBe('created');
    const data = tx.salesContractPaymentEntry.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(data.data).toMatchObject({
      destinationAccountId: input.destinationAccountId,
      destinationAccountTitle: 'Company',
    });
    expect(data.data).not.toHaveProperty('financeReceiptAccountId');
    expect(data.data.status).not.toBe('FINANCE_CONFIRMED');
    tx.salesContractPaymentEntry.findUnique.mockResolvedValue({
      requestFingerprint: 'fingerprint',
    });
    expect(
      await repository.addPayment('contract', input, 'key', 'fingerprint', {
        userId: 'owner',
        branchId: 'branch',
      }),
    ).toBe('replayed');
    expect(tx.salesContractPaymentEntry.create).toHaveBeenCalledTimes(1);
  });
});
