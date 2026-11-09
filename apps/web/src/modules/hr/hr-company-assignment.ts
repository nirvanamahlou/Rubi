import type { HrEmployeeDto } from '@nora/contracts';

/** Sharing organizational membership must never move the attendance owner. */
export function employeeCompanyAssignment(
  company: {
    branchId: string;
    organizationBranchId: string;
    isHeadquarters: boolean;
  },
  employee?: Pick<HrEmployeeDto, 'branchId'>,
) {
  return {
    companyScope: company.isHeadquarters
      ? ('ALL' as const)
      : ('COMPANY' as const),
    companyId: company.isHeadquarters ? null : company.branchId,
    branchId: employee?.branchId ?? company.branchId,
    organizationBranchId: company.isHeadquarters
      ? null
      : company.organizationBranchId || null,
  };
}
