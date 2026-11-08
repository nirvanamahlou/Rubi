import { describe, expect, it, vi } from 'vitest';
import { saveEmployeeCompanyScope } from './hr-company-scope';

function setup(existing: { id: string } | null = null) {
  const hrRecord = {
    findFirst: vi.fn().mockResolvedValue(existing),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
  };
  return { hrRecord, tx: { hrRecord } as never };
}
const employee = { id: 'employee', branchId: 'attendance-owner' };
describe('employee organizational company membership', () => {
  it('keeps old clients unchanged when membership is omitted', async () => {
    const { tx, hrRecord } = setup();
    await saveEmployeeCompanyScope(tx, employee, undefined, undefined, []);
    expect(hrRecord.findFirst).not.toHaveBeenCalled();
  });
  it('shares membership without moving attendance or finance ownership', async () => {
    const { tx, hrRecord } = setup();
    await saveEmployeeCompanyScope(tx, employee, 'ALL', null, [
      'attendance-owner',
    ]);
    expect(hrRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        employeeId: 'employee',
        branchId: 'attendance-owner',
        values: ['ALL', ''],
      }),
    });
  });
  it('updates existing membership to another authorized company without changing its owner', async () => {
    const { tx, hrRecord } = setup({ id: 'membership' });
    await saveEmployeeCompanyScope(tx, employee, 'COMPANY', 'company-b', [
      'attendance-owner',
      'company-b',
    ]);
    expect(hrRecord.update).toHaveBeenCalledWith({
      where: { id: 'membership' },
      data: expect.objectContaining({
        branchId: 'attendance-owner',
        values: ['COMPANY', 'company-b'],
      }),
    });
    expect(hrRecord.create).not.toHaveBeenCalled();
  });
  it.each([
    ['COMPANY', 'unauthorized'],
    ['INVALID', null],
    [undefined, 'company-b'],
    ['ALL', 'company-b'],
  ])(
    'rejects invalid or unauthorized scope %s / %s before persistence',
    async (scope, companyId) => {
      const { tx, hrRecord } = setup();
      await expect(
        saveEmployeeCompanyScope(tx, employee, scope, companyId, [
          'attendance-owner',
        ]),
      ).rejects.toThrow();
      expect(hrRecord.findFirst).not.toHaveBeenCalled();
    },
  );
});
