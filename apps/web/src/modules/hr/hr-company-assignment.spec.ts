import { describe, expect, it } from 'vitest';
import { employeeCompanyAssignment } from './hr-company-assignment';

describe('shared company membership', () => {
  it('keeps the existing attendance owner and clears the old organizational branch', () => {
    expect(
      employeeCompanyAssignment(
        {
          branchId: 'default-owner',
          organizationBranchId: '',
          isHeadquarters: true,
        },
        { branchId: 'radan-owner' },
      ),
    ).toEqual({
      branchId: 'radan-owner',
      organizationBranchId: null,
      companyScope: 'ALL',
      companyId: null,
    });
  });
  it('supports selecting an explicit company again', () => {
    expect(
      employeeCompanyAssignment(
        {
          branchId: 'owner',
          organizationBranchId: 'company',
          isHeadquarters: false,
        },
        { branchId: 'radan-owner' },
      ),
    ).toEqual({
      branchId: 'radan-owner',
      organizationBranchId: 'company',
      companyScope: 'COMPANY',
      companyId: 'owner',
    });
  });
});
