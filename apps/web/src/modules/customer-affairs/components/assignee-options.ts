import type { HrDirectoryResponse } from '@nora/contracts';

export function assigneeOptions(employees: HrDirectoryResponse['employees']) {
  return employees.map((employee) => ({
    value: employee.userId ?? `unlinked:${employee.id}`,
    disabled: !employee.userId,
    label: `${employee.name} — ${employee.unit}${employee.userId ? '' : ' — بدون حساب کاربری متصل'}`,
  }));
}

export function selectableAssigneeOptions(
  employees: HrDirectoryResponse['employees'],
) {
  return employees
    .filter((employee) => employee.userId)
    .map((employee) => ({
      value: employee.userId!,
      label: `${employee.name} — ${employee.unit}`,
      searchText: `${employee.personnelCode} ${employee.position}`,
    }));
}
