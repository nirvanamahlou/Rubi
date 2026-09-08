import { describe, expect, it } from 'vitest';
import {
  employeeProfileKey,
  filterEmployeeRecords,
} from './employee-profile-data';
describe('employee profile isolation', () => {
  const data = {
    columns: ['شناسه', 'کارمند', 'تعداد روز'],
    rows: [
      ['L1', 'الف', '3'],
      ['L2', 'ب', '2'],
    ],
    totalLabel: '',
  };
  it('shows only matching employee records', () => {
    expect(
      filterEmployeeRecords(data, { id: 'A', name: 'الف' }, true).rows,
    ).toEqual([data.rows[0]]);
  });
  it('does not assign shared anonymous records or ambiguous names', () => {
    expect(
      filterEmployeeRecords(data, { id: 'A', name: 'الف' }, false).rows,
    ).toEqual([]);
    expect(
      filterEmployeeRecords(
        { ...data, columns: ['شناسه', 'عنوان', 'تعداد روز'] },
        { id: 'A', name: 'الف' },
        true,
      ).rows,
    ).toEqual([]);
  });
  it('prefers stable personnel IDs over matching names', () => {
    expect(
      filterEmployeeRecords(
        { ...data, columns: ['کد پرسنلی', 'کارمند', 'تعداد روز'] },
        { id: 'L2', name: 'الف' },
        true,
      ).rows,
    ).toEqual([data.rows[1]]);
  });
  it('uses distinct storage keys for each employee', () => {
    expect(employeeProfileKey('A', 'financial')).not.toBe(
      employeeProfileKey('B', 'financial'),
    );
  });
});
