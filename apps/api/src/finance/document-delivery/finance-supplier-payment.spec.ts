import { financialEventStore } from '../../../test/financial-event-store';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@nora/database';
import { describe, expect, it, vi } from 'vitest';

import { FinanceDeliveryService } from './finance-delivery.module';

function fixture(amount = '100', currencyCode = 'IRR') {
  const createdAt = new Date('2026-09-13T12:00:00.000Z');
  const tx = {
    financeExchangeOffice: {
      findFirst: vi.fn().mockResolvedValue({
        id: '50000000-0000-4000-8000-000000000002',
        title: 'Exchange',
        balances: [{ id: 'balance' }],
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    financeExchangeBalance: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: vi
        .fn()
        .mockResolvedValue({ id: 'balance', amount: new Prisma.Decimal('60') }),
    },
    financeExchangeMovement: { create: vi.fn().mockResolvedValue({}) },
    financeAccountingEvent: financialEventStore(),
    $queryRaw: vi.fn().mockResolvedValue([]),
    reservationServicePurchase: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'purchase-1',
        intakeId: 'intake-1',
        amount: new Prisma.Decimal(amount),
        currencyCode,
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
    service: new FinanceDeliveryService(
      database as never,
      {} as never,
      {
        supplier: vi.fn(async (id: string) => ({
          id,
          label: 'Paying supplier',
          version: 1,
        })),
      } as never,
    ),
  };
}

describe('Finance supplier payment', () => {
  it('pays a foreign debt from a rial bank account and captures the actual IRR cash event', async () => {
    const { service, tx } = fixture('100', 'EUR');
    const result = await service.updateSupplierPayment(
      'intake-1',
      'purchase-1',
      {
        expectedVersion: 0,
        status: 'PAID',
        accountId: 'account-1',
        paymentMethodId: 'method-1',
        paidAmount: '40',
        exchangeRateToIrr: '800000',
        transferAt: '2026-09-13T12:00:00.000Z',
        reason: '',
      },
      'finance-user',
      ['branch-a'],
    );
    expect(result).toMatchObject({
      accountId: 'account-1',
      paidAmount: '40',
      remainingAmount: '60',
      rialEquivalent: '32000000',
    });
    expect(
      tx.financeSupplierPaymentRevision.create.mock.calls[0]![0].data.paidAmount.toString(),
    ).toBe('40');
    expect(tx.financeAccountingEvent.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            kind: 'RESERVATION_PAYMENT',
            amount: '32000000.0000',
            currency: 'IRR',
            settlementAccountId: 'account-1',
          }),
        ],
      }),
    );
    expect(
      tx.financeSettlementAccount.findFirst.mock.calls[0]![0].where
        .currencyCode,
    ).toEqual({ in: ['EUR', 'IRR'] });
  });
  it('records a non-IRR installment against its paying supplier without an account', async () => {
    const { service, tx } = fixture('100', 'TRY');
    const payingSupplierId = '50000000-0000-4000-8000-000000000001';
    const result = await service.updateSupplierPayment(
      'intake-1',
      'purchase-1',
      {
        expectedVersion: 0,
        status: 'PAID',
        payingSupplierId,
        paymentMethodId: 'method-1',
        paidAmount: '40',
        exchangeRateToIrr: '2000',
        transferAt: '2026-09-13T12:00:00.000Z',
        reason: '',
      },
      'finance-user',
      ['branch-a'],
    );
    expect(result).toMatchObject({
      accountId: null,
      accountTitle: 'Paying supplier',
      remainingAmount: '60',
    });
    expect(tx.financeSettlementAccount.findFirst).not.toHaveBeenCalled();
    expect(tx.financeSupplierPaymentRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountId: null,
          payingSupplierId,
          payingSupplierName: 'Paying supplier',
        }),
      }),
    );
  });
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

describe('broker purchase gate', () => {
  it('requires hotel and transfer payment while leaving ticket purchase to ticket management', async () => {
    const snapshot = {
      serviceSelections: [
        { clientKey: 'flight', kind: 'FLIGHT', titleSnapshot: 'بلیط' },
        { clientKey: 'hotel', kind: 'HOTEL', titleSnapshot: 'هتل' },
        { clientKey: 'transfer', kind: 'TRANSFER', titleSnapshot: 'ترانسفر' },
      ],
    };
    const database = {
      client: {
        reservationIntake: {
          findUnique: vi
            .fn()
            .mockResolvedValue({ snapshot, servicePurchases: [] }),
        },
      },
    };
    const service = new FinanceDeliveryService(database as never, {} as never);
    const gate = await service.supplierPurchaseGate('intake-1');
    expect(gate.requiredServiceCount).toBe(2);
    expect(gate.missingServiceTitles).toEqual(['هتل', 'ترانسفر']);
    expect(gate.missingServiceTitles).not.toContain('بلیط');
  });
});

it('links the reservation payment debit to its revision in the same transaction', async () => {
  const { service, tx } = fixture('100', 'EUR');
  const result = await service.updateSupplierPayment(
    'intake-1',
    'purchase-1',
    {
      expectedVersion: 0,
      status: 'PAID',
      exchangeOfficeId: '50000000-0000-4000-8000-000000000002',
      paymentMethodId: 'method-1',
      paidAmount: '40',
      exchangeRateToIrr: '800000',
      transferAt: '2026-09-13T12:00:00.000Z',
      reason: '',
    },
    'finance-user',
    ['branch-a'],
  );
  expect(result).toMatchObject({
    id: 'revision-1',
    accountTitle: 'Exchange',
    remainingAmount: '60',
  });
  expect(tx.financeExchangeBalance.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        currencyCode: 'EUR',
        amount: { gte: new Prisma.Decimal(40) },
      }),
    }),
  );
  expect(tx.financeExchangeMovement.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      supplierPaymentId: 'revision-1',
      delta: new Prisma.Decimal(-40),
    }),
  });
  expect(tx.financeSettlementAccount.findFirst).not.toHaveBeenCalled();
});
