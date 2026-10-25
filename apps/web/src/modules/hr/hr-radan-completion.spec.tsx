import { renderToStaticMarkup } from 'react-dom/server';
import { ContextualHrForm } from './contextual-hr-form';
import { employeeFormValue } from './hr-employees';
import type { HrEmployeeDto, HrRecordDto } from '@nora/contracts';
import type { HrStore } from './hr-store';
import { describe, expect, it } from 'vitest';
import { getHrResource } from '@nora/contracts';
import { persianCalendarMonths } from './hr-template-calendar';
import { minuteText } from './hr-radan-tools';
import { HrLeaveBalance } from './hr-leave-balance';
import { hrReferenceOptions, radanOptionalLabels } from './hr-form-model';
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
  const device = getHrResource('time', 'biometric')!;
  expect(device.columns).not.toContain('رمز عبور شبکه');
  const html = renderToStaticMarkup(
    <ContextualHrForm
      context={{
        section: 'time',
        tab: 'biometric',
        title: 'دستگاه',
        description: '',
        columns: ['شناسه', ...device.columns, 'رمز عبور شبکه', 'وضعیت'],
        mode: 'create',
        fieldTypes: { 'رمز عبور شبکه': 'password' },
        optionalLabels: [...radanOptionalLabels(device), 'رمز عبور شبکه'],
        optionsByLabel: hrReferenceOptions(
          { records: [], employees: [], branches: [] } as unknown as Parameters<
            typeof hrReferenceOptions
          >[0],
          'time',
          'biometric',
          'synthetic-branch',
        ),
      }}
      onCancel={() => undefined}
      onSubmit={() => undefined}
    />,
  );
  expect(html).toContain('type="password"');
  const labels = [
    'نام دستگاه',
    'توضیحات',
    'آدرس دستگاه',
    'پورت دستگاه',
    'رمز عبور شبکه',
    'نوع دستگاه',
  ];
  expect(html.match(/<label\b/g)).toHaveLength(6);
  expect(labels.map((label) => html.indexOf(label))).toEqual(
    labels.map((label) => html.indexOf(label)).toSorted((a, b) => a - b),
  );
  for (const label of [
    'کد دستگاه',
    'آخرین همگام‌سازی',
    'تعداد رکورد',
    'سلامت اتصال',
  ])
    expect(html).not.toContain(label);
  for (const type of ['V800', 'رادن', 'ZK', 'TF8000', 'V210'])
    expect(html).toContain(type);
  expect(hrGroups.time?.find((group) => group.id === 'device')).toMatchObject({
    label: 'دستگاه',
    sources: [{ section: 'time', tab: 'biometric', label: 'دستگاه' }],
  });
});

it('renders the nine observed working-hour controls with stable stored positions', () => {
  const definition = getHrResource('time', 'workingHours')!;
  const html = renderToStaticMarkup(
    <ContextualHrForm
      context={{
        section: 'time',
        tab: 'workingHours',
        title: 'ساعت کار',
        description: '',
        columns: ['شناسه', ...definition.columns, 'وضعیت'],
        mode: 'create',
        optionalLabels: radanOptionalLabels(definition),
        optionsByLabel: {
          'روز پایان': ['همان روز', 'یک روز بعد', 'دو روز بعد'],
          'تعریف ضرایب پیش‌فرض': ['بله', 'خیر'],
        },
        fieldTypes: { توضیحات: 'textarea' },
      }}
      onCancel={() => {}}
      onSubmit={() => {}}
    />,
  );
  expect(html).not.toContain('>شناسه<');
  expect(html).not.toContain('>وضعیت<');
  for (const label of [
    'توضیحات ساعت کاری',
    'زمان آغاز',
    'زمان پایان',
    'محدوده تردد پرسنل',
    'چند ساعت قبل از زمان آغاز',
    'چند ساعت بعد از زمان پایان',
  ])
    expect(html).toContain(label);
  expect(html).toContain('type="color"');
  expect(html).toContain('value="#000000"');
  expect(html).toContain('type="checkbox"');
  expect(html).not.toContain('checked=""');
  expect(hrGroups.time!.find((g) => g.id === 'workingHours')?.label).toBe(
    'ساعت کار',
  );
  expect(hrGroups.time!.find((g) => g.id === 'leaveBalance')?.label).toBe(
    'مانده مرخصی',
  );
});

it('keeps leave operations separate from HR reports and preserves monthly grants and independent transfer thresholds', () => {
  const store = {
    data: {
      records: [],
      employees: [],
      branchIds: [],
      branches: [],
      capabilities: { write: true, approve: true },
    },
    revision: 0,
  } as unknown as HrStore;
  const grant = renderToStaticMarkup(<HrLeaveBalance store={store} />);
  for (const title of [
    'افزودن مانده مرخصی',
    'انتقال مرخصی کاربر',
    'انتقال مرخصی عمومی',
  ])
    expect(grant).toContain(title);
  expect(grant).not.toContain('کاردکس مانده مرخصی');
  expect(grant).not.toContain('گزارش مانده مرخصی');
  expect(grant).toContain('value="16:20"');
  expect(grant.match(/checked=""/g)).toHaveLength(13);
  expect(grant).toContain('فرم مانده مرخصی');
  expect(grant).not.toContain('نوع مرخصی');
  const transfer = renderToStaticMarkup(
    <HrLeaveBalance store={store} initialView="generalTransfer" />,
  );
  expect(transfer).toContain('انتقال از سال');
  expect(transfer).toContain('مانده مرخصی بیشتر از');
  expect(transfer).toContain('مانده مرخصی کمتر از');
  expect(transfer.match(/value="00:00"/g)).toHaveLength(8);
  expect(transfer).not.toContain('عنوان قاعده');
  expect(transfer).not.toContain('نوع مرخصی');
  for (const initialView of ['cardex', 'report', 'userTransfer']) {
    const html = renderToStaticMarkup(
      <HrLeaveBalance
        store={store}
        initialView={initialView}
        reportsOnly={initialView !== 'userTransfer'}
      />,
    );
    for (const field of [
      'جست‌وجو',
      'مرتب‌سازی',
      'کد پرسنلی',
      'اسم و فامیل',
      'انتخاب صفحه',
    ])
      expect(html).toContain(field);
    if (initialView !== 'userTransfer') expect(html).toContain('انتخاب سال');
  }
});
