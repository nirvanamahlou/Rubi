import { describe, it, expect } from 'vitest';
import type { HrRecordDto } from '@nora/contracts';
import { employeeAttendanceDataset } from './employee-attendance-dataset';
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
      'ورود',
      'خروج',
      'تأخیر',
      'خروج زودهنگام',
    ]);
    expect(data.rows[0]?.slice(1)).toEqual(['09:05', '16:50', '5', '10']);
    expect(data.recordIds).toEqual([day.id]);
  });
  it('does not guess arrival or departure from an indeterminate punch', () => {
    const data = employeeAttendanceDataset([
      record('attendance', ['worker', '2026-11-01', '', '', '0', '0']),
      record('checkins', ['worker', '2026-11-01', '09:00', 'اعلام حضور']),
    ]);
    expect(data.rows[0]?.slice(1, 3)).toEqual(['—', '—']);
  });
});
