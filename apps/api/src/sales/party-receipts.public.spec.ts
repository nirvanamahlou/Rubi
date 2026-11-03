import { describe, it, expect, vi } from 'vitest';
import { Prisma } from '@nora/database';
import type { FinancePartyBalanceV1 } from '@nora/contracts';
import {
  partyReceiptPlan,
  partyContractBalance,
  contractParties,
  partyReceiptReplay,
  persistPartyReceipt,
} from './party-receipts.public';
vi.mock('./sales-financial-settlement', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  recalculateSalesSettlement: vi.fn(),
}));
function context(amounts = Array(8).fill('100')): FinancePartyBalanceV1 {
  return {
    party: { branchId: 'branch', payerId: 'payer', name: 'agency' },
    revision: 'revision',
    totals: [],
    contracts: amounts.map((outstanding, i) => ({
      id: `contract-${i}`,
      number: String(i + 1),
      createdAt: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
      balances: [
        { currencyCode: 'USD', outstanding, pendingFinance: '0' },
        { currencyCode: 'IRR', outstanding: '999999', pendingFinance: '0' },
      ],
    })),
  };
}
describe('party receipt FIFO', () => {
  it('settles six oldest contracts and part of the seventh with no currency conversion', () => {
    const result = partyReceiptPlan(context(), 'USD', '650');
    expect(result.map((r) => r.amount)).toEqual([
      '100',
      '100',
      '100',
      '100',
      '100',
      '100',
      '50',
    ]);
    expect(result.map((r) => r.contractNumber)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
    ]);
  });
  it('skips settled/credited contracts and preserves excess as credit on the newest', () => {
    expect(partyReceiptPlan(context(['0', '-10', '30']), 'USD', '50')).toEqual([
      { contractId: 'contract-2', contractNumber: '3', amount: '50' },
    ]);
    expect(partyReceiptPlan(context(['100', '0']), 'USD', '150')).toEqual([
      { contractId: 'contract-0', contractNumber: '1', amount: '100' },
      { contractId: 'contract-1', contractNumber: '2', amount: '50' },
    ]);
  });
  it('preserves four decimals at the database maximum without Number rounding', () => {
    expect(
      partyReceiptPlan(
        context(['9999999999999999.9999', '0.0001']),
        'USD',
        '9999999999999999.9999',
      )[0]!.amount,
    ).toBe('9999999999999999.9999');
    expect(
      partyReceiptPlan(context(['0.0001', '0.0002']), 'USD', '0.0003').map(
        (r) => r.amount,
      ),
    ).toEqual(['0.0001', '0.0002']);
    for (const bad of ['0', '-1', '1.00001', '1e4'])
      expect(() => partyReceiptPlan(context(), 'USD', bad)).toThrow();
  });
  it('does not mutate balances or the receipt input', () => {
    const data = context();
    const saved = structuredClone(data);
    partyReceiptPlan(data, 'USD', '650');
    expect(data).toEqual(saved);
  });
});
describe('Sales party public boundary', () => {
  it('looks up only exact scoped payer contracts in stable oldest-first order and includes refunds/allocations', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: '1',
        version: 1,
        contractNumber: '120001',
        createdAt: new Date('2026-01-01'),
        customerNameSnapshot: 'agency',
        priceComponents: [
          {
            type: 'BASE',
            amount: new Prisma.Decimal(100),
            currencyCode: 'USD',
            title: 'total',
          },
        ],
        payments: [
          {
            amount: new Prisma.Decimal(40),
            currencyCode: 'USD',
            status: 'FINANCE_CONFIRMED',
            refunds: [{ amount: new Prisma.Decimal(10) }],
            allocations: [],
          },
        ],
        receiptAllocations: [],
      },
    ]);
    const data = await partyContractBalance(
      { salesContract: { findMany } } as unknown as Prisma.TransactionClient,
      'branch',
      'payer',
    );
    expect(data.totals).toEqual([
      {
        currencyCode: 'USD',
        total: '100',
        confirmedPaid: '30',
        outstanding: '70',
      },
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          branchId: 'branch',
          payerCustomerId: 'payer',
          status: { notIn: ['CANCELLED', 'DRAFT', 'PENDING_CONFIRMATION'] },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
    );
  });
  it('searches authorized branches without treating the search name as identity', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        payerCustomerId: 'canonical',
        branchId: 'b',
        customerNameSnapshot: 'display',
      },
    ]);
    expect(
      await contractParties(
        { salesContract: { findMany } } as unknown as Prisma.TransactionClient,
        ['b'],
        'display',
      ),
    ).toEqual([{ payerId: 'canonical', branchId: 'b', name: 'display' }]);
    expect(findMany.mock.calls[0]![0].where.branchId).toEqual({ in: ['b'] });
  });
  it('replays the original receipt parts and rejects a reused command with different data', async () => {
    const row = {
      id: 'receipt',
      contractId: 'contract',
      amount: new Prisma.Decimal(25),
      requestFingerprint: 'hash',
      contract: {
        branchId: 'b',
        payerCustomerId: 'p',
        contractNumber: '120001',
      },
    };
    const tx = {
      salesContractPaymentEntry: { findMany: vi.fn().mockResolvedValue([row]) },
    } as unknown as Prisma.TransactionClient;
    const input = {
      operationId: 'operation',
      branchId: 'b',
      payerId: 'p',
    } as never;
    expect(
      (await partyReceiptReplay(tx, input, 'hash'))!.allocations[0]!.amount,
    ).toBe('25');
    await expect(partyReceiptReplay(tx, input, 'changed')).rejects.toThrow(
      'اطلاعات دیگری',
    );
  });
  it('saves exact receipt parts once with one group key and propagates failed financial capture', async () => {
    const create = vi.fn().mockResolvedValue({});
    const audit = vi.fn().mockResolvedValue({});
    const tx = {
      salesContractPaymentEntry: { create },
      salesContractAuditEvent: { create: audit },
    } as unknown as Prisma.TransactionClient;
    const input = {
      operationId: 'op',
      branchId: 'branch',
      payerId: 'payer',
      currencyCode: 'USD',
      amount: '650',
      accountId: 'account',
      reference: 'bank-ref',
      revision: 'revision',
    };
    const capture = vi.fn().mockResolvedValue(undefined);
    const result = await persistPartyReceipt(
      tx,
      input,
      'hash',
      'actor',
      context(),
      'Bank',
      capture,
    );
    expect(result.allocations).toHaveLength(7);
    expect(capture).toHaveBeenCalledTimes(7);
    expect(audit).toHaveBeenCalledTimes(7);
    for (const [arg] of create.mock.calls)
      expect(arg.data).toMatchObject({
        status: 'FINANCE_CONFIRMED',
        idempotencyKey: 'party-receipt:op',
        financeReceiptAccountId: 'account',
        createdByUserId: 'actor',
      });
    await expect(
      persistPartyReceipt(
        tx,
        { ...input, amount: '5' },
        'hash',
        'actor',
        context(),
        'Bank',
        async () => {
          throw new Error('event failed');
        },
      ),
    ).rejects.toThrow('event failed');
  });
});
