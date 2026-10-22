import { renderToStaticMarkup } from 'react-dom/server';
import { ContextualHrForm } from './contextual-hr-form';
import { employeeFormValue } from './hr-employees';
import type { HrEmployeeDto, HrRecordDto } from '@nora/contracts';
import type { HrStore } from './hr-store';
import { describe, expect, it } from 'vitest';
import { getHrResource } from '@nora/contracts';
import { persianCalendarMonths } from './hr-template-calendar';
import { minuteText } from './hr-radan-tools';
import { radanOptionalLabels } from './hr-form-model';
import { hrGroups, employeeGroups } from './hr-navigation';

describe('Radan fields in existing HR surfaces', () => {
  it('keeps a complete Jalali year of unique ISO calendar days', () => {
    const months = persianCalendarMonths(1405);
    const dates = months.flatMap((m) => m.dates);
    expect(months).toHaveLength(12);
    expect(new Set(dates).size).toBe(dates.length);
    expect([365, 366]).toContain(dates.length);
    expect(months[0]!.dates).toHaveLength(31);
    expect(months[6]!.dates).toHaveLength(30);
    expect(dates.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))).toBe(true);
  });
  it('displays exact minute balances and negative debit amounts', () => {
    expect(minuteText(980)).toBe('16:20');
    expect(minuteText(-61)).toBe('-1:01');
    expect(minuteText(0)).toBe('0:00');
  });
  it('exposes observed forms at their existing module locations', () => {
    const requests = hrGroups.requests!.flatMap((g) =>
      g.sources.map((s) => s.tab),
    );
    expect(requests).toContain('procedures');
    expect(requests).toContain('approvalStages');
    expect(requests).toContain('radanLeave');
    expect(
      employeeGroups.flatMap((g) => g.sources.map((s) => s.tab)),
    ).toContain('identity');
    for (const [section, tab] of [['employee', 'identity']] as const)
      expect(getHrResource(section, tab)?.sensitive).toBe(true);
    expect(getHrResource('time', 'minuteLedger')?.readOnly).toBe(true);
    expect(getHrResource('payroll', 'importedPayslips')?.readOnly).toBe(true);
  });
  it('requires identity names while allowing an optional national code without changing contract rules', () => {
    const definition = getHrResource('employee', 'identity')!;
    expect(radanOptionalLabels(definition)).toContain('کد ملی');
    expect(radanOptionalLabels(definition)).not.toContain('نام خانوادگی');
    expect(radanOptionalLabels(definition)).toContain('تحصیلات');
    expect(radanOptionalLabels(getHrResource('contracts', 'active')!)).toEqual(
      [],
    );
  });
});

it('retains a multiword given name when editing the canonical employee record', () => {
  const employee = {
    id: 'employee',
    name: 'نام دو بخشی خانواده',
    managerId: null,
  } as HrEmployeeDto;
  const identity = {
    employeeId: employee.id,
    section: 'employee',
    tab: 'identity',
    values: ['نام دو بخشی', 'خانواده'],
  } as HrRecordDto;
  const store = {
    data: { records: [identity], branches: [], employees: [] },
  } as unknown as HrStore;
  expect(employeeFormValue(employee, store)).toMatchObject({
    firstName: 'نام دو بخشی',
    lastName: 'خانواده',
  });
});

it('renders a write-only password input in the device form, not in table columns', () => {
  expect(getHrResource('time', 'biometric')!.columns).not.toContain(
    'رمز عبور شبکه',
  );
  const html = renderToStaticMarkup(
    <ContextualHrForm
      context={{
        section: 'time',
        tab: 'biometric',
        title: 'دستگاه',
        description: '',
        columns: ['شناسه', 'نام دستگاه', 'رمز عبور شبکه'],
        mode: 'create',
        fieldTypes: { 'رمز عبور شبکه': 'password' },
        optionalLabels: ['رمز عبور شبکه'],
      }}
      onCancel={() => undefined}
      onSubmit={() => undefined}
    />,
  );
  expect(html).toContain('type="password"');
});
