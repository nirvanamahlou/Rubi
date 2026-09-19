import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
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

const emptyTicketPurchases = () => ({
  listFinanceTicketPurchases: vi.fn().mockResolvedValue([]),
  listFinanceInvoiceSources: vi.fn().mockResolvedValue([]),
  listFinanceCorrections: vi.fn().mockResolvedValue([]),
});
const emptyTicketCosts = () => ({
  queueStates: vi.fn().mockResolvedValue(new Map()),
});

describe('FinanceInboxService', () => {
  it('combines persisted Sales, HR, Procurement and Reservations sources', async () => {
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
    const procurement = {
      listFinanceTicketPurchases: vi.fn().mockResolvedValue([
        {
          id: 'ticket-purchase-1',
          branchId: 'branch-a',
          catalogProductReference: 'ticket-product-1',
          title: 'پرواز تهران به آنتالیا',
          serviceDate: '2026-09-15',
          supplierDisplaySnapshot: 'ایران ایرتور',
          amount: '420000000',
          currencyCode: 'IRR',
          requestVersion: 1,
          createdAt: '2026-09-12T11:00:00.000Z',
        },
      ]),
      listFinanceInvoiceSources: vi.fn().mockResolvedValue([
        {
          contract: 'procurement.finance-source.v1',
          sourceId: 'invoice-1',
          sourceVersion: 2,
          orderId: 'order-1',
          orderVersion: 3,
          supplier: {
            id: 'supplier-1',
            version: 1,
            label: 'تأمین‌کننده آزمایشی',
          },
          amount: '35000000',
          currencyCode: 'IRR',
          branchId: 'branch-a',
          dueAt: '2026-09-16T00:00:00.000Z',
          handoffCreatedAt: '2026-09-12T12:00:00.000Z',
        },
      ]),
      listFinanceCorrections: vi.fn().mockResolvedValue([]),
    };
    const result = await new FinanceInboxService(
      sales,
      hr,
      reservations,
      {} as never,
      {
        client: {
          financeProcurementInvoiceRevision: {
            findMany: vi.fn().mockResolvedValue([]),
          },
        },
      } as never,
      procurement as never,
      emptyTicketCosts() as never,
    ).list(actor);
    expect(result.items.map(({ source }) => source)).toEqual([
      'SALES',
      'HR',
      'PURCHASES',
      'PURCHASES',
      'RESERVATIONS',
    ]);
    expect(
      result.items.every(({ origin }) => origin === 'PERSISTED_SOURCE'),
    ).toBe(true);
    expect(result.sources).toMatchObject([
      { source: 'SALES', connection: 'CONNECTED', itemCount: 1 },
      { source: 'HR', connection: 'CONNECTED', itemCount: 1 },
      { source: 'RESERVATIONS', connection: 'CONNECTED', itemCount: 1 },
      { source: 'PURCHASES', connection: 'CONNECTED', itemCount: 2 },
    ]);
    expect(hr.list).toHaveBeenCalledWith({ target: 'finance', page: 1 }, actor);
    expect(reservations.list).toHaveBeenCalledWith(['branch-a']);
    expect(procurement.listFinanceTicketPurchases).toHaveBeenCalledWith([
      'branch-a',
    ]);
    expect(procurement.listFinanceInvoiceSources).toHaveBeenCalledWith([
      'branch-a',
    ]);
    expect(
      result.items.find(
        ({ sourceReference }) => sourceReference === 'invoice-1',
      ),
    ).toMatchObject({
      source: 'PURCHASES',
      status: 'UNDER_REVIEW',
      origin: 'PERSISTED_SOURCE',
      amount: { amount: '35000000', currencyCode: 'IRR' },
      branchReference: 'branch-a',
    });
    expect(result.items[0]).toMatchObject({
      sourceContextReference: 'contract-1',
      settlement: null,
    });
    expect(
      result.items.find(({ source }) => source === 'RESERVATIONS'),
    ).toMatchObject({
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
      emptyTicketPurchases() as never,
      emptyTicketCosts() as never,
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
      emptyTicketPurchases() as never,
      emptyTicketCosts() as never,
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
          currencyCode: 'IRR',
        },
      ]),
      applyFinancePaymentConfirmed: vi.fn().mockResolvedValue('confirmed'),
    };
    const accountLookup = vi.fn().mockResolvedValue({ id: 'account-1' });
    const service = new FinanceInboxService(
      sales as never,
      {} as never,
      {} as never,
      {} as never,
      {
        client: {
          financeSettlementAccount: { findFirst: accountLookup },
        },
      } as never,
      emptyTicketPurchases() as never,
      emptyTicketCosts() as never,
    );
    await expect(
      service.decideReceipt(
        'payment-1',
        {
          version: 1,
          contractId: 'contract-1',
          action: 'APPROVE',
          accountId: 'account-1',
        },
        actor,
      ),
    ).resolves.toEqual({ status: 'RECEIPT_CONFIRMED' });
    expect(accountLookup).toHaveBeenCalledWith({
      where: {
        id: 'account-1',
        branchId: 'branch-a',
        currencyCode: 'IRR',
        isActive: true,
      },
      select: { id: true },
    });
    expect(sales.applyFinancePaymentConfirmed).toHaveBeenCalledWith(
      expect.objectContaining({
        contractId: 'contract-1',
        paymentId: 'payment-1',
        receiptAccountId: 'account-1',
        reviewedByUserId: 'finance-user',
      }),
    );
  });

  it('rejects a Sales receipt approval without a destination account', async () => {
    const sales = {
      financeInbox: vi.fn().mockResolvedValue([
        {
          paymentId: 'payment-1',
          contractId: 'contract-1',
          branchId: 'branch-a',
          currencyCode: 'IRR',
        },
      ]),
      applyFinancePaymentConfirmed: vi.fn(),
    };
    const service = new FinanceInboxService(
      sales as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      emptyTicketPurchases() as never,
      emptyTicketCosts() as never,
    );
    await expect(
      service.decideReceipt(
        'payment-1',
        { version: 1, contractId: 'contract-1', action: 'APPROVE' },
        actor,
      ),
    ).rejects.toThrow();
    expect(sales.applyFinancePaymentConfirmed).not.toHaveBeenCalled();
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
      emptyTicketPurchases() as never,
      emptyTicketCosts() as never,
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
      emptyTicketPurchases() as never,
      emptyTicketCosts() as never,
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

  it('projects accepted Procurement returns and sends the Finance decision back through the public contract', async () => {
    const procurement = {
      listFinanceTicketPurchases: vi.fn().mockResolvedValue([]),
      listFinanceInvoiceSources: vi.fn().mockResolvedValue([]),
      listFinanceCorrections: vi.fn().mockResolvedValue([
        {
          contract: 'procurement.finance-correction.v1',
          eventId: '3d91b012-767b-4f75-99e1-a302993a4fe1',
          sourceVersion: 1,
          returnId: '9be58f20-83b4-466d-816b-a665bfbfa580',
          requestId: '825120cd-4850-44b8-af2a-8a19d872807b',
          orderId: '42ae689c-0f6b-49bd-b48d-7aeab48219d0',
          receiptItemId: '6f9dfc35-419f-43e9-9788-20643fbf7fc5',
          branchId: 'branch-a',
          quantity: '2',
          reason: 'کالای پذیرفته‌شده مرجوع شد',
          returnedAt: '2026-09-16T08:00:00.000Z',
        },
      ]),
      applyFinanceCorrectionResult: vi.fn().mockResolvedValue('applied'),
    };
    const service = new FinanceInboxService(
      { financeInbox: vi.fn().mockResolvedValue([]) } as never,
      { list: vi.fn().mockResolvedValue({ items: [] }) } as never,
      { list: vi.fn().mockResolvedValue([]) } as never,
      {} as never,
      {} as never,
      procurement as never,
      emptyTicketCosts() as never,
    );

    const inbox = await service.list(actor);
    expect(inbox.items).toEqual([
      expect.objectContaining({
        source: 'PURCHASES',
        kind: 'RETURN_CORRECTION',
        sourceReference: '3d91b012-767b-4f75-99e1-a302993a4fe1',
        status: 'UNDER_REVIEW',
      }),
    ]);

    await expect(
      service.decideProcurementCorrection(
        '3d91b012-767b-4f75-99e1-a302993a4fe1',
        { version: 1, expectedVersion: 1, action: 'APPROVE' },
        actor,
      ),
    ).resolves.toEqual({ status: 'APPROVED' });
    expect(procurement.applyFinanceCorrectionResult).toHaveBeenCalledWith(
      expect.objectContaining({
        contract: 'finance.procurement-correction-result.v1',
        status: 'APPROVED',
        actorUserId: 'finance-user',
      }),
      ['branch-a'],
    );
  });
});
