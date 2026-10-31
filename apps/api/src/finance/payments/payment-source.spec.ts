import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@nora/database';
import type { MasterProcurementDirectory } from '../../master-data/master-procurement-directory';
import { paymentSource } from './payment-source';
const supplierId = '50000000-0000-4000-8000-000000000001';

function setup() {
  const findFirst = vi.fn(async () => ({ id: 'account' }));
  const supplier = vi.fn(async () => ({
    id: 'supplier',
    label: 'Supplier',
    version: 1,
  }));
  return {
    tx: {
      financeSettlementAccount: { findFirst },
    } as unknown as Prisma.TransactionClient,
    directory: { supplier } as unknown as MasterProcurementDirectory,
    findFirst,
    supplier,
  };
}
describe('Finance payment source', () => {
  it.each(['USD', 'EUR', 'TRY', 'AED', 'IRR'])(
    'uses an active same-currency branch account for account-only %s operations',
    async (currencyCode) => {
      const { tx, directory, findFirst, supplier } = setup();
      await expect(
        paymentSource(
          tx,
          directory,
          { accountId: 'account' },
          currencyCode,
          'branch',
          'ACCOUNT_ONLY',
        ),
      ).resolves.toMatchObject({
        account: { id: 'account' },
        payingSupplierId: null,
      });
      expect(findFirst).toHaveBeenCalledWith({
        where: {
          id: 'account',
          branchId: 'branch',
          currencyCode,
          isActive: true,
        },
      });
      expect(supplier).not.toHaveBeenCalled();
    },
  );
  it.each([
    {},
    { payingSupplierId: supplierId },
    { accountId: 'account', payingSupplierId: supplierId },
  ])(
    'rejects missing or supplier-based sources for account-only operations',
    async (input) => {
      const { tx, directory } = setup();
      await expect(
        paymentSource(tx, directory, input, 'USD', 'branch', 'ACCOUNT_ONLY'),
      ).rejects.toThrow();
    },
  );
  it('rejects an inactive, wrong-branch or wrong-currency account', async () => {
    const { tx, directory, findFirst } = setup();
    findFirst.mockResolvedValueOnce(null as never);
    await expect(
      paymentSource(
        tx,
        directory,
        { accountId: 'account' },
        'USD',
        'branch',
        'ACCOUNT_ONLY',
      ),
    ).rejects.toThrow();
  });
  it.each(['USD', 'EUR', 'TRY', 'AED'])(
    'requires a supplier and never queries accounts for %s',
    async (currency) => {
      const { tx, directory, findFirst, supplier } = setup();
      await expect(
        paymentSource(
          tx,
          directory,
          { payingSupplierId: supplierId },
          currency,
          'branch',
        ),
      ).resolves.toEqual({
        account: null,
        payingSupplierId: 'supplier',
        payingSupplierName: 'Supplier',
      });
      expect(findFirst).not.toHaveBeenCalled();
      expect(supplier).toHaveBeenCalledWith(supplierId, tx);
    },
  );
  it('keeps IRR accounts branch-scoped', async () => {
    const { tx, directory, findFirst, supplier } = setup();
    await paymentSource(
      tx,
      directory,
      { accountId: 'account' },
      'IRR',
      'branch',
    );
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        id: 'account',
        branchId: 'branch',
        currencyCode: 'IRR',
        isActive: true,
      },
    });
    expect(supplier).not.toHaveBeenCalled();
  });
  it.each([
    ['USD', {}],
    ['USD', { accountId: 'account' }],
    ['USD', { accountId: 'account', payingSupplierId: 'supplier' }],
    ['IRR', { payingSupplierId: 'supplier' }],
    ['IRR', { accountId: 'account', payingSupplierId: 'supplier' }],
  ])(
    'rejects missing or conflicting source for %s',
    async (currency, input) => {
      const { tx, directory } = setup();
      await expect(
        paymentSource(tx, directory, input, currency, 'branch'),
      ).rejects.toThrow();
    },
  );
  it('propagates inactive or missing supplier rejection', async () => {
    const { tx, directory, supplier } = setup();
    supplier.mockRejectedValueOnce(new Error('inactive'));
    await expect(
      paymentSource(
        tx,
        directory,
        { payingSupplierId: supplierId },
        'USD',
        'branch',
      ),
    ).rejects.toThrow('inactive');
  });
});
