import type {
  B2bCrmConnectionsV1,
  B2bCrmSalesContractV1,
} from '@rubi/contracts';
import { describe, expect, it } from 'vitest';

import {
  connectedFinanceRows,
  connectedOutstanding,
  filterConnectedFinanceRows,
  overduePaymentCount,
} from './organization-crm-connections';

function contract(
  id: string,
  balances: B2bCrmSalesContractV1['balances'] = [
    {
      amount: '125.2500',
      currencyCode: 'USD',
      confirmedPaid: '25.2500',
      pendingFinance: '0',
      outstanding: '100.0000',
    },
  ],
): B2bCrmSalesContractV1 {
  return {
    id,
    contractNumber: `SC-${id}`,
    customerId: 'customer-1',
    customerNameSnapshot: 'سازمان آزمایشی',
    status: 'CONFIRMED',
    settlementStatus: 'PARTIALLY_SETTLED',
    reservationStatus: 'ACCEPTED',
    balances,
    updatedAt: '2026-09-11T00:00:00.000Z',
  };
}

function snapshot(): B2bCrmConnectionsV1 {
  return {
    version: 1,
    organizationId: 'organization-1',
    branchId: 'branch-1',
    customers: [],
    contracts: [
      contract('first'),
      contract('second', [
        {
          amount: '2',
          currencyCode: 'USD',
          confirmedPaid: '0.9999',
          pendingFinance: '0',
          outstanding: '1.0001',
        },
        {
          amount: '500000000',
          currencyCode: 'IRR',
          confirmedPaid: '0',
          pendingFinance: '0',
          outstanding: '500000000',
        },
      ]),
    ],
    payments: [
      {
        id: 'payment-1',
        contractId: 'first',
        contractNumber: 'SC-first',
        amount: '25.2500',
        currencyCode: 'USD',
        dueAt: '2026-09-05',
        method: 'BANK_TRANSFER',
        description: 'پیش‌پرداخت',
        paymentReference: 'BANK-10',
        check: null,
        status: 'FINANCE_CONFIRMED',
        createdAt: '2026-09-04T08:00:00.000Z',
      },
      {
        id: 'check-1',
        contractId: 'first',
        contractNumber: 'SC-first',
        amount: '10',
        currencyCode: 'USD',
        dueAt: '2026-09-08',
        method: 'CHECK',
        description: null,
        paymentReference: null,
        check: {
          secureIdentifier: '***1234',
          ownerName: 'شرکت آزمایشی',
          dueDate: '2026-09-09',
        },
        status: 'SCHEDULED',
        createdAt: '2026-09-03T08:00:00.000Z',
      },
    ],
    reservations: [],
    financeExposure: {
      status: 'UNAVAILABLE',
      reason: 'FINANCE_PORT_UNAVAILABLE',
    },
    unavailableSources: { FINANCE: 'در دسترس نیست.' },
    observedAt: '2026-09-12T00:00:00.000Z',
  };
}

describe('connected organization finance projection', () => {
  it('keeps decimal precision and separates receipts from checks', () => {
    const data = snapshot();
    expect(connectedOutstanding(data.contracts)).toEqual([
      { currencyCode: 'IRR', amount: '500000000' },
      { currencyCode: 'USD', amount: '101.0001' },
    ]);
    expect(connectedFinanceRows(data, 'payments').map((row) => row.id)).toEqual(
      ['payment-1'],
    );
    expect(connectedFinanceRows(data, 'checks').map((row) => row.id)).toEqual([
      'check-1',
    ]);
    expect(overduePaymentCount(data.payments, '2026-09-12')).toBe(1);
  });

  it('filters check due dates inclusively and rejects reversed ranges', () => {
    const rows = connectedFinanceRows(snapshot(), 'checks');
    expect(
      filterConnectedFinanceRows(rows, {
        currency: 'USD',
        status: '',
        from: '2026-09-09',
        to: '2026-09-09',
      }).map((row) => row.id),
    ).toEqual(['check-1']);
    expect(
      filterConnectedFinanceRows(rows, {
        currency: '',
        status: '',
        from: '2026-09-10',
        to: '2026-09-09',
      }),
    ).toEqual([]);
  });
});
