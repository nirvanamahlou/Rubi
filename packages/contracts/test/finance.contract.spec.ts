import { describe, expect, it } from 'vitest';

import {
  FINANCE_CONTRACT_VERSION,
  FINANCE_FOUNDATION_NOTICE,
  financeConsumerCompatibility,
  financeCurrencyCodes,
  financeEndpointProposals,
  financePermissionMatrix,
  hasFinancePermission,
  normalizeFinanceListQuery,
  type FinanceInboundEventV1,
  type PurchaseInvoiceApprovedV1,
} from '../src';

describe('finance public proposal contract', () => {
  it('is explicitly decision gated and versioned', () => {
    expect(FINANCE_CONTRACT_VERSION).toBe('finance.v1-proposal');
    expect(FINANCE_FOUNDATION_NOTICE).toContain('no persistence');
    expect(FINANCE_FOUNDATION_NOTICE).toContain(
      'no financial release execution',
    );
    expect(financeCurrencyCodes).toEqual(['IRR', 'USD', 'EUR', 'TRY', 'AED']);
  });

  it('publishes only finance-owned endpoint proposals', () => {
    expect(Object.values(financeEndpointProposals)).toEqual(
      expect.arrayContaining([
        '/api/v1/finance/journals',
        '/api/v1/finance/checks',
        '/api/v1/finance/financial-releases',
      ]),
    );
    expect(
      Object.values(financeEndpointProposals).every((path) =>
        path.startsWith('/api/v1/finance'),
      ),
    ).toBe(true);
  });

  it('keeps permissions deny-by-default and separates maker/checker capabilities', () => {
    expect(hasFinancePermission([], 'payment.create')).toBe(false);
    expect(
      hasFinancePermission(['finance.payment.create'], 'payment.create'),
    ).toBe(true);
    expect(
      hasFinancePermission(['finance.payment.create'], 'payment.approve'),
    ).toBe(false);
    expect(financePermissionMatrix['financial_release.override']).toBe(
      'finance.financial_release.override',
    );
  });

  it('normalizes bounded list queries', () => {
    expect(
      normalizeFinanceListQuery({
        search: `  ${'x'.repeat(120)}  `,
        page: -2,
        pageSize: 1000,
        branchReference: ' ',
        sortDirection: 'asc',
      }),
    ).toMatchObject({
      search: 'x'.repeat(100),
      page: 1,
      pageSize: 100,
      branchReference: null,
      currencyCode: 'ALL',
      sortDirection: 'asc',
    });
  });

  it('models net purchase components without a mutable margin field', () => {
    const event: PurchaseInvoiceApprovedV1 = {
      eventId: 'event-preview-001',
      eventType: 'purchase.invoice_approved',
      version: 1,
      occurredAt: '2026-08-24T10:00:00.000Z',
      traceId: 'trace-preview-001',
      actorReference: 'actor-preview-001',
      aggregateId: 'purchase-invoice-preview-001',
      payload: {
        purchaseInvoiceReference: {
          module: 'PURCHASES',
          type: 'PURCHASE_INVOICE',
          id: 'purchase-invoice-preview-001',
        },
        supplierReference: {
          module: 'MASTER_DATA',
          type: 'ORGANIZATION',
          id: 'supplier-preview-001',
        },
        contractReference: {
          module: 'SALES',
          type: 'SALES_CONTRACT',
          id: 'contract-preview-001',
          version: 2,
        },
        serviceReference: {
          module: 'SALES',
          type: 'CONTRACT_SERVICE',
          id: 'service-preview-001',
        },
        grossPurchase: { amount: '100000000', currencyCode: 'IRR' },
        supplierDiscount: { amount: '5000000', currencyCode: 'IRR' },
        feesAndCosts: { amount: '2000000', currencyCode: 'IRR' },
        netPurchase: { amount: '97000000', currencyCode: 'IRR' },
      },
    };
    const inbound: FinanceInboundEventV1 = event;
    expect(inbound.payload).not.toHaveProperty('margin');
    expect(inbound.payload.netPurchase.amount).toBe('97000000');
  });

  it('documents public-contract-only consumer boundaries', () => {
    expect(financeConsumerCompatibility.sales).toContain(
      'no Sales table access',
    );
    expect(financeConsumerCompatibility.reservations).toContain(
      'no Reservation table access',
    );
    expect(financeConsumerCompatibility.purchases).toContain(
      'no Procurement table access',
    );
    expect(financeConsumerCompatibility.customers).toContain('no customer PII');
    expect(financeConsumerCompatibility.hr).toContain('no attendance');
  });
});
