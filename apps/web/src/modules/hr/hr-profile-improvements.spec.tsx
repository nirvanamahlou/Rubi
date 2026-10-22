import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import type {
  HrEmployeeDto,
  HrBootstrapDto,
  HrRecordDto,
} from '@nora/contracts';
import { getHrResource } from '@nora/contracts';
import {
  NewEmployeeForm,
  type NewEmployeeFormValue,
} from './new-employee-dialog';
import { employeeFormValue, employeeOrganizationOptions } from './hr-employees';
import { employeeSummaryFields } from './hr-employee-summary';
import {
  defaultPersonnelIdentity,
  personnelIdentityError,
} from './personnel-identity-fields';
import {
  retiredHrColumns,
  radanOptionalLabels,
  hrReferenceOptions,
} from './hr-form-model';
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

describe('employee assignment editor and shared job titles', () => {
  it('enables unit, grade, title and manager during edit while retaining branch/start/status restrictions', () => {
    const html = renderToStaticMarkup(
      <NewEmployeeForm
        personnelMode
        lockAssignment
        initialValue={{
          ...value,
          identityValues: [...defaultPersonnelIdentity],
          contactValues: [],
        }}
        organizationOptions={[
          {
            branch: value.branch,
            units: ['Updated unit'],
            positions: ['Global title'],
            grades: ['مدیر'],
          },
        ]}
        existingPersonnelCodes={[]}
        managerOptions={['Manager']}
        onCancel={() => {}}
        onSubmit={() => {}}
      />,
    );
    for (const name of ['unit', 'position', 'grade', 'manager']) {
      const control = html.match(
        new RegExp('<input[^>]*id="hr-new-employee-' + name + '"[^>]*>'),
      )?.[0];
      expect(control).toBeDefined();
      expect(control).not.toMatch(/\sdisabled(?:=|\s|>)/);
    }
    expect(html).toContain('عنوان شغلی');
    expect(html).toContain('Global title');
    expect(html).toContain('کد پستی');
    expect(
      html.match(/<input[^>]*id="hr-new-employee-branch"[^>]*>/)?.[0],
    ).toMatch(/\sdisabled=/);
  });
  it('offers the shared active catalogue in each branch without sharing unit references', () => {
    const data = {
      records: [],
      employees: [],
      branches: [
        { id: 'branch-1', name: 'First' },
        { id: 'branch-2', name: 'Second' },
      ],
      jobTitles: [
        { id: 'global', name: 'Global title', status: 'فعال' },
        { id: 'inactive', name: 'Inactive title', status: 'غیرفعال' },
      ],
    } as unknown as HrBootstrapDto;
    for (const branchId of ['branch-1', 'branch-2'])
      expect(
        hrReferenceOptions(data, 'employee', 'create', branchId)['عنوان شغلی'],
      ).toEqual(['Global title']);
    for (const option of employeeOrganizationOptions(data))
      expect(option.positions).toEqual(['Global title']);
    const definition = getHrResource('organization', 'positions')!;
    expect(retiredHrColumns('organization', 'positions')).toContain(
      'عنوان سمت',
    );
    expect(retiredHrColumns('organization', 'positions')).not.toContain(
      'عنوان شغلی',
    );
    expect(radanOptionalLabels(definition)).not.toContain('عنوان شغلی');
  });
  it('hydrates and displays the encrypted postal slot, with a safe legacy fallback', () => {
    const identity = [
      employee.name.split(' ')[0]!,
      employee.name.split(' ')[1]!,
      ...defaultPersonnelIdentity.slice(2),
    ];
    identity[14] = '0012345678';
    const record = {
      employeeId: employee.id,
      section: 'employee',
      tab: 'identity',
      values: identity,
      id: 'identity',
      version: 1,
      deletedAt: null,
    } as HrRecordDto;
    const data = {
      records: [record],
      employees: [employee],
      branches: [],
      capabilities: { sensitive: true },
    } as unknown as HrBootstrapDto;
    expect(
      employeeFormValue(employee, { data } as HrStore).identityValues?.[14],
    ).toBe('0012345678');
    expect(employeeSummaryFields(employee, [record], [], true)).toContainEqual([
      'کد پستی',
      '0012345678',
    ]);
    const blankIdentity = [...identity];
    blankIdentity[2] = '';
    expect(personnelIdentityError(blankIdentity)).toBe('');
    const invalid = [...identity];
    invalid[14] = '123';
    expect(personnelIdentityError(invalid)).toContain('کد پستی');
    record.values = identity.slice(0, 14);
    expect(
      employeeFormValue(employee, { data } as HrStore).identityValues?.[14],
    ).toBe('');
  });
});
