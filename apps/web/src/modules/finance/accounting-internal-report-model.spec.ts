import { describe, expect, it } from 'vitest';
import {
  internalReportQuery,
  sumReportValues,
  internalAccountingReportKind,
} from './accounting-internal-report-model';
describe('internal report query and matrix totals', () => {
  it('uses explicit routes, preserves booleans and normalizes document numbers', () => {
    expect(internalAccountingReportKind('general-ledger/reports/matrix')).toBe(
      'matrix',
    );
    expect(
      internalAccountingReportKind('taxpayer-system/reports/matrix'),
    ).toBeUndefined();
    expect(
      internalReportQuery(
        {
          periodId: 'p',
          rowAxis: 'account',
          columnAxis: 'month',
          noDetails: false,
          fromNumber: '۱۲۳',
          printSeparate: true,
        },
        'matrix',
      ),
    ).toEqual({
      periodId: 'p',
      noDetails: 'false',
      fromNumber: '123',
      axes: 'account,month',
    });
  });
  it('inverts show-inactive into the backend active-only predicate', () => {
    expect(
      internalReportQuery({ includeInactive: true }, 'analysis').activeOnly,
    ).toBe('false');
    expect(
      internalReportQuery({ includeInactive: false }, 'analysis').activeOnly,
    ).toBe('true');
  });
  it('conserves signed amounts, large integers and zero without rounding', () => {
    expect(sumReportValues(['9007199254740993', '0.01', '-0.005'])).toBe(
      '9007199254740993.005',
    );
    expect(sumReportValues(['-1', '1.00'])).toBe('0');
    expect(sumReportValues([])).toBe('0');
    expect(() => sumReportValues(['NaN'])).toThrow();
  });
});
