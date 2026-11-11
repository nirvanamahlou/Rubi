import { describe, it, expect } from 'vitest';
import type { HrRecordDto } from '@nora/contracts';
import {
  employeeAttendanceDataset,
  eligibleAttendanceRecords,
  recentAttendanceDataset,
} from './employee-attendance-dataset';
const record = (
  tab: string,
  values: string[],
  employeeId = 'employee-1',
): HrRecordDto => ({
  id: `${tab}-${values.join('-')}`,
  code: 'synthetic',
  branchId: 'branch-1',
  section: 'time',
  tab,
  employeeId,
  parentId: null,
  columns: [],
  values,
  version: 1,
  status: 'حاضر',
  effectiveAt: null,
  appliedAt: null,
  deletedAt: null,
  createdAt: '',
  updatedAt: '',
  data: {},
});
describe('employee attendance table', () => {
  it('shows only the requested columns with explicit employee punches and retained export identities', () => {
    const day = record('attendance', [
      'worker',
      '2026-11-01',
      'shift',
      '8',
      '5',
      '10',
    ]);
    const data = employeeAttendanceDataset([
      day,
      record('checkins', ['worker', '2026-11-01', '09:05', 'ورود']),
      record('checkins', ['worker', '2026-11-01', '16:50', 'خروج']),
      record('checkins', ['other', '2026-11-01', '18:00', 'خروج'], 'other'),
    ]);
    expect(data.columns).toEqual([
      'تاریخ',
      'روز هفته',
      'ورود',
      'خروج',
      'تأخیر',
      'خروج زودهنگام',
      'کسری کار',
      'اضافه‌کاری',
      'مبلغ اضافه‌کاری',
      'جریمه روز',
      'وضعیت',
    ]);
    expect(data.rows[0]?.slice(2)).toEqual([
      '09:05',
      '16:50',
      '5',
      '10',
      '—',
      '—',
      '—',
      '—',
      'حاضر با تأخیر و خروج زودهنگام',
    ]);
    expect(data.recordIds).toEqual([day.id]);
    expect(data.rows[0]?.[1]).toBe('یکشنبه');
  });
  it('does not guess arrival or departure from an indeterminate punch', () => {
    const data = employeeAttendanceDataset([
      record('attendance', ['worker', '2026-11-01', '', '', '0', '0']),
      record('checkins', ['worker', '2026-11-01', '09:00', 'اعلام حضور']),
    ]);
    expect(data.rows[0]?.slice(2, 4)).toEqual(['—', '—']);
  });
});

it('uses calculated server times for device punches and includes attendance status in the time-section columns', () => {
  const day = record('attendance', ['worker', '2026-11-01', '', '', '5', '0']);
  day.data = {
    firstIn: '2026-11-01T05:50:00.000Z',
    lastOut: '2026-11-01T14:00:00.000Z',
    overtimeMinutes: 30,
  };
  const data = recentAttendanceDataset(
    [day],
    [{ id: 'employee-1', name: 'worker', personnelCode: '0012' }],
  );
  expect(data.columns).toEqual([
    'کد پرسنلی',
    'کارمند',
    'تاریخ',
    'روز هفته',
    'ورود',
    'خروج',
    'تأخیر',
    'خروج زودهنگام',
    'کسری کار',
    'اضافه‌کاری',
    'مبلغ اضافه‌کاری',
    'جریمه روز',
    'وضعیت',
  ]);
  expect(data.rows[0]!.slice(4)).toEqual([
    '09:20',
    '17:30',
    '5',
    '0',
    '—',
    '30',
    '—',
    '—',
    'حاضر با تأخیر',
  ]);
});

it('orders employee work dates newest first without changing row identities or input', () => {
  const oldest = record('attendance', [
    'worker',
    '2026-10-31',
    '',
    '',
    '3',
    '0',
  ]);
  const newest = record('attendance', [
    'worker',
    '2026-11-02',
    '',
    '',
    '1',
    '0',
  ]);
  const yesterday = record('attendance', [
    'worker',
    '2026-11-01',
    '',
    '',
    '2',
    '0',
  ]);
  oldest.version = 7;
  const input = [oldest, newest, yesterday];
  const data = employeeAttendanceDataset(input);
  expect(data.recordIds).toEqual([newest.id, yesterday.id, oldest.id]);
  expect(data.versions).toEqual([1, 1, 7]);
  expect(data.rows.map((row) => row[4])).toEqual(['1', '2', '3']);
  expect(input.map((row) => row.id)).toEqual([
    oldest.id,
    newest.id,
    yesterday.id,
  ]);
});

it('keeps server list order and employee/overtime/export identities aligned', () => {
  const first = record('attendance', ['first', '2026-11-01'], 'employee-1');
  const second = record('attendance', ['second', '2026-11-02'], 'employee-2');
  first.data.overtimeMinutes = 12;
  second.data.overtimeMinutes = 34;
  const data = recentAttendanceDataset(
    [first, second],
    [
      { id: 'employee-1', name: 'first', personnelCode: '001' },
      { id: 'employee-2', name: 'second', personnelCode: '002' },
    ],
  );
  expect(data.recordIds).toEqual([first.id, second.id]);
  expect(
    data.rows.map((row) => [
      row[0],
      row[1],
      row[data.columns.indexOf('اضافه‌کاری')],
    ]),
  ).toEqual([
    ['001', 'first', '12'],
    ['002', 'second', '34'],
  ]);
});

it('hides former employees from the current list without removing profile history', () => {
  const active = record(
    'attendance',
    ['Current', '2026-11-07', '', '', '0', '0'],
    'current',
  );
  const former = record(
    'attendance',
    ['Former', '2026-11-07', '', '', '0', '0'],
    'former',
  );
  const data = recentAttendanceDataset(
    [active, former],
    [
      { id: 'current', personnelCode: '1', name: 'Current', status: 'فعال' },
      { id: 'former', personnelCode: '2', name: 'Former', status: 'غیرفعال' },
    ],
  );
  expect(data.recordIds).toEqual([active.id]);
  expect(data.rows).toHaveLength(1);
  expect(employeeAttendanceDataset([former]).recordIds).toEqual([former.id]);
});

it('shows the authoritative Toman daily penalty in both attendance views', () => {
  const day = record('attendance', ['worker', '2026-11-08', '', '', '10', '5']);
  day.data.dailyPenaltyToman = '750000';
  day.data.overtimeAmountToman = '225000';
  const employee = employeeAttendanceDataset([day]);
  const recent = recentAttendanceDataset(
    [day],
    [{ id: 'employee-1', name: 'worker', personnelCode: '001' }],
  );
  expect(employee.rows[0]![employee.columns.indexOf('جریمه روز')]).toContain(
    '۷۵۰٬۰۰۰',
  );
  for (const dataset of [employee, recent])
    expect(
      dataset.rows[0]![dataset.columns.indexOf('مبلغ اضافه‌کاری')],
    ).toContain('۲۲۵٬۰۰۰');
  expect(recent.rows[0]![recent.columns.indexOf('جریمه روز')]).toBe(
    employee.rows[0]![employee.columns.indexOf('جریمه روز')],
  );
});

it('marks excluded days consistently in HR and employee tables without dropping their history', () => {
  const day = {
    ...record('attendance', ['Worker', '2026-11-08']),
    status: 'غیرفعال',
    data: { attendanceActive: false },
  };
  const normal = record('attendance', ['Worker', '2026-11-09']);
  for (const data of [
    employeeAttendanceDataset([day, normal]),
    recentAttendanceDataset([day, normal], []),
  ]) {
    expect(data.inactiveRecordIds).toEqual([day.id]);
    expect(data.rows).toHaveLength(2);
  }
});

it('excludes disabled days and their punches from cached dashboard and report inputs', () => {
  const day = {
    ...record('attendance', ['Worker', '2026-11-08']),
    status: 'غیرفعال',
    data: { attendanceActive: false },
  };
  const punch = record('checkins', ['Worker', '2026-11-08', '09:00', 'ورود']);
  const other = record('attendance', ['Worker', '2026-11-09']);
  expect(eligibleAttendanceRecords([day, punch, other])).toEqual([other]);
});

it('reflects a saved status in both tables and restores the automatic deficit when cleared', () => {
  const day = record('attendance', ['Worker', '2026-11-08', '', '', '10', '5']);
  day.status = 'حاضر';
  day.data = { lateMinutes: 10, earlyMinutes: 5, deficitMinutes: 15 };
  for (const build of [
    employeeAttendanceDataset,
    (rows: (typeof day)[]) => recentAttendanceDataset(rows, []),
  ]) {
    const cell = (column: string) => {
      const data = build([day]);
      return data.rows[0]![data.columns.indexOf(column)];
    };
    day.data.attendanceStatusOverride = 'حاضر با تأخیر';
    expect(cell('وضعیت')).toBe('حاضر با تأخیر');
    expect(cell('کسری کار')).toBe('10');
    expect(cell('خروج زودهنگام')).toBe('0');
    delete day.data.attendanceStatusOverride;
    expect(cell('کسری کار')).toBe('15');
    expect(day.data.deficitMinutes).toBe(15);
  }
});
