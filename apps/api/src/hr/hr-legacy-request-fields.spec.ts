import { describe, expect, it } from 'vitest';
import {
  readAttendanceRequestComponent,
  readLeaveRequestFields,
} from './hr-legacy-request-fields';

describe('legacy HR request fields', () => {
  it('reads legacy daily leave and current hourly leave from their persisted layouts', () => {
    const dates = ['1405-08-17', '1405-08-18'];
    const fields = ['employee', 'استحقاقی', ...dates];
    expect(readLeaveRequestFields([...fields, 'بله'])).toEqual({
      leaveType: 'استحقاقی',
      from: dates[0],
      to: dates[1],
      mode: 'روزانه',
      startTime: undefined,
      endTime: undefined,
    });
    expect(
      readLeaveRequestFields([...fields, 'ساعتی', '09:00', '10:00', 'خیر']),
    ).toMatchObject({ mode: 'ساعتی', startTime: '09:00', endTime: '10:00' });
  });

  it.each([
    ['remote', 'دورکاری', 3],
    ['mission', 'مأموریت', 4],
    ['radanMission', 'مأموریت', 4],
    ['leave', 'مرخصی', 4],
    ['radanLeave', 'مرخصی', 4],
  ] as const)('reads the duration field for %s', (tab, category, index) => {
    const values = Array<string>(index).fill('');
    expect(readAttendanceRequestComponent(tab, values)).toEqual({
      category,
      mode: 'روزانه',
    });
    values.push('ساعتی');
    expect(readAttendanceRequestComponent(tab, values)).toEqual({
      category,
      mode: 'ساعتی',
    });
  });

  it('ignores records outside attendance request categories', () => {
    expect(readAttendanceRequestComponent('payroll', [])).toBeNull();
  });
});
