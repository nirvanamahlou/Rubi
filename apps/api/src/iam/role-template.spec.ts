import { describe, it, expect, vi } from 'vitest';
import { IamService } from './iam.service';
function setup(admin = true) {
  const service = Object.create(IamService.prototype);
  service.isSystemAdministrator = vi.fn(async () => admin);
  service.managedAccess = vi.fn(async () => ({
    title: 'مدیر',
    permissionIds: [],
    permissionCodes: [],
    screenIds: [],
    deniedControlIds: [],
    managed: true,
    canAssignAll: true,
  }));
  const tx = {};
  service.database = {
    client: {
      $transaction: vi.fn(async (fn: (tx: object) => Promise<string>) =>
        fn(tx),
      ),
    },
  };
  service.personalAccessRole = vi.fn(async () => 'role');
  service.audit = vi.fn();
  return { service, tx };
}
describe('job role defaults', () => {
  it('validates custom manual names without granting privileges from their title', async () => {
    const service = Object.create(IamService.prototype);
    service.isSystemAdministrator = vi.fn(async () => true);
    service.database = {
      client: { permission: { findMany: vi.fn(async () => []) } },
    };
    const profile = await service.managedAccess(
      {
        accessTitle: 'نقش سفارشی',
        manualAccessV3: true,
        permissionIds: [],
        screenIds: [],
        deniedControlIds: [],
      },
      { userId: 'actor' },
    );
    expect(profile.title).toBe('نقش سفارشی');
    expect(profile.permissionCodes).toEqual([]);
    expect(profile.screenIds).toEqual([]);
    await expect(
      service.managedAccess(
        {
          accessTitle: ' '.repeat(5),
          manualAccessV3: true,
          permissionIds: [],
          screenIds: [],
        },
        {},
      ),
    ).rejects.toThrow();
  });
  it('uses distinct bounded keys for custom role names rather than index minus one', async () => {
    const { service } = setup();
    for (const title of ['کارشناس فروش ویژه', 'مدیر پشتیبانی شعبه']) {
      service.managedAccess.mockResolvedValue({
        title,
        permissionIds: [],
        permissionCodes: [],
        screenIds: [],
        deniedControlIds: [],
        managed: true,
        canAssignAll: true,
      });
      await service.saveRoleTemplate(
        {
          accessTitle: title,
          permissionIds: [],
          screenIds: [],
          deniedControlIds: [],
        },
        { userId: 'actor' },
        {},
      );
    }
    const keys = service.personalAccessRole.mock.calls.map(
      (call: unknown[]) => call[1],
    );
    expect(keys[0]).not.toBe(keys[1]);
    for (const key of keys) expect(key).toMatch(/^template-job-[a-f0-9]{32}$/);
  });
  it('rejects nonadministrators before changing any grants', async () => {
    const { service } = setup(false);
    await expect(service.saveRoleTemplate({}, {}, {})).rejects.toThrow();
    expect(service.managedAccess).not.toHaveBeenCalled();
  });
  it('validates managed access and saves an unassigned template in a transaction', async () => {
    const { service, tx } = setup();
    const dto = {
      accessTitle: 'مدیر',
      permissionIds: [],
      screenIds: [],
      deniedControlIds: [],
    };
    await service.saveRoleTemplate(dto, { userId: 'actor' }, {});
    expect(service.managedAccess).toHaveBeenCalledWith(
      { ...dto, manualAccessV3: true },
      { userId: 'actor' },
    );
    expect(service.personalAccessRole).toHaveBeenCalledWith(
      tx,
      expect.stringMatching(/^template-job-/),
      expect.objectContaining({ title: 'مدیر' }),
      { userId: 'actor' },
    );
    expect(service.audit).toHaveBeenCalledWith(
      'actor',
      'iam.role.template.update',
      'Role',
      'role',
      'SUCCESS',
      {},
    );
  });
  it('requires an explicit restriction list', async () => {
    const { service } = setup();
    await expect(
      service.saveRoleTemplate({ accessTitle: 'مدیر' }, {}, {}),
    ).rejects.toThrow();
    expect(service.personalAccessRole).not.toHaveBeenCalled();
  });
});
