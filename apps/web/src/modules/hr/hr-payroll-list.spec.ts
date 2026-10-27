import { describe, expect, it } from 'vitest';
import type { PayrollWorksheetSummary } from '@nora/contracts';
import {
  defaultPayrollListFilters,
  filterPayrollList,
  payrollWorksheetStatusLabels,
} from './hr-payroll-list';

const branches = [
  { id: 'a', name: 'شعبه مرکزی' },
  { id: 'b', name: 'شعبه کیش' },
];
const summaries: PayrollWorksheetSummary[] = [
  {
    id: 'one',
    branchId: 'a',
    period: '1405-09',
    status: 'DRAFT',
    rowCount: 0,
    version: 1,
    updatedAt: '2026-10-20T10:00:00Z',
  },
  {
    id: 'two',
    branchId: 'b',
    period: '1405-09',
    status: 'APPROVED',
    rowCount: 4,
    version: 2,
    updatedAt: '2026-10-22T10:00:00Z',
  },
  {
    id: 'three',
    branchId: 'b',
    period: '1404-09',
    status: 'APPROVED',
    rowCount: 8,
    version: 2,
    updatedAt: '2026-10-21T10:00:00Z',
  },
  {
    id: 'four',
    branchId: 'b',
    period: '1405-08',
    status: 'DRAFT',
    rowCount: 2,
    version: 1,
    updatedAt: '2026-10-23T10:00:00Z',
  },
];
const select = (overrides: Partial<typeof defaultPayrollListFilters> = {}) =>
  filterPayrollList(summaries, branches, {
    ...defaultPayrollListFilters,
    ...overrides,
  }).map((item) => item.id);

describe('payroll list filters over authorized summaries', () => {
  it('keeps pending and returned Finance decisions distinct from final approval', () => {
    const pending = { ...summaries[0]!, status: 'PENDING_FINANCE' as const };
    const rejected = { ...summaries[1]!, status: 'REJECTED' as const };
    expect(
      filterPayrollList([pending, rejected], branches, {
        ...defaultPayrollListFilters,
        status: 'PENDING_FINANCE',
      }),
    ).toEqual([pending]);
    expect(payrollWorksheetStatusLabels.PENDING_FINANCE).toBe('در انتظار مالی');
    expect(payrollWorksheetStatusLabels.APPROVED).toBe('تأییدشده');
    expect(payrollWorksheetStatusLabels.HR_APPROVED).not.toBe(
      payrollWorksheetStatusLabels.APPROVED,
    );
  });
  it('combines branch, Persian year/month, status and populated rows', () => {
    expect(
      select({
        branchId: 'b',
        year: '۱۴۰۵',
        month: '٩',
        status: 'APPROVED',
        rows: 'populated',
      }),
    ).toEqual(['two']);
    expect(select({ branchId: 'a', status: 'APPROVED' })).toEqual([]);
    expect(select({ rows: 'empty' })).toEqual(['one']);
    expect(select({ rows: 'populated', year: '1405' })).toEqual([
      'two',
      'four',
    ]);
  });
  it('searches localized periods and branch names with Arabic letters and digits', () => {
    expect(select({ query: '  آذر  ۱۴۰۵  كيش ' })).toEqual(['two']);
    expect(select({ query: '١٤٠٥-٠٩' })).toEqual(['one', 'two']);
    expect(select({ query: '۱۴۰۵/۰۹' })).toEqual(['one', 'two']);
    expect(select({ query: 'مرکزی', branchId: 'b' })).toEqual([]);
    expect(select({ query: '1403' })).toEqual([]);
  });
  it('sorts periods, updated time and row counts without mutating source data', () => {
    const original = JSON.stringify(summaries);
    expect(select()).toEqual(['one', 'two', 'four', 'three']);
    expect(select({ sort: 'periodAsc' })).toEqual([
      'three',
      'four',
      'one',
      'two',
    ]);
    expect(select({ sort: 'updatedDesc' })).toEqual([
      'four',
      'two',
      'three',
      'one',
    ]);
    expect(select({ sort: 'rowsDesc' })).toEqual([
      'three',
      'two',
      'four',
      'one',
    ]);
    expect(JSON.stringify(summaries)).toBe(original);
  });
  it('keeps the filtered population when sorting and never invents rows', () => {
    expect(select({ status: 'APPROVED', sort: 'periodAsc' })).toEqual([
      'three',
      'two',
    ]);
    expect(filterPayrollList([], branches, defaultPayrollListFilters)).toEqual(
      [],
    );
    expect(
      filterPayrollList([summaries[0]!], branches, defaultPayrollListFilters),
    ).toEqual([summaries[0]]);
  });
});
