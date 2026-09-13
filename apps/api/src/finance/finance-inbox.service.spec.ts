import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedActor } from '@rubi/contracts';
import { describe, expect, it, vi } from 'vitest';

import type { HrConnectionsService } from '../hr/hr-connections.service';
import type { ReservationsPublicService } from '../reservations/reservations-public.service';
import type { SalesService } from '../sales/sales.service';
import { FinanceInboxService } from './finance-inbox.service';

const actor = {
  userId: 'finance-user',
  branchIds: ['branch-a'],
  permissions: ['finance.read', 'hr.connections.finance.receive'],
} as unknown as AuthenticatedActor;

describe('FinanceInboxService', () => {
  it('combines only persisted Sales, HR and Reservations sources', async () => {
    const sales = {
      financeInbox: vi.fn().mockResolvedValue([
        {
          version: 1,
          paymentId: 'payment-1',
          contractId: 'contract-1',
          contractNumber: 'CNT-100',
          customerId: 'customer-1',
          customerNameSnapshot: 'مشتری واقعی',
          branchId: 'branch-a',
          amount: '125000000',
          currencyCode: 'IRR',
          method: 'BANK_TRANSFER',
          description: 'واریز قرارداد',
          paymentReference: 'TRACK-1',
          dueAt: '2026-09-13T08:00:00.000Z',
          createdAt: '2026-09-12T08:00:00.000Z',
          createdByUserId: 'sales-user',
          createdByName: 'کارشناس فروش',
          contractVersion: 3,
        },
      ]),
    } as unknown as SalesService;
    const hr = {
      list: vi.fn().mockResolvedValue({
        items: [
          {
            id: 'hr-1',
            code: 'HR-CON-1',
            branchId: 'branch-a',
            title: 'درخواست پرداخت مساعده',
            message: 'بررسی مبلغ مساعده کارمند',
            employeeLabel: 'کارمند نمونه',
            status: 'SUBMITTED',
            dueAt: '2026-09-14T08:00:00.000Z',
            createdAt: '2026-09-12T09:00:00.000Z',
            version: 2,
          },
        ],
      }),
    } as unknown as HrConnectionsService;
    const reservations = {
      list: vi.fn().mockResolvedValue([
        {
          id: 'intake-1',
          branchId: 'branch-a',
          snapshot: { contractNumber: 'CNT-100' },
          servicePurchases: [
            {
              id: 'purchase-1',
              version: 3,
              serviceTitle: 'بلیط رفت',
              supplierName: 'کارگزار واقعی',
              amount: '85000000',
              currencyCode: 'IRR',
              createdAt: '2026-09-12T10:00:00.000Z',
              finance: {
                version: 0,
                status: 'PENDING',
                paidAmount: '0',
                remainingAmount: '85000000',
              },
            },
          ],
        },
      ]),
    } as unknown as ReservationsPublicService;
    const result = await new FinanceInboxService(
      sales,
      hr,
      reservations,
      {} as never,
      {} as never,
    ).list(actor);
    expect(result.items.map(({ source }) => source)).toEqual([
      'SALES',
      'HR',
      'RESERVATIONS',
    ]);
    expect(
      result.items.every(({ origin }) => origin === 'PERSISTED_SOURCE'),
    ).toBe(true);
    expect(result.sources).toMatchObject([
      { source: 'SALES', connection: 'CONNECTED', itemCount: 1 },
      { source: 'HR', connection: 'CONNECTED', itemCount: 1 },
      { source: 'RESERVATIONS', connection: 'CONNECTED', itemCount: 1 },
      { source: 'PURCHASES', connection: 'NOT_CONNECTED', itemCount: 0 },
    ]);
    expect(hr.list).toHaveBeenCalledWith({ target: 'finance', page: 1 }, actor);
    expect(reservations.list).toHaveBeenCalledWith(['branch-a']);
    expect(result.items[0]).toMatchObject({
      sourceContextReference: 'contract-1',
      settlement: null,
    });
    expect(result.items[2]).toMatchObject({
      sourceContextReference: 'intake-1',
      sourceVersion: 0,
      settlement: { paidAmount: '0', remainingAmount: '85000000' },
    });
  });

  it('isolates a failed producer and never substitutes preview rows', async () => {
    const result = await new FinanceInboxService(
      {
        financeInbox: vi.fn().mockRejectedValue(new Error('offline')),
      } as never,
      { list: vi.fn().mockResolvedValue({ items: [] }) } as never,
      { list: vi.fn().mockResolvedValue([]) } as never,
      {} as never,
      {} as never,
    ).list(actor);
    expect(result.items).toEqual([]);
    expect(result.sources[0]).toMatchObject({
      source: 'SALES',
      connection: 'UNAVAILABLE',
    });
  });

  it('requires Finance read permission before querying producers', async () => {
    const sales = { financeInbox: vi.fn() };
    const service = new FinanceInboxService(
      sales as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(
      service.list({ ...actor, permissions: [] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(sales.financeInbox).not.toHaveBeenCalled();
  });

  it('approves a persisted Sales receipt through the Sales public service', async () => {
    const sales = {
      financeInbox: vi.fn().mockResolvedValue([
        {
          paymentId: 'payment-1',
          contractId: 'contract-1',
          branchId: 'branch-a',
        },
      ]),
      applyFinancePaymentConfirmed: vi.fn().mockResolvedValue('confirmed'),
    };
    const service = new FinanceInboxService(
      sales as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(
      service.decideReceipt(
        'payment-1',
        { version: 1, contractId: 'contract-1', action: 'APPROVE' },
        actor,
      ),
    ).resolves.toEqual({ status: 'RECEIPT_CONFIRMED' });
    expect(sales.applyFinancePaymentConfirmed).toHaveBeenCalledWith(
      expect.objectContaining({
        contractId: 'contract-1',
        paymentId: 'payment-1',
        reviewedByUserId: 'finance-user',
      }),
    );
  });

  it('sends a Sales receipt back for correction with the required reason', async () => {
    const sales = {
      financeInbox: vi.fn().mockResolvedValue([
        {
          paymentId: 'payment-1',
          contractId: 'contract-1',
          branchId: 'branch-a',
        },
      ]),
      applyFinancePaymentCorrection: vi.fn().mockResolvedValue('corrected'),
    };
    const service = new FinanceInboxService(
      sales as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(
      service.decideReceipt(
        'payment-1',
        {
          version: 1,
          contractId: 'contract-1',
          action: 'CORRECTION_REQUIRED',
          reason: 'شماره پیگیری اصلاح شود',
        },
        actor,
      ),
    ).resolves.toEqual({ status: 'CORRECTION_REQUIRED' });
    expect(sales.applyFinancePaymentCorrection).toHaveBeenCalledWith({
      contractId: 'contract-1',
      paymentId: 'payment-1',
      reason: 'شماره پیگیری اصلاح شود',
      reviewedByUserId: 'finance-user',
      branchId: 'branch-a',
    });
  });

  it('forwards supplier payment to the Reservations-owned purchase', async () => {
    const delivery = { updateSupplierPayment: vi.fn().mockResolvedValue({}) };
    const service = new FinanceInboxService(
      {} as never,
      {} as never,
      {} as never,
      delivery as never,
      {} as never,
    );
    const input = {
      expectedVersion: 0,
      status: 'PAID' as const,
      accountId: 'account-1',
      paymentMethodId: 'method-1',
      paidAmount: '50',
      exchangeRateToIrr: '1',
      transferAt: '2026-09-13T12:00:00.000Z',
      reason: '',
    };
    await service.supplierPayment('intake-1', 'purchase-1', input, actor);
    expect(delivery.updateSupplierPayment).toHaveBeenCalledWith(
      'intake-1',
      'purchase-1',
      input,
      'finance-user',
      ['branch-a'],
    );
  });
});
