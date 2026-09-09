import type { HrSectionId } from './hr.model';
import type { HrPreviewDataset } from './hr-preview-data';
export const employeeProfileSources: Readonly<
  Record<string, readonly [HrSectionId, string]>
> = {
  contract: ['contracts', 'active'],
  attendance: ['time', 'attendance'],
  shift: ['time', 'shift'],
  leave: ['time', 'leave'],
  mission: ['expenses', 'mission'],
  overtime: ['time', 'overtime'],
  performance: ['development', 'performance'],
  assets: ['assets', 'list'],
  requests: ['requests', 'inbox'],
  payslips: ['payroll', 'payslips'],
  financial: ['payroll', 'payslips'],
};
export function filterEmployeeRecords(
  data: HrPreviewDataset,
  employee: { id: string; name: string },
  nameIsUnique: boolean,
): HrPreviewDataset {
  const idColumn = data.columns.findIndex((column) =>
    ['کد پرسنلی', 'شناسه کارمند'].includes(column),
  );
  const nameColumn = data.columns.findIndex((column) =>
    ['کارمند', 'درخواست‌کننده', 'نام و نام خانوادگی'].includes(column),
  );
  const rows = data.rows.filter((row) => {
    const read = (index: number) =>
      typeof row[index] === 'string' ? row[index] : '';
    if (idColumn >= 0 && read(idColumn)) return read(idColumn) === employee.id;
    return (
      nameIsUnique && nameColumn >= 0 && read(nameColumn) === employee.name
    );
  });
  return {
    ...data,
    rows,
    totalLabel: `${rows.length.toLocaleString('fa-IR')} رکورد این کارمند`,
  };
}
export const employeeProfileKey = (id: string, tab: string) =>
  `employee:${id}:${tab}`;
