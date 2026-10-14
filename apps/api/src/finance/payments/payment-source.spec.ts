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
