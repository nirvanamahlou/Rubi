import { describe, expect, it, vi } from 'vitest';
import {
  salesReceiptAccounts,
  salesReceiptDestination,
} from './sales-receipt-accounts.public';

describe('Sales receipt destination public boundary', () => {
  it('lists only active contract-branch accounts without private bank identifiers', async () => {
    const findMany = vi.fn(async () => []);
    await salesReceiptAccounts(
      { financeSettlementAccount: { findMany } } as never,
      'branch',
    );
    expect(findMany).toHaveBeenCalledWith({
      where: { branchId: 'branch', isActive: true },
      select: {
        id: true,
        title: true,
        currencyCode: true,
        kind: true,
        maskedIdentifier: true,
      },
      orderBy: [{ title: 'asc' }, { id: 'asc' }],
    });
  });
  it('retains compatibility for older payment requests', async () => {
    expect(
      await salesReceiptDestination(
        {} as never,
        { currencyCode: 'IRR' },
        'branch',
      ),
    ).toEqual({});
  });
  it('validates exact active account, branch and currency and snapshots only canonical identity', async () => {
    const findFirst = vi.fn(async () => ({
      id: 'account',
      title: 'Company bank',
    }));
    const result = await salesReceiptDestination(
      { financeSettlementAccount: { findFirst } } as never,
      { destinationAccountId: 'account', currencyCode: 'irr' },
      'branch',
    );
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        id: 'account',
        branchId: 'branch',
        currencyCode: 'IRR',
        isActive: true,
      },
      select: { id: true, title: true },
    });
    expect(result).toEqual({
      destinationAccountId: 'account',
      destinationAccountTitle: 'Company bank',
    });
    expect(result).not.toHaveProperty('financeReceiptAccountId');
  });
  it('rejects inactive, foreign-branch or wrong-currency references', async () => {
    await expect(
      salesReceiptDestination(
        {
          financeSettlementAccount: { findFirst: vi.fn(async () => null) },
        } as never,
        { destinationAccountId: 'account', currencyCode: 'USD' },
        'branch',
      ),
    ).rejects.toThrow('حساب مقصد');
  });
});
