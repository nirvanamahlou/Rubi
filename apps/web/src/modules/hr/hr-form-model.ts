import type { HrBootstrapDto, HrRecordDto } from '@rubi/contracts';
import { hrCompanies } from './hr-live-data';

export const recordValue = (record: HrRecordDto | undefined, label: string) =>
  record?.values[record.columns.indexOf(label)] ?? '';

// Keep persisted column positions stable; retired inputs are only hidden in UI/export.
export function retiredHrColumns(section: string, tab: string): string[] {
  const key = `${section}.${tab}`;
  return key === 'organization.branches'
    ? ['تاریخ اثر']
    : key === 'organization.units'
      ? ['مدیر']
      : key === 'recruitment.interviews'
        ? ['عنوان شغل']
        : key === 'assets.list'
          ? ['شماره سریال']
          : [];
}

export function parentFieldLabel(section: string, tab: string): string {
  if (section === 'organization') return 'واحد والد';
  if (section === 'recruitment')
    return tab === 'applicants' ? 'فرصت شغلی' : 'متقاضی';
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
  const eligible = data.records.filter(
    (r) =>
      !r.deletedAt &&
      r.branchId === branchId &&
      r.status !== 'غیرفعال' &&
      (!organizationBranchId ||
        !r.data.organizationBranchId ||
        r.data.organizationBranchId === organizationBranchId),
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
        (!organizationBranchId ||
          e.organizationBranchId === organizationBranchId),
    )
    .map((e) => e.name);
  const units = titles('organization', 'units');
  const positions = titles('organization', 'positions');
  const grades = titles('organization', 'grades');
  const companies = hrCompanies(data).map((c) => c.name);
  const options: Record<string, readonly string[]> = {};
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
  bind(['سمت', 'سمت فعلی', 'سمت جدید'], positions);
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
  bind(['فرصت شغلی'], titles('recruitment', 'openings'));
  bind(['عنوان شغل'], titles('organization', 'positions', 'عنوان شغل'));
  bind(['تقویم تعطیلات'], titles('time', 'holidays', 'تقویم'));
  bind(
    ['شیفت', 'شیفت فعلی', 'شیفت درخواستی'],
    titles('time', 'shift', 'عنوان شیفت'),
  );
  bind(['نوع مرخصی'], titles('time', 'leavePolicies', 'نوع مرخصی'));
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
  if (section === 'organization' && tab === 'positions')
    delete options['عنوان شغل'];
  if (section === 'time' && tab === 'leavePolicies')
    delete options['نوع مرخصی'];
  return options;
}

export function needsHrDetail(
  section: string,
  tab: string,
  approval: boolean,
): boolean {
  return (
    approval ||
    ['applicants', 'training', 'docs'].includes(tab) ||
    (section === 'contracts' && tab === 'active')
  );
}
