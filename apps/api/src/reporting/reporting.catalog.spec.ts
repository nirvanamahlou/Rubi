import { describe, expect, it } from 'vitest';

import { REPORTING_CATALOG_V1 } from './reporting.catalog';

describe('REPORTING_CATALOG_V1', () => {
  it('publishes native sources and keeps demo-only or unreleased producers closed', () => {
    expect(REPORTING_CATALOG_V1).toHaveLength(37);
    expect(new Set(REPORTING_CATALOG_V1.map((item) => item.code)).size).toBe(
      REPORTING_CATALOG_V1.length,
    );
    expect(REPORTING_CATALOG_V1).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'sales_by_organization',
          approvedView: 'sales.reporting.contract-currency.v1',
          version: 4,
        }),
        expect.objectContaining({
          code: 'sales_by_service_route',
          approvedView: 'sales.reporting.contract-currency.v1',
        }),
        expect.objectContaining({
          code: 'lead_to_order_conversion',
          producerStatus: 'PENDING_CONNECTION',
        }),
        expect.objectContaining({
          code: 'due_checks',
          approvedView: 'reporting_check_facts_v1',
          producerStatus: 'PENDING_CONNECTION',
        }),
        expect.objectContaining({
          code: 'cash_position',
          approvedView: 'reporting_cash_position_facts_v1',
          producerStatus: 'PENDING_CONNECTION',
          permission: 'reporting.finance.read',
        }),
      ]),
    );
    expect(
      REPORTING_CATALOG_V1.filter(
        (item) => item.producerStatus === 'PENDING_CONNECTION',
      ).every((item) => item.approvedView.startsWith('reporting_')),
    ).toBe(true);
    expect(
      REPORTING_CATALOG_V1.filter((item) => item.producerStatus === 'READY'),
    ).toHaveLength(21);
    expect(
      REPORTING_CATALOG_V1.some(
        (item) =>
          item.producerStatus === 'READY' &&
          item.approvedView === 'reporting.travel.facts.v1',
      ),
    ).toBe(false);
  });

  it('explains every blocked report with concrete missing prerequisites', () => {
    for (const report of REPORTING_CATALOG_V1.filter(
      (r) => r.producerStatus === 'PENDING_CONNECTION',
    )) {
      expect(report.readiness?.reason.length).toBeGreaterThan(15);
      expect(report.readiness?.requirements.length).toBeGreaterThan(0);
    }
  });
  it('keeps money-bearing joins at contract/service/payment/journal grain', () => {
    const financial = REPORTING_CATALOG_V1.filter((item) =>
      [
        'sales_by_organization',
        'sales_by_service_route',
        'contract_service_profit',
        'receivables_payables',
        'account_balances',
        'cash_position',
        'payments_refunds',
      ].includes(item.code),
    );
    expect(financial.map((item) => item.grain)).not.toContain('PASSENGER');
    expect(financial.map((item) => item.grain)).not.toContain('SEGMENT');
  });
});
