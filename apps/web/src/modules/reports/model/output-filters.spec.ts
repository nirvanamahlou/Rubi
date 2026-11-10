import { describe, it, expect } from 'vitest';
import { isOutputFilterKey, reportFilterDisplayLabel } from './output-filters';
import {
  reportingConfigurationState,
  reportingFilterStateHref,
  parseReportingFilterState,
} from './navigation';
describe('report output filter state', () => {
  it('restores saved and execution predicates without leaking them into browser URLs', () => {
    const state = reportingConfigurationState('route_passengers', {
      filters: {
        columnPrimaryDimension: 'مشتری نمونه',
        search: 'عبارت خصوصی',
        currencyCode: 'TRY',
      },
    });
    expect(state.filterValues).toMatchObject({
      columnPrimaryDimension: 'مشتری نمونه',
      search: 'عبارت خصوصی',
    });
    expect(state.currency).toBe('TRY');
    const url = reportingFilterStateHref('/reports?view=catalog', state);
    expect(decodeURIComponent(url)).not.toContain('مشتری نمونه');
    expect(decodeURIComponent(url)).not.toContain('عبارت خصوصی');
    expect(parseReportingFilterState({ currency: 'TRY' }).currency).toBe('TRY');
  });
  it('recognizes bounded output keys and uses readable labels with unchanged values', () => {
    expect(isOutputFilterKey('columnPrimaryDimension')).toBe(true);
    expect(isOutputFilterKey('columnHidden_id')).toBe(false);
    expect(reportFilterDisplayLabel('FLIGHT')).toBe('پرواز');
    expect(reportFilterDisplayLabel('FLIGHT', 'مشتری سازمانی')).toBe('FLIGHT');
    expect(reportFilterDisplayLabel('نام فارسی')).toBe('نام فارسی');
  });
});
