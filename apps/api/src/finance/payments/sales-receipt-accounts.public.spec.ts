import 'reflect-metadata';
import { BankAccountCrypto } from '../bank-accounts/bank-account.crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  SalesReceiptAccountsPublic,
  salesReceiptAccounts,
  salesReceiptDestination,
} from './sales-receipt-accounts.public';

describe('Sales receipt destination public boundary', () => {
  it('lists only active contract-branch accounts with no ciphertext exposed', async () => {
    const findMany = vi.fn(async () => []);
    await salesReceiptAccounts(
      { financeSettlementAccount: { findMany } } as never,
      'branch',
      {} as never,
      'payer',
    );
    expect(findMany).toHaveBeenCalledWith({
      where: { branchId: 'branch', isActive: true },
      select: {
        id: true,
        title: true,
        currencyCode: true,
        kind: true,
        maskedIdentifier: true,
        branchId: true,
        bankId: true,
        bankIdentifiers: true,
      },
      orderBy: [{ title: 'asc' }, { id: 'asc' }],
    });
  });
  it('decrypts company payment instructions and audits the payer without returning ciphertext', async () => {
    const crypto = new BankAccountCrypto({
      getOrThrow: () => Buffer.alloc(32, 7).toString('base64'),
    } as never);
    const identifiers = {
      accountNumber: '123456789012',
      cardNumber: '6037990000000000',
      iban: 'IR000000000000000000000001',
    };
    const create = vi.fn(async () => ({}));
    const rows = await salesReceiptAccounts(
      {
        financeSettlementAccount: {
          findMany: vi.fn(async () => [
            {
              id: 'account',
              bankId: 'bank',
              branchId: 'branch',
              title: 'Company account',
              kind: 'BANK',
              currencyCode: 'IRR',
              maskedIdentifier: '••001',
              bankIdentifiers: crypto.seal(
                identifiers,
                'finance:company-bank:v1:branch:bank:account',
              ),
            },
          ]),
        },
        financeBankAccountAudit: { create },
      } as never,
      'branch',
      crypto,
      'payer',
    );
    expect(rows[0]).toMatchObject({ title: 'Company account', ...identifiers });
    expect(rows[0]).not.toHaveProperty('bankIdentifiers');
    expect(rows[0]).not.toHaveProperty('branchId');
    expect(create).toHaveBeenCalledWith({
      data: {
        accountId: 'account',
        actorUserId: 'payer',
        action: 'REVEAL',
        metadata: { source: 'sales-payment-destination', branchId: 'branch' },
      },
    });
  });
  it('resolves canonical bank names through the owner directory in the same transaction', async () => {
    const tx = {
      financeSettlementAccount: {
        findMany: vi.fn(async () => [
          {
            id: 'account',
            bankId: 'bank',
            branchId: 'branch',
            title: 'Company',
            kind: 'BANK',
            currencyCode: 'IRR',
            maskedIdentifier: null,
            bankIdentifiers: null,
          },
        ]),
      },
    };
    const directory = {
      bankNames: vi.fn(async () => [{ id: 'bank', name: 'Example Bank' }]),
    };
    const service = new SalesReceiptAccountsPublic(
      {
        client: { $transaction: (run: (tx: unknown) => unknown) => run(tx) },
      } as never,
      {
        open: () => ({ accountNumber: null, cardNumber: null, iban: null }),
      } as never,
      directory as never,
    );
    const rows = await service.list('branch', 'payer');
    expect(directory.bankNames).toHaveBeenCalledWith(['bank'], tx);
    expect(rows[0]).toMatchObject({
      bankName: 'Example Bank',
      title: 'Company',
    });
    expect(rows[0]).not.toHaveProperty('bankId');
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
