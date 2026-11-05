import { describe, expect, it } from 'vitest';
import type { HrRecordDto } from '@nora/contracts';
import {
  employeeLeaveDataset,
  isEmployeeLeave,
} from './employee-leave-dataset';
describe('employee leave projection', () => {
  it('includes native and workbench approved leave without including missions or deleted records', () => {
    const row = {
      id: 'one',
      code: 'WB-test',
      section: 'requests',
      tab: 'radanLeave',
      values: [
        'Employee',
        'استحقاقی',
        '2026-11-05',
        '2026-11-05',
        'ساعتی',
        '09:15',
        '11:15',
        'خیر',
      ],
      status: 'تأییدشده',
    } as HrRecordDto;
    const native = {
      ...row,
      id: 'two',
      section: 'time',
      tab: 'leave',
      values: ['Employee', 'استحقاقی', '2026-11-05', '2026-11-05', '1'],
    };
    expect(
      employeeLeaveDataset([row, native, { ...row, tab: 'radanMission' }])
        .recordIds,
    ).toEqual(['one', 'two']);
    expect(employeeLeaveDataset([row]).rows[0]).toContain('09:15 تا 11:15');
    expect(isEmployeeLeave({ ...row, deletedAt: '2026-11-05' })).toBe(false);
  });
});
