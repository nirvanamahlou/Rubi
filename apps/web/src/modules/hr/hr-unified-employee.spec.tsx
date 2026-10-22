import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { HrEmployeeDto, HrRecordDto } from '@nora/contracts';
import { getHrResource } from '@nora/contracts';
import { NewEmployeeForm } from './new-employee-dialog';
import { employeeFormValue } from './hr-employees';
import {
  HrEmployeeSummary,
  employeeSummaryFields,
} from './hr-employee-summary';
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
const identity = [
  'Synthetic',
  'Worker',
  '0123456789',
  '123',
  'Father',
  '1990-01-02',
  'مرد',
  'متأهل',
  'تهران',
  'تهران',
  'کارشناسی',
  'ایرانی',
  'نامشخص',
  'Synthetic address',
];
const record = (
  id: string,
  tab: string,
  values: string[],
  extra: Partial<HrRecordDto> = {},
): HrRecordDto =>
  ({
    id,
    section: 'employee',
    tab,
    values,
    employeeId: employee.id,
    version: 3,
    deletedAt: null,
    status: 'فعال',
    ...extra,
  }) as HrRecordDto;
const records = [
  record('identity', 'identity', identity),
  record('phone-b', 'phones', ['خانه', '02112345678']),
  record('phone-a', 'phones', ['موبایل', '09123456789']),
  record('membership', 'groupMembers', ['Synthetic Worker'], {
    section: 'organization',
    parentId: 'group',
  }),
];
const group = record('group', 'groups', ['گروه ثبت‌شده'], {
  section: 'organization',
  employeeId: null,
});
function store(sensitive = true) {
  return {
    data: {
      records: [...records, group],
      branches: [],
      employees: [employee],
      capabilities: { sensitive },
    },
  } as unknown as HrStore;
}
describe('unified employee form and complete details', () => {
  it('hydrates private identity, typed contacts and version snapshot without changing the stored names', () => {
    const initial = employeeFormValue(employee, store());
    expect(initial.identityValues).toEqual([...identity, '']);
    expect(initial.contactValues).toEqual([
      ['موبایل', '09123456789'],
      ['خانه', '02112345678'],
    ]);
    expect(initial.profileRecords).toHaveLength(3);
    expect(initial.profileRecords).not.toContainEqual(
      expect.objectContaining({ id: 'membership' }),
    );
    expect(initial.firstName).toBe('Synthetic');
    expect(initial.lastName).toBe('Worker');
  });
  it('uses the same full personnel fields for creating and editing and retains the entered identity on edit', () => {
    for (const initialValue of [
      undefined,
      employeeFormValue(employee, store()),
    ]) {
      const html = renderToStaticMarkup(
        <NewEmployeeForm
          personnelMode
          initialValue={initialValue}
          lockAssignment={Boolean(initialValue)}
          existingPersonnelCodes={[]}
          managerOptions={[]}
          onCancel={() => {}}
          onSubmit={() => {}}
        />,
      );
      for (const label of [
        'کد ملی',
        'نام پدر',
        'شماره شناسنامه',
        'شماره داخلی',
        'عکس پرسنلی',
        'حساب کاربری سامانه',
        'نوع همکاری',
      ])
        expect(html).toContain(label);
      if (initialValue) {
        expect(html).toContain('value="0123456789"');
        expect(html).toContain('شماره‌های تماس (2)');
      }
    }
  });
  it('shows every identity value, organizational value and typed contact without explanatory prose', () => {
    const fields = employeeSummaryFields(
      employee,
      records,
      [group],
      true,
      'Synthetic account',
    );
    for (const label of getHrResource('employee', 'identity')!.columns)
      expect(fields.some(([key]) => key === label)).toBe(true);
    const html = renderToStaticMarkup(
      <HrEmployeeSummary
        employee={employee}
        records={records}
        references={[group]}
        sensitive
        userLabel="Synthetic account"
      />,
    );
    for (const text of [
      '0123456789',
      'Synthetic address',
      '0012',
      'Synthetic account',
      'گروه ثبت‌شده',
      'موبایل: 09123456789',
      'خانه: 02112345678',
    ])
      expect(html).toContain(text);
    expect(html).not.toContain('<p');
    expect(html).toContain('<dl');
  });
  it('does not hydrate or display private fields without sensitive access, even with cached records', () => {
    const initial = employeeFormValue(employee, store(false));
    expect(initial.identityValues).toBeUndefined();
    expect(initial.contactValues).toBeUndefined();
    expect(initial.profileRecords).toBeUndefined();
    const html = renderToStaticMarkup(
      <HrEmployeeSummary
        employee={employee}
        records={records}
        references={[group]}
        sensitive={false}
      />,
    );
    for (const privateValue of [
      '0123456789',
      'Synthetic address',
      '09123456789',
    ])
      expect(html).not.toContain(privateValue);
    expect(html).toContain('0012');
  });
});
