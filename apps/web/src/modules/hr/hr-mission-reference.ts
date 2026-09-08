import type { HrBootstrapDto, HrRecordDto } from '@rubi/contracts';
import { recordValue } from './hr-form-model';

export const isMissionExpense = (section: string, tab: string) =>
  section === 'expenses' && ['travel', 'advances', 'claims'].includes(tab);

export function expenseMissionOptions(
  data: HrBootstrapDto,
  branchId: string,
  organizationBranchId?: string,
  employeeId?: string,
): HrRecordDto[] {
  const employees = new Map(
    data.employees.map((employee) => [employee.id, employee]),
  );
  return data.records.filter((record) => {
    const employee = record.employeeId
      ? employees.get(record.employeeId)
      : undefined;
    // Old missions predate the company field; their employee supplies the scope.
    const companyId =
      record.data.organizationBranchId ?? employee?.organizationBranchId;
    return (
      ['expenses', 'time'].includes(record.section) &&
      record.tab === 'mission' &&
      !record.deletedAt &&
      record.branchId === branchId &&
      Boolean(employee && employee.branchId === branchId) &&
      (!organizationBranchId || companyId === organizationBranchId) &&
      (!employeeId || record.employeeId === employeeId)
    );
  });
}

export function missionOptionLabel(record: HrRecordDto): string {
  return [
    record.code,
    recordValue(record, 'کارمند'),
    recordValue(record, 'مقصد'),
    [recordValue(record, 'تاریخ رفت'), recordValue(record, 'تاریخ برگشت')]
      .filter(Boolean)
      .join(' تا '),
  ]
    .filter(Boolean)
    .join(' · ');
}
