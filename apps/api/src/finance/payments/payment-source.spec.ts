import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@nora/database';
import type { MasterProcurementDirectory } from '../../master-data/master-procurement-directory';
import { paymentSource, purchasePaymentCashMoney } from './payment-source';
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
  it.each(['USD', 'EUR', 'IRR'])(
    'allows an account OR a supplier under the explicit purchase-payment policy for %s',
    async (currency) => {
      const { tx, directory, findFirst, supplier } = setup();
      await expect(
        paymentSource(
          tx,
          directory,
          { accountId: 'account' },
          currency,
          'branch',
          'ACCOUNT_OR_SUPPLIER',
        ),
      ).resolves.toMatchObject({
        account: { id: 'account' },
        payingSupplierId: null,
      });
      expect(findFirst).toHaveBeenCalledWith({
        where: {
          id: 'account',
          branchId: 'branch',
          currencyCode:
            currency === 'IRR' ? currency : { in: [currency, 'IRR'] },
          isActive: true,
        },
      });
      await expect(
        paymentSource(
          tx,
          directory,
          { payingSupplierId: supplierId },
          currency,
          'branch',
          'ACCOUNT_OR_SUPPLIER',
        ),
      ).resolves.toMatchObject({ account: null, payingSupplierId: 'supplier' });
      expect(supplier).toHaveBeenCalledWith(supplierId, tx);
    },
  );
  it('keeps XOR and active same-currency branch-account validation for purchase payments', async () => {
    const { tx, directory, findFirst } = setup();
    await expect(
      paymentSource(
        tx,
        directory,
        { accountId: 'account', payingSupplierId: supplierId },
        'EUR',
        'branch',
        'ACCOUNT_OR_SUPPLIER',
      ),
    ).rejects.toThrow();
    await expect(
      paymentSource(tx, directory, {}, 'EUR', 'branch', 'ACCOUNT_OR_SUPPLIER'),
    ).rejects.toThrow();
    findFirst.mockResolvedValueOnce(null as never);
    await expect(
      paymentSource(
        tx,
        directory,
        { accountId: 'foreign-branch-or-currency' },
        'EUR',
        'branch',
        'ACCOUNT_OR_SUPPLIER',
      ),
    ).rejects.toThrow();
  });
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

describe('actual purchase-payment cash currency', () => {
  it('records the persisted actual IRR withdrawal while leaving the foreign debt amount unchanged', () => {
    expect(
      purchasePaymentCashMoney(
        { currencyCode: 'IRR' },
        'EUR',
        '40',
        '32000000',
      ),
    ).toEqual({ amount: '32000000', currency: 'IRR' });
    expect(
      purchasePaymentCashMoney(
        { currencyCode: 'EUR' },
        'EUR',
        '40',
        '32000000',
      ),
    ).toEqual({ amount: '40', currency: 'EUR' });
    expect(purchasePaymentCashMoney(null, 'EUR', '40', '32000000')).toEqual({
      amount: '40',
      currency: 'EUR',
    });
  });
  it('uses exact Decimal rounding to the persisted four-place precision', () => {
    expect(
      purchasePaymentCashMoney(
        { currencyCode: 'IRR' },
        'USD',
        '1',
        '9007199254740993.12505',
      ).amount,
    ).toBe('9007199254740993.1251');
  });
  it.each([undefined, null, '0', '-1', 'NaN', 'invalid'])(
    'rejects an absent or invalid actual rial amount %s',
    (amount) => {
      expect(() =>
        purchasePaymentCashMoney({ currencyCode: 'IRR' }, 'EUR', '40', amount),
      ).toThrow();
    },
  );
  it('does not invent a conversion to another foreign account currency', () => {
    expect(() =>
      purchasePaymentCashMoney(
        { currencyCode: 'USD' },
        'EUR',
        '40',
        '32000000',
      ),
    ).toThrow();
  });
});
