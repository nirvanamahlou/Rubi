import { describe, expect, it } from 'vitest';

import {
  reportingOperationConfigurationHref,
  type ReportingFilterUrlState,
} from './navigation';

const configuredReport: ReportingFilterUrlState = {
  reportCode: 'sales_by_service_route',
  fromDate: '2026-09-01',
  toDate: '2026-09-10',
  legalEntity: 'NIYAYESH_SEIR_SAHAR',
  currency: 'USD',
  filterValues: { مسیر: 'تهران ← شیراز' },
};

describe('report operation configuration navigation', () => {
  it.each(['saved', 'shared', 'recent'] as const)(
    'keeps the %s view active while opening its configured report',
    (view) => {
      const href = reportingOperationConfigurationHref(
        view,
        'all',
        configuredReport,
      );

      expect(href).toContain(`view=${view}`);
      expect(href).toContain('report=sales_by_service_route');
      expect(href).not.toContain('view=catalog');
    },
  );

  it('preserves the favorites subview for saved reports', () => {
    expect(
      reportingOperationConfigurationHref(
        'saved',
        'favorites',
        configuredReport,
      ),
    ).toContain('view=saved&filter=favorites&report=sales_by_service_route');
  });
});
