import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from './finance-inbox-api';
import { bankAccountsApi } from './bank-accounts-api';
vi.mock('./finance-inbox-api', () => ({ apiRequest: vi.fn() }));
describe('Finance company account client', () => {
  it('deletes with the captured account version and bank scope', async () => {
    await bankAccountsApi.remove('bank-id', 'account-id', 3);
    expect(apiRequest).toHaveBeenCalledWith(
      '/finance/banks/bank-id/accounts/account-id',
      { method: 'DELETE', body: JSON.stringify({ expectedVersion: 3 }) },
    );
  });
  beforeEach(() => vi.mocked(apiRequest).mockReset().mockResolvedValue({}));
  it('lists bank-scoped pages and owner-provided options', async () => {
    await bankAccountsApi.list('bank-id', 2);
    expect(apiRequest).toHaveBeenLastCalledWith(
      '/finance/banks/bank-id/accounts?page=2',
    );
    await bankAccountsApi.options('bank-id');
    expect(apiRequest).toHaveBeenLastCalledWith(
      '/finance/banks/bank-id/accounts/options',
    );
  });
  it('uses an explicit POST for audited full-number reads, never a cached GET', async () => {
    await bankAccountsApi.details('bank-id', 'account-id');
    expect(apiRequest).toHaveBeenCalledWith(
      '/finance/banks/bank-id/accounts/account-id/details',
      { method: 'POST' },
    );
  });
  it('preserves leading-zero strings and an immutable retry identity on creation', async () => {
    const input = {
      requestId: 'retry-id',
      branchId: 'branch-id',
      title: 'Synthetic',
      currencyCode: 'IRR',
      isActive: true,
      accountNumber: '00012345',
    };
    await bankAccountsApi.create('bank-id', input);
    expect(apiRequest).toHaveBeenCalledWith('/finance/banks/bank-id/accounts', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  });
  it('sends captured version and explicit clears on edit', async () => {
    const input = {
      title: 'Synthetic',
      currencyCode: 'IRR',
      isActive: false,
      expectedVersion: 4,
      cardNumber: null,
      accountNumber: '00012345',
    };
    await bankAccountsApi.update('bank-id', 'account-id', input);
    expect(apiRequest).toHaveBeenCalledWith(
      '/finance/banks/bank-id/accounts/account-id',
      { method: 'PATCH', body: JSON.stringify(input) },
    );
  });
});
