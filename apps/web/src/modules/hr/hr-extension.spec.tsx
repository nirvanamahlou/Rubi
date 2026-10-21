import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { HrEmployeeDto } from '@nora/contracts';
import { getHrResource } from '@nora/contracts';
import {
  NewEmployeeForm,
  validateNewEmployeeForm,
  type NewEmployeeFormValue,
} from './new-employee-dialog';
import { employeeDataset, employeeFormValue } from './hr-employees';
import type { HrStore } from './hr-store';
const employee: HrEmployeeDto = {
  id: 'employee-1',
  personnelCode: 'HR-1001',
  name: 'Synthetic Worker',
  branchId: 'branch-1',
  userId: null,
  photoDocumentId: null,
  organizationBranchId: null,
  companyName: 'شعبه',
  kind: 'تمام‌وقت',
  unit: 'واحد',
  position: 'سمت',
  grade: 'کارشناس',
  managerId: null,
  manager: '',
  startedAtValue: '2026-10-21',
  status: 'فعال',
  version: 1,
  extension: '0012',
};
const value: NewEmployeeFormValue = {
  firstName: 'Synthetic',
  lastName: 'Worker',
  personnelCode: 'HR-1001',
  employmentType: 'تمام‌وقت',
  branch: 'شعبه',
  unit: 'واحد',
  position: 'سمت',
  grade: 'کارشناس',
  manager: 'بدون مدیر مستقیم',
  startedAt: '2026-10-21',
  status: 'فعال',
};
describe('employee business extension', () => {
  it('shows an optional extension in classic edit and personnel creation without changing its leading zeros', () => {
    for (const personnelMode of [false, true]) {
      const html = renderToStaticMarkup(
        <NewEmployeeForm
          personnelMode={personnelMode}
          initialValue={{ ...value, extension: '0012' }}
          existingPersonnelCodes={[]}
          managerOptions={[]}
          onCancel={() => {}}
          onSubmit={() => {}}
        />,
      );
      expect(html).toContain('شماره داخلی');
      expect(html).toContain('name="extension"');
      expect(html).toContain('value="0012"');
      if (personnelMode)
        expect(html.indexOf('کد ملی')).toBeLessThan(
          html.indexOf('شماره داخلی'),
        );
    }
    expect(
      validateNewEmployeeForm({ ...value, extension: '۰۰۱۲' }, []).extension,
    ).toBeUndefined();
    expect(
      validateNewEmployeeForm({ ...value, extension: '' }, []).extension,
    ).toBeUndefined();
    expect(
      validateNewEmployeeForm({ ...value, extension: '12a' }, []).extension,
    ).toBeDefined();
  });
  it('hydrates edits and exports the same extension table column with a blank legacy fallback', () => {
    const store = {
      data: { records: [], branches: [], employees: [employee] },
    } as unknown as HrStore;
    expect(employeeFormValue(employee, store).extension).toBe('0012');
    const legacy: HrEmployeeDto = { ...employee, id: 'legacy' };
    delete legacy.extension;
    const data = employeeDataset([employee, legacy], []);
    const column = data.columns.indexOf('شماره داخلی');
    expect(column).toBeGreaterThan(-1);
    expect(data.rows[0]?.[column]).toBe('0012');
    expect(data.rows[1]?.[column]).toBe('—');
    expect(data.rows.every((row) => row.length === data.columns.length)).toBe(
      true,
    );
    expect(getHrResource('employee', 'internalContact')).toMatchObject({
      readOnly: true,
      sensitive: false,
      employeeRequired: true,
    });
  });
});
