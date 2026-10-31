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

it('unions selected groups and contracts but intersects them with selected canonical employees', () => {
  const other = { ...employee, id: 'other', name: employee.name };
  const member = {
    ...record,
    section: 'organization',
    tab: 'groupMembers',
    parentId: 'g',
    status: 'فعال',
  };
  const contract = {
    ...record,
    section: 'contracts',
    tab: 'active',
    columns: ['نوع قرارداد', 'تاریخ شروع', 'تاریخ پایان'],
    values: ['رسمی', '2026-01-01', '2026-12-31'],
    status: 'فعال',
  };
  const options = {
    ...emptyRadanFilters,
    employeeIds: ['e', 'other'],
    groupIds: ['g', 'h'],
    contractTypes: ['رسمی', 'ساعتی'],
    from: '2026-10-01',
    to: '2026-10-31',
  };
  expect(
    buildRadanReport('people', [], [employee, other], options, [
      member,
      contract,
    ]).recordIds,
  ).toEqual(['e']);
  expect(
    buildRadanReport(
      'people',
      [],
      [employee, other],
      { ...options, groupIds: [] },
      [member, contract],
    ).rows,
  ).toEqual([]);
  expect(
    buildRadanReport(
      'people',
      [],
      [employee, other],
      { ...options, from: '2027-01-01', to: '2027-02-01' },
      [member, contract],
    ).rows,
  ).toEqual([]);
});
it('shows actual measured general coefficients and approved request minutes without inventing unsupported breakdowns', () => {
  const attendance = {
    ...record,
    data: { ...record.data, calculationMetrics: { fridayMinutes: 90 } },
  };
  const leave = {
    ...record,
    id: 'leave',
    section: 'requests',
    tab: 'radanLeave',
    status: 'تأییدشده',
    columns: ['کارمند', 'نوع مرخصی', 'از تاریخ', 'تا تاریخ', 'نوع مدت'],
    values: [
      'Synthetic Person',
      'استحقاقی',
      '2026-10-20',
      '2026-10-20',
      'ساعتی',
    ],
    data: { minutes: 60 },
  };
  const filters = {
    ...emptyRadanFilters,
    coefficients: [
      'کارکرد',
      'مرخصی / ساعتی / استحقاقی',
      'جمعه کاری',
      'نوبت کاری',
    ],
    from: '2026-10-01',
    to: '2026-10-31',
  };
  expect(
    buildRadanReport('general', [attendance, leave], [employee], filters)
      .rows[0],
  ).toEqual(['Synthetic Person', '8:00', '1:00', '1:30', '—']);
  expect(
    buildRadanReport(
      'general',
      [attendance, { ...leave, status: 'پیش‌نویس' }],
      [employee],
      filters,
    ).rows[0]?.[2],
  ).toBe('0:00');
  expect(
    buildRadanReport(
      'general',
      [
        attendance,
        {
          ...leave,
          values: [
            ...leave.values.slice(0, 2),
            '2026-09-30',
            '2026-10-02',
            'روزانه',
          ],
        },
      ],
      [employee],
      { ...filters, coefficients: ['مرخصی / روزانه / استحقاقی'] },
    ).rows[0]?.[1],
  ).toBe('—');
});
it('derives presence from the last actual clocking and separates missing shifts from incomplete clockings', () => {
  const checkin = {
    ...record,
    id: 'entry',
    tab: 'checkins',
    columns: ['کارمند', 'تاریخ تردد', 'ساعت تردد', 'نوع تردد'],
    values: ['Synthetic Person', '2026-10-20', '08:00', 'ورود'],
    data: { startsAt: '2026-10-20T04:30:00.000Z' },
  };
  const checkout = {
    ...checkin,
    id: 'exit',
    values: ['Synthetic Person', '2026-10-20', '17:00', 'خروج'],
    data: { startsAt: '2026-10-20T13:30:00.000Z' },
  };
  expect(
    buildRadanReport('presence', [checkin], [employee], emptyRadanFilters)
      .rows[0]?.[2],
  ).toBe('حاضر');
  expect(
    buildRadanReport(
      'presence',
      [checkout, checkin],
      [employee],
      emptyRadanFilters,
    ).rows[0]?.[2],
  ).toBe('خارج شده');
  expect(
    buildRadanReport('presence', [], [employee], emptyRadanFilters)
      .rows[0]?.[2],
  ).toBe('بدون تردد');
  expect(
    buildRadanReport(
      'incomplete',
      [{ ...record, data: { exceptionCodes: ['شیفت مصوب تعیین نشده'] } }],
      [employee],
      emptyRadanFilters,
    ).rows,
  ).toHaveLength(0);
  expect(
    buildRadanReport(
      'incomplete',
      [{ ...record, data: { exceptionCodes: ['خروج ثبت نشده'] } }],
      [employee],
      emptyRadanFilters,
    ).rows,
  ).toHaveLength(1);
});
it('reports persisted calculation runs and resolves their configured basis by canonical reference', () => {
  const calculated = {
    ...record,
    updatedAt: '2026-10-21T06:00:00.000Z',
    data: {
      ...record.data,
      calculationSettingsId: 'config',
      calculationBasis: 'تردد',
    },
  };
  const config = {
    ...record,
    id: 'config',
    tab: 'calculationSettings',
    values: ['تنظیمات عملیاتی'],
  };
  expect(
    buildRadanReport(
      'calculation',
      [calculated],
      [employee],
      emptyRadanFilters,
      [config],
    ).rows[0],
  ).toEqual([
    'Synthetic Person',
    '2026-10-20',
    '2026-10-21T06:00:00.000Z',
    'تردد',
    'تنظیمات عملیاتی',
    'حاضر',
  ]);
});

it('keeps legacy mission date aliases and unclassified mission breakdowns honest', () => {
  const mission = {
    ...record,
    tab: 'mission',
    status: 'فعال',
    columns: ['کارمند', 'مقصد', 'تاریخ رفت', 'تاریخ برگشت'],
    values: [
      employee.name,
      'Synthetic destination',
      '2026-09-30',
      '2026-10-02',
    ],
    data: { minutes: 120 },
  };
  expect(
    buildRadanReport('mission', [mission], [employee], {
      ...emptyRadanFilters,
      aggregate: true,
      from: '2026-10-01',
      to: '2026-10-31',
    }).rows[0],
  ).toEqual([employee.name, '—']);
  expect(
    buildRadanReport('mission', [mission], [employee], {
      ...emptyRadanFilters,
      aggregate: true,
      from: '2026-09-01',
      to: '2026-10-31',
    }).rows[0],
  ).toEqual([employee.name, '2:00']);
  expect(
    buildRadanReport('general', [mission], [employee], {
      ...emptyRadanFilters,
      coefficients: ['ماموریت / روزانه / درون شهری'],
    }).rows[0],
  ).toEqual([employee.name, '—']);
});

it('uses business dates for report boundaries and compares legacy local clockings with actual UTC clockings', () => {
  const leave = {
    ...record,
    section: 'requests',
    tab: 'radanLeave',
    status: 'تأییدشده',
    columns: ['کارمند', 'نوع مرخصی', 'از تاریخ', 'تا تاریخ', 'نوع مدت'],
    values: [employee.name, 'استحقاقی', '2026-10-01', '2026-10-01', 'ساعتی'],
    data: {
      minutes: 60,
      startsAt: '2026-09-30T21:30:00.000Z',
      endsAt: '2026-09-30T22:30:00.000Z',
    },
  };
  expect(
    buildRadanReport('general', [leave], [employee], {
      ...emptyRadanFilters,
      from: '2026-10-01',
      to: '2026-10-01',
      coefficients: ['مرخصی'],
    }).rows[0],
  ).toEqual([employee.name, '1:00']);
  const legacy = {
    ...record,
    id: 'legacy',
    tab: 'checkins',
    columns: ['کارمند', 'تاریخ تردد', 'ساعت تردد', 'نوع تردد'],
    values: [employee.name, '2026-10-20', '09:00', 'خروج'],
    data: {},
  };
  const current = {
    ...legacy,
    id: 'current',
    values: [employee.name, '2026-10-20', '10:00', 'ورود'],
    data: { startsAt: '2026-10-20T06:30:00.000Z' },
  };
  expect(
    buildRadanReport(
      'presence',
      [legacy, current],
      [employee],
      emptyRadanFilters,
    ).rows[0]?.[2],
  ).toBe('حاضر');
});
