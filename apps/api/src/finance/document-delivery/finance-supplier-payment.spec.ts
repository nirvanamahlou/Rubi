import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@nora/database';
import { describe, expect, it, vi } from 'vitest';

import { FinanceDeliveryService } from './finance-delivery.module';

function fixture(amount = '100') {
  const createdAt = new Date('2026-09-13T12:00:00.000Z');
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    reservationServicePurchase: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'purchase-1',
        intakeId: 'intake-1',
        amount: new Prisma.Decimal(amount),
        currencyCode: 'IRR',
        intake: { branchId: 'branch-a' },
      }),
    },
    financeSettlementAccount: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'account-1',
        title: 'حساب جاری شرکت',
        bankId: 'bank-1',
        currencyCode: 'IRR',
      }),
    },
    masterPaymentMethod: {
      findFirst: vi.fn().mockResolvedValue({ id: 'method-1', name: 'حواله' }),
    },
    financeSupplierPaymentRevision: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ id: 'revision-1', createdAt, ...data }),
        ),
    },
  };
  const database = {
    client: { $transaction: vi.fn((run) => run(tx)) },
  };
  return {
    tx,
    service: new FinanceDeliveryService(database as never, {} as never),
  };
}

describe('Finance supplier payment', () => {
  it('records a partial payment and returns the computed remainder', async () => {
    const { service, tx } = fixture();
    const result = await service.updateSupplierPayment(
      'intake-1',
      'purchase-1',
      {
        expectedVersion: 0,
        status: 'PAID',
        accountId: 'account-1',
        paymentMethodId: 'method-1',
        paidAmount: '40',
        exchangeRateToIrr: '1',
        transferAt: '2026-09-13T12:00:00.000Z',
        reason: '',
      },
      'finance-user',
      ['branch-a'],
    );
    expect(result).toMatchObject({
      status: 'PARTIALLY_PAID',
      paidAmount: '40',
      remainingAmount: '60',
      accountId: 'account-1',
      paymentMethodId: 'method-1',
    });
    expect(tx.financeSupplierPaymentRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PARTIALLY_PAID',
          cumulativePaid: expect.objectContaining({}),
          remainingAmount: expect.objectContaining({}),
        }),
      }),
    );
  });

  it('rejects a payment larger than the purchase remainder', async () => {
    const { service } = fixture();
    await expect(
      service.updateSupplierPayment(
        'intake-1',
        'purchase-1',
        {
          expectedVersion: 0,
          status: 'PAID',
          accountId: 'account-1',
          paymentMethodId: 'method-1',
          paidAmount: '101',
          exchangeRateToIrr: '1',
          transferAt: '2026-09-13T12:00:00.000Z',
          reason: '',
        },
        'finance-user',
        ['branch-a'],
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
