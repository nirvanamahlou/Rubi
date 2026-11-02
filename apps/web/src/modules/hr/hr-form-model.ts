import { hrBranchKey } from '@nora/contracts';
import {
  HR_RADAN_COMPLETION_COLUMNS,
  HR_RADAN_COMPLETION_OPTIONS,
  HR_RADAN_PROVINCES,
  HR_RADAN_CALCULATION_COMPONENTS,
  HR_RADAN_REQUEST_TYPES,
} from '@nora/contracts';
import type { HrResourceDefinition } from '@nora/contracts';
import {
  HR_RADAN_FIELD_OPTIONS,
  HR_RADAN_CONTRACT_TYPES,
  HR_RADAN_LEAVE_TYPES,
} from '@nora/contracts';
import type { HrBootstrapDto, HrRecordDto } from '@nora/contracts';
import { hrCompanies } from './hr-live-data';
import { HR_GRADE_OPTIONS } from './hr-grade-options';

/** Presentation aliases keep historical persisted column positions and command keys intact. */
export function hrFieldLabel(label: string): string {
  return (
    (
      {
        سمت: 'عنوان شغلی',
        'سمت فعلی': 'عنوان شغلی فعلی',
        'سمت جدید': 'عنوان شغلی جدید',
      } as Record<string, string>
    )[label] ?? label
  );
}

export const recordValue = (record: HrRecordDto | undefined, label: string) =>
  record?.values[record.columns.indexOf(label)] ?? '';

// Keep persisted column positions stable; retired inputs are only hidden in UI/export.
export function retiredHrColumns(section: string, tab: string): string[] {
  const key = `${section}.${tab}`;
  return key === 'organization.branches'
    ? ['تاریخ اثر']
    : key === 'organization.units'
      ? ['مدیر', 'واحد والد']
      : key === 'organization.positions'
        ? ['عنوان سمت', 'واحد', 'رده', 'ظرفیت', 'تاریخ اثر']
        : key === 'lifecycle.promotion'
          ? ['سمت فعلی', 'رده فعلی']
          : key === 'contracts.active'
            ? ['موضوع و تعهدات', 'مرجع حل اختلاف']
            : key === 'time.shift'
              ? ['تقویم تعطیلات']
              : key === 'recruitment.interviews'
                ? ['عنوان شغل']
                : key === 'assets.list'
                  ? ['شماره سریال']
                  : [];
}

export function parentFieldLabel(section: string, tab: string): string {
  if (section === 'organization' && tab === 'chartEmployees') return 'گره والد';
  if (section === 'organization')
    return tab === 'groupMembers' ? 'گروه' : 'واحد والد';
  if (section === 'time' && tab === 'shift')
    return 'ساعت کاری یا شیفت تعریف‌شده';
  if (section === 'time' && tab === 'templateDays') return 'شیفت تعریف‌شده';
  if (
    section === 'requests' &&
    ['approvalStages', 'procedureMembers'].includes(tab)
  )
    return 'روند تأیید';
  if (section === 'requests' && tab === 'patternAssignments') return 'الگو';
  if (section === 'recruitment')
    return tab === 'applicants' ? 'برنامه جذب' : 'متقاضی';
  if (section === 'contracts') return 'قرارداد مرجع';
  if (section === 'development') return 'دوره ارزیابی';
  if (section === 'lifecycle') return 'پرونده پایان همکاری';
  if (section === 'expenses') return 'مأموریت مرجع';
  if (section === 'assets' || section === 'fleet') return 'خودرو';
  if (section === 'payroll') return 'دوره حقوق';
  return 'پرونده مرتبط';
}

export function hrReferenceOptions(
  data: HrBootstrapDto,
  section: string,
  tab: string,
  branchId: string,
  organizationBranchId?: string,
): Record<string, readonly string[]> {
  const org = data.records.find((r) => r.id === organizationBranchId);
  const companyIds = new Set(
    data.records
      .filter(
        (r) =>
          r.section === 'organization' &&
          r.tab === 'branches' &&
          r.branchId === branchId &&
          org &&
          hrBranchKey(r.values[0] ?? '') === hrBranchKey(org.values[0] ?? ''),
      )
      .map((r) => r.id),
  );
  const eligible = data.records.filter(
    (r) =>
      !r.deletedAt &&
      r.branchId === branchId &&
      r.status !== 'غیرفعال' &&
      (!organizationBranchId ||
        !r.data.organizationBranchId ||
        r.data.organizationBranchId === organizationBranchId ||
        companyIds.has(r.data.organizationBranchId)),
  );
  const titles = (s: string, t: string, label?: string) =>
    Array.from(
      new Set(
        eligible
          .filter((r) => r.section === s && r.tab === t)
          .map((r) => (label ? recordValue(r, label) : (r.values[0] ?? '')))
          .filter(Boolean),
      ),
    );
  const people = data.employees
    .filter(
      (e) =>
        e.branchId === branchId &&
        e.status === 'فعال' &&
        (!organizationBranchId ||
          e.organizationBranchId === organizationBranchId),
    )
    .map((e) => e.name);
  const units = titles('organization', 'units');
  const positions = data.jobTitles
    ? [
        ...new Set(
          data.jobTitles
            .filter((title) => title.status === 'فعال')
            .map((title) => title.name),
        ),
      ]
    : titles('organization', 'positions');
  const grades = [
    ...new Set([...HR_GRADE_OPTIONS, ...titles('organization', 'grades')]),
  ];
  const companies = hrCompanies(data).map((c) => c.name);
  const options: Record<string, readonly string[]> = {
    ...HR_RADAN_FIELD_OPTIONS,
    'نوع قرارداد': HR_RADAN_CONTRACT_TYPES,
  };
  const bind = (labels: string[], values: readonly string[]) =>
    labels.forEach((l) => {
      options[l] = values;
    });
  bind(
    [
      'واحد',
      'واحد درخواست‌کننده',
      'واحد درخواست کننده',
      'واحد مبدأ',
      'واحد مقصد',
      'واحد والد',
    ],
    units,
  );
  bind(['عنوان شغلی', 'سمت', 'سمت فعلی', 'سمت جدید'], positions);
  bind(['رده', 'رده شغلی', 'رده فعلی', 'رده جدید'], grades);
  bind(
    [
      'شرکت',
      'شعبه',
      'شرکت یا شعبه',
      'شعبه مبدأ',
      'شعبه مقصد',
      'شرکت مقصد',
      'شعبه پیش‌فرض',
      'محل کار',
    ],
    companies,
  );
  bind(
    [
      'کارمند',
      'درخواست‌کننده',
      'نام درخواست‌کننده',
      'مدیر',
      'مدیر مستقیم',
      'مدیر جدید',
      'مسئول',
      'مسئول خودرو',
      'مالک',
      'مالک قالب',
      'مالک مرحله',
      'مسئول بررسی',
      'مسئول تأیید',
      'ارزیاب',
      'مصاحبه‌کننده',
      'مصاحبه‌کنندگان',
      'تأییدکننده',
      'راننده',
      'جایگزین',
      'گیرنده',
    ],
    people,
  );
  bind(['فرصت شغلی', 'برنامه جذب'], titles('recruitment', 'staffing'));
  bind(
    ['عنوان شغل'],
    data.jobTitles
      ? positions
      : [
          ...new Set(
            eligible
              .filter(
                (r) => r.section === 'organization' && r.tab === 'positions',
              )
              .map((r) => r.values[1] || r.values[0] || '')
              .filter(Boolean),
          ),
        ],
  );
  bind(['تقویم تعطیلات'], titles('time', 'holidays', 'تقویم'));
  bind(
    ['شیفت', 'شیفت فعلی', 'شیفت درخواستی'],
    titles('time', 'shift', 'عنوان شیفت'),
  );
  bind(
    ['نوع مرخصی'],
    [
      ...new Set([
        ...titles('time', 'leavePolicies', 'نوع مرخصی'),
        ...HR_RADAN_LEAVE_TYPES,
        'جبرانی',
      ]),
    ],
  );
  bind(['سیاست مرخصی'], titles('time', 'leavePolicies'));
  bind(['دوره ارزیابی'], titles('development', 'cycles'));
  bind(['برنامه آموزشی', 'برنامه پیشنهادی'], titles('development', 'training'));
  bind(['ساختار حقوق'], titles('payroll', 'structures'));
  bind(['مؤلفه', 'مولفه'], titles('payroll', 'components'));
  bind(
    ['خودرو'],
    [...titles('assets', 'vehicles'), ...titles('fleet', 'vehicles')],
  );
  // Names/titles on definition forms create catalog entries rather than reference themselves.
  if (section === 'organization' && tab === 'positions') {
    delete options['عنوان شغل'];
    delete options['عنوان شغلی'];
  }
  if (section === 'time' && tab === 'leavePolicies')
    delete options['نوع مرخصی'];
  return {
    ...options,
    ...HR_RADAN_COMPLETION_OPTIONS,
    'استان محل صدور': HR_RADAN_PROVINCES,
    'اجزای کارکرد': HR_RADAN_CALCULATION_COMPONENTS,
    درخواست‌ها: HR_RADAN_REQUEST_TYPES,
    ...Object.fromEntries(
      [
        'مرخصی بر اساس طول شیفت',
        'مأموریت خارج ساعت کاری اضافه‌کار',
        'کسر کسرکار از اضافه‌کار',
        'اضافه‌کار پنجشنبه',
        'اضافه‌کار جمعه',
        'افزودن اضافه‌کار تعطیل',
      ].map((label) => [label, ['بله', 'خیر']]),
    ),
  };
}

export function needsHrDetail(
  section: string,
  tab: string,
  approval: boolean,
): boolean {
  return (
    approval ||
    [
      'applicants',
      'training',
      'docs',
      'shiftTemplates',
      'procedures',
      'patterns',
      'biometric',
    ].includes(tab) ||
    (section === 'contracts' && tab === 'active')
  );
}

/** Keep Radan-specific requiredness from changing unrelated Nora forms. */
export function radanOptionalLabels(
  definition: HrResourceDefinition,
): string[] {
  return [
    ...Object.keys(HR_RADAN_COMPLETION_COLUMNS),
    'organization.groups',
    'organization.positions',
    'organization.groupMembers',
    'time.workingHours',
    'time.shiftTemplates',
    'time.remote',
    'time.biometric',
  ].includes(definition.key)
    ? definition.fields
        .filter((field) => !field.required)
        .map((field) => field.label)
    : [];
}
