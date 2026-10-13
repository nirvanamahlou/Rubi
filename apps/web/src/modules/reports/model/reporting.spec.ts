import { describe, expect, it } from 'vitest';

import {
  filterReportCatalog,
  reportCatalog,
  reportPriorityGroups,
  reportPriorityFor,
  searchReports,
} from './reporting';

describe('reporting catalog', () => {
  it('publishes the approved operational demo reports', () => {
    expect(
      reportCatalog
        .filter((report) => report.availability === 'READY')
        .map((report) => report.code),
    ).toHaveLength(12);
    expect(
      reportCatalog.find((report) => report.code === 'due_checks')
        ?.availability,
    ).toBe('PENDING_CONNECTION');
    expect(
      reportCatalog.find((report) => report.code === 'cash_position'),
    ).toEqual(
      expect.objectContaining({
        displayCode: 'RPT-037',
        availability: 'PENDING_CONNECTION',
        approvedView: 'reporting_cash_position_facts_v1',
      }),
    );
  });

  it('finds reports by Persian title but not by internal or display code', () => {
    expect(searchReports('سود قرارداد').map((report) => report.code)).toContain(
      'contract_service_profit',
    );
    expect(searchReports('paid_not_issued')).toHaveLength(0);
    expect(searchReports('RPT-002')).toHaveLength(0);
    expect(searchReports('002')).toHaveLength(0);
    expect(searchReports('ظرفیت پرواز').map((report) => report.code)).toEqual([
      'ticket_capacity',
    ]);
    expect(searchReports('RPT-028')).toHaveLength(0);
    expect(searchReports('تعهد سفر').map((report) => report.code)).toContain(
      'future_travel_commitments',
    );
    expect(searchReports('RPT-036')).toHaveLength(0);
  });

  it('assigns a unique stable public code to every report', () => {
    const displayCodes = reportCatalog.map((report) => report.displayCode);
    expect(new Set(displayCodes).size).toBe(reportCatalog.length);
    expect(displayCodes).toEqual(
      reportCatalog.map(
        (_, index) => `RPT-${String(index + 1).padStart(3, '0')}`,
      ),
    );
  });

  it('filters the catalog by category, connection and priority', () => {
    expect(
      filterReportCatalog({ availability: 'READY', priority: 'P0' }).map(
        (report) => report.code,
      ),
    ).toEqual(
      reportPriorityGroups
        .find((group) => group.id === 'P0')
        ?.reportCodes.filter(
          (code) =>
            reportCatalog.find((report) => report.code === code)
              ?.availability === 'READY',
        ),
    );
    expect(
      filterReportCatalog({
        availability: 'PENDING_CONNECTION',
        category: 'مارکتینگ',
        priority: 'P2',
      }).map((report) => report.code),
    ).toEqual(['marketing_performance']);
    expect(reportPriorityFor('due_checks')).toBe('P0');
    expect(reportPriorityFor('tickets_manifest')).toBe('P1');
    expect(reportPriorityFor('export_audit')).toBe('P2');
    expect(filterReportCatalog({ query: 'گزارش ناموجود' })).toEqual([]);
  });

  it('covers every requested management report with approved-view metadata', () => {
    const expected = [
      'sales_by_organization',
      'sales_by_service_route',
      'purchase_by_supplier',
      'contract_service_profit',
      'receivables_payables',
      'account_balances',
      'due_checks',
      'cash_position',
      'payments_refunds',
      'paid_not_issued',
      'reservation_errors',
      'cancellations_refunds',
      'marketing_performance',
      'customer_service_sla',
      'hr_performance',
      'tickets_manifest',
    ];
    expect(reportCatalog.map((report) => report.code)).toEqual(
      expect.arrayContaining(expected),
    );
    expect(
      reportCatalog.every(
        (report) =>
          (report.approvedView.startsWith('reporting_') ||
            report.approvedView.startsWith('reporting.') ||
            report.approvedView === 'sales.reporting.organization.v2') &&
          report.outputs.join(',') === 'XLSX,PDF,CSV,API',
      ),
    ).toBe(true);
  });

  it('keeps feature-backed cards pending until their own producers publish a projection', () => {
    const featureBackedReports = [
      'sales_contract_pipeline',
      'agency_contract_risk',
      'ticket_capacity',
      'supplier_payment_queue',
      'reservation_delivery_readiness',
      'lead_pipeline',
      'customer_satisfaction',
      'customer_consent_coverage',
      'document_compliance',
      'hr_record_expiry',
      'workbench_due_actions',
      'hotel_rate_comparison',
      'future_travel_commitments',
      'customer_payment_aging',
      'reservation_cycle_time',
      'manifest_finance_exclusions',
      'customer_portfolio_growth',
    ];

    expect(
      featureBackedReports.map((code) =>
        reportCatalog.find((report) => report.code === code),
      ),
    ).toEqual(
      featureBackedReports.map((code) =>
        expect.objectContaining({
          code,
          availability: 'PENDING_CONNECTION',
          approvedView: expect.stringMatching(/^reporting_/),
        }),
      ),
    );
  });

  it('assigns every report to exactly one internal priority group', () => {
    const assignedCodes = reportPriorityGroups.flatMap(
      (group) => group.reportCodes,
    );
    expect(assignedCodes).toHaveLength(reportCatalog.length);
    expect(new Set(assignedCodes).size).toBe(reportCatalog.length);
    expect(assignedCodes).toEqual(
      expect.arrayContaining(reportCatalog.map((report) => report.code)),
    );
  });

  it('keeps master-data governance out of the managerial report catalog', () => {
    expect(
      reportCatalog.some((report) => report.category === 'اطلاعات پایه'),
    ).toBe(false);
    expect(
      reportCatalog.some(
        (report) => report.code === 'exchange_rate_governance',
      ),
    ).toBe(false);
  });

  it('uses decision-oriented question titles for every report card', () => {
    expect(reportCatalog.every((report) => report.title.endsWith('؟'))).toBe(
      true,
    );
    expect(
      reportCatalog.find((report) => report.code === 'sales_by_organization')
        ?.title,
    ).toBe('هر کارشناس چه تعداد قرارداد و چه مبلغ فروشی ثبت کرده است؟');
    expect(
      reportCatalog.find((report) => report.code === 'cancellations_refunds')
        ?.title,
    ).not.toContain('Refund');
  });

  it('uses formal Persian business-output descriptions on every catalog card', () => {
    expect(
      reportCatalog.find((report) => report.code === 'due_checks')?.description,
    ).toBe(
      'فهرست رسمی چک‌های دریافتنی و پرداختنی فعال، سررسیدشده و معوق در بازه انتخابی.',
    );
    expect(
      reportCatalog.every((report) => report.description.endsWith('.')),
    ).toBe(true);
    expect(
      reportCatalog.map((report) => report.description).join(' '),
    ).not.toMatch(
      /\b(Scope|Provider|Posted|Refund|threshold|redacted|Manifest|Filter Snapshot|Artifact)\b/,
    );
  });
});
