import { describe, it, expect } from 'vitest';
import type { HrEmployeeDto, HrRecordDto } from '@nora/contracts';
import {
  buildRadanReport,
  emptyRadanFilters,
  radanReports,
} from './radan-reports';
const employee = {
  id: 'e',
  name: 'Synthetic Person',
  personnelCode: '100',
  kind: 'رسمی',
  unit: 'unit',
  position: 'position',
  status: 'فعال',
} as HrEmployeeDto;
const record = {
  id: 'a',
  section: 'time',
  tab: 'attendance',
  employeeId: 'e',
  status: 'حاضر',
  columns: ['کارمند', 'تاریخ کارکرد'],
  values: ['Synthetic Person', '2026-10-20'],
  data: {
    workedMinutes: 480,
    lateMinutes: 10,
    earlyMinutes: null,
    overtimeMinutes: 0,
  },
  effectiveAt: '2026-10-20',
} as HrRecordDto;
describe('Radan report projection from authorized canonical HR data', () => {
  it('inventories 21 observed report forms', () =>
    expect(radanReports).toHaveLength(21));
  it('does not fabricate unknown measures as zero in rows or totals', () => {
    expect(
      buildRadanReport('daily', [record], [employee], emptyRadanFilters)
        .rows[0],
    ).toContain('—');
    expect(
      buildRadanReport('total', [record], [employee], emptyRadanFilters)
        .rows[0],
    ).toEqual(['Synthetic Person', '8:00', '0:10', '—', '0:00']);
  });
  it('filters group membership by stable employee IDs rather than names', () => {
    const other = { ...employee, id: 'other' };
    const member = {
      ...record,
      id: 'm',
      section: 'organization',
      tab: 'groupMembers',
      parentId: 'g',
      status: 'فعال',
    };
    const result = buildRadanReport(
      'people',
      [],
      [employee, other],
      { ...emptyRadanFilters, groupId: 'g' },
      [member],
    );
    expect(result.recordIds).toEqual(['e']);
  });
  it('uses contract records, not employment type, for contract filtering', () => {
    const contract = {
      ...record,
      section: 'contracts',
      tab: 'active',
      columns: ['نوع قرارداد'],
      values: ['رسمی'],
      status: 'فعال',
    };
    expect(
      buildRadanReport(
        'people',
        [],
        [employee],
        { ...emptyRadanFilters, contractType: 'رسمی' },
        [contract],
      ).rows,
    ).toHaveLength(1);
    expect(
      buildRadanReport(
        'people',
        [],
        [employee],
        { ...emptyRadanFilters, contractType: 'رسمی' },
        [],
      ).rows,
    ).toHaveLength(0);
  });
  it('keeps only exceptions in incomplete reports and emits canonical minute units', () => {
    expect(
      buildRadanReport('incomplete', [record], [employee], emptyRadanFilters)
        .rows,
    ).toHaveLength(0);
    expect(
      buildRadanReport('dailyMinutes', [record], [employee], emptyRadanFilters)
        .rows[0]![2],
    ).toBe('480');
  });
});

it('aggregates actual overtime requests without silently ignoring the total switch', () => {
  const overtime = { ...record, tab: 'overtime', data: { minutes: 30 } };
  expect(
    buildRadanReport(
      'overtime',
      [overtime, { ...overtime, id: 'b', data: { minutes: 60 } }],
      [employee],
      { ...emptyRadanFilters, aggregate: true },
    ).rows[0],
  ).toEqual(['Synthetic Person', '1:30']);
});

it('keeps aggregate row identity stable for selection across refreshed reports', () => {
  expect(
    buildRadanReport('total', [record], [employee], emptyRadanFilters)
      .recordIds,
  ).toEqual(['e']);
  const overtime = { ...record, tab: 'overtime', data: { minutes: 30 } };
  expect(
    buildRadanReport('overtime', [overtime], [employee], {
      ...emptyRadanFilters,
      aggregate: true,
    }).recordIds,
  ).toEqual(['e']);
});

it('does not reuse one branch daily duration for another branch without settings', () => {
  const a = { ...employee, branchId: 'branch-a' },
    b = { ...employee, id: 'b', name: 'Other', branchId: 'branch-b' };
  const config = {
    ...record,
    section: 'time',
    tab: 'calculationSettings',
    branchId: 'branch-a',
    status: 'فعال',
    values: ['تنظیمات', '[]', 'خیر', '480'],
  };
  const result = buildRadanReport(
    'total',
    [record, { ...record, id: 'second', employeeId: 'b' }],
    [a, b],
    { ...emptyRadanFilters, unit: 'days' },
    [config],
  );
  expect(result.rows.every((row) => row[1] === '—')).toBe(true);
  expect(
    buildRadanReport(
      'total',
      [record],
      [a],
      { ...emptyRadanFilters, unit: 'days' },
      [config],
    ).rows[0]![1],
  ).toBe('1');
});
