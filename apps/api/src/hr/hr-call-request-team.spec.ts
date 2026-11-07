import { describe, it, expect, vi } from 'vitest';
import { HrUserUnitDirectory } from './hr-user-unit-directory';
function setup() {
  const employees = [
    {
      userId: 'manager',
      grade: 'مدیر',
      unit: 'Sales',
      organizationBranchId: null,
    },
    {
      userId: 'peer',
      grade: 'کارشناس',
      unit: 'Sales',
      organizationBranchId: null,
    },
    {
      userId: 'foreign-unit',
      grade: 'کارشناس',
      unit: 'HR',
      organizationBranchId: null,
    },
    {
      userId: 'foreign-company',
      grade: 'کارشناس',
      unit: 'Sales',
      organizationBranchId: 'other',
    },
  ];
  const units = [{ values: ['Sales'], data: {} }];
  const hrEmployee = { findMany: vi.fn().mockResolvedValue(employees) };
  const hrRecord = {
    findMany: vi.fn().mockResolvedValue(units),
    findFirst: vi.fn().mockResolvedValue({ id: 'company' }),
  };
  const service = new HrUserUnitDirectory({
    client: { hrEmployee, hrRecord },
  } as never);
  return { service, employees, units, hrEmployee, hrRecord };
}
describe('HR-owned live manager request team', () => {
  it('returns only linked active same-unit/company staff IDs with no HR/private fields', async () => {
    const { service, hrEmployee } = setup();
    expect(await service.callCenterRequestTeam('branch', 'manager')).toEqual([
      'manager',
      'peer',
    ]);
    expect(hrEmployee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          branchId: 'branch',
          status: 'فعال',
          deletedAt: null,
          userId: { not: null },
        },
      }),
    );
  });
  it('uses current grade on every read: promote, demote, and preserve old role independence', async () => {
    const { service, employees } = setup();
    employees[0]!.grade = 'کارشناس';
    expect(await service.callCenterRequestTeam('branch', 'manager')).toBeNull();
    employees[0]!.grade = 'مدیر';
    expect(await service.callCenterRequestTeam('branch', 'manager')).toEqual([
      'manager',
      'peer',
    ]);
    employees[0]!.grade = 'مدیر ارشد';
    expect(await service.callCenterRequestTeam('branch', 'manager')).toBeNull();
  });
  it('uses current unit and candidate membership after transfers', async () => {
    const { service, employees, units } = setup();
    units.push({ values: ['HR'], data: {} });
    employees[0]!.unit = 'HR';
    expect(await service.callCenterRequestTeam('branch', 'manager')).toEqual([
      'foreign-unit',
      'manager',
    ]);
    employees[2]!.unit = 'Sales';
    expect(await service.callCenterRequestTeam('branch', 'manager')).toEqual([
      'manager',
    ]);
  });
  it('requires native account links, never employee name or job title', async () => {
    const { service } = setup();
    expect(
      await service.callCenterRequestTeam('branch', 'unlinked'),
    ).toBeNull();
  });
  it('fails closed on empty, missing, inactive or ambiguous unit mappings', async () => {
    const { service, employees, units, hrRecord } = setup();
    employees[0]!.unit = '';
    expect(await service.callCenterRequestTeam('branch', 'manager')).toBeNull();
    employees[0]!.unit = 'Sales';
    hrRecord.findMany.mockResolvedValue([]);
    expect(await service.callCenterRequestTeam('branch', 'manager')).toBeNull();
    hrRecord.findMany.mockResolvedValue([...units, ...units]);
    expect(await service.callCenterRequestTeam('branch', 'manager')).toBeNull();
  });
  it('does not confuse two companies with identically named units', async () => {
    const { service, employees, hrRecord } = setup();
    employees[0]!.organizationBranchId = 'company';
    employees[1]!.organizationBranchId = 'company';
    hrRecord.findMany.mockResolvedValue([
      { values: ['Sales'], data: { organizationBranchId: 'company' } },
      { values: ['Sales'], data: { organizationBranchId: 'other' } },
    ]);
    expect(await service.callCenterRequestTeam('branch', 'manager')).toEqual([
      'manager',
      'peer',
    ]);
    hrRecord.findFirst.mockResolvedValue(null);
    expect(await service.callCenterRequestTeam('branch', 'manager')).toBeNull();
  });
  it('locks the exact returned HR snapshot in transactional saves', async () => {
    const { service, employees, units } = setup();
    const tx = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce(employees)
        .mockResolvedValueOnce(units),
    };
    expect(
      await service.callCenterRequestTeam('branch', 'manager', tx as never),
    ).toEqual(['manager', 'peer']);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    for (const call of tx.$queryRaw.mock.calls)
      expect(call[0].join('')).toContain('FOR SHARE');
  });
});
