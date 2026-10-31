import type { HrEmployeeDto, HrRecordDto } from '@nora/contracts';
import { getHrResource } from '@nora/contracts';
import { hrDisplayDate } from './hr-dates';
import { hrStatusText } from './hr-presentation';
import ui from './hr-unified.module.css';

export function employeeSummaryFields(
  employee: HrEmployeeDto,
  records: readonly HrRecordDto[],
  references: readonly HrRecordDto[],
  sensitive: boolean,
  userLabel?: string,
) {
  const identity = records.find(
    (r) => r.section === 'employee' && r.tab === 'identity' && !r.deletedAt,
  );
  const membership = records.find(
    (r) =>
      r.section === 'organization' &&
      r.tab === 'groupMembers' &&
      r.status === 'فعال' &&
      !r.deletedAt,
  );
  const group = references.find((r) => r.id === membership?.parentId);
  const fields: [string, string][] = [
    ['کد پرسنلی', employee.personnelCode],
    ['نام و نام خانوادگی', employee.name],
    ['شماره داخلی', employee.extension ?? ''],
    ['نوع همکاری', employee.kind],
    ['شرکت', employee.companyName],
    ['واحد', employee.unit],
    ['عنوان شغلی', employee.position],
    ['رده شغلی', employee.grade],
    ['مدیر مستقیم', employee.manager],
    ['تاریخ شروع', hrDisplayDate(employee.startedAtValue)],
    ['وضعیت', hrStatusText(employee.status)],
    ['گروه', group?.values[0] ?? ''],
    ['حساب کاربری سامانه', userLabel ?? employee.userId ?? ''],
  ];
  if (sensitive) {
    const columns = getHrResource('employee', 'identity')!.columns;
    for (const [index, column] of columns.entries()) {
      const value = identity?.values[index] ?? '';
      fields.push([
        column,
        column === 'تاریخ تولد' && value ? hrDisplayDate(value) : value,
      ]);
    }
    const phones = records.filter(
      (r) => r.section === 'employee' && r.tab === 'phones' && !r.deletedAt,
    );
    fields.push([
      'شماره‌های تماس',
      phones.map((r) => `${r.values[0]}: ${r.values[1]}`).join('\n'),
    ]);
  }
  return fields;
}

export function HrEmployeeSummary(props: {
  employee: HrEmployeeDto;
  records: readonly HrRecordDto[];
  references: readonly HrRecordDto[];
  sensitive: boolean;
  userLabel?: string | undefined;
}) {
  return (
    <dl className={ui.properties}>
      {employeeSummaryFields(
        props.employee,
        props.records,
        props.references,
        props.sensitive,
        props.userLabel,
      ).map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
