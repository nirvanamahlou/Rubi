import { describe, expect, it } from 'vitest';

import { REPORTING_CATALOG_V1 } from './reporting.catalog';

describe('REPORTING_CATALOG_V1', () => {
  it('publishes the approved travel demo suite and keeps unreleased producers closed', () => {
    expect(REPORTING_CATALOG_V1).toHaveLength(20);
    expect(new Set(REPORTING_CATALOG_V1.map((item) => item.code)).size).toBe(
      REPORTING_CATALOG_V1.length,
    );
    expect(REPORTING_CATALOG_V1).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'sales_by_organization',
          approvedView: 'sales.reporting.organization.v2',
          version: 2,
        }),
        expect.objectContaining({
          code: 'sales_by_service_route',
          approvedView: 'reporting.travel.facts.v1',
        }),
        expect.objectContaining({
          code: 'lead_to_order_conversion',
          approvedView: 'reporting.travel.facts.v1',
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
