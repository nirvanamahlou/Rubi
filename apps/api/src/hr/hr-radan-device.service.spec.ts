import { describe, it, expect, vi, afterEach } from 'vitest';
import { HrRadanDeviceService } from './hr-radan-device.service';
import type { AuthenticatedActor } from '@nora/contracts';
const actor: AuthenticatedActor = {
  userId: 'u',
  sessionId: 's',
  permissions: ['hr.manage'],
  branchIds: ['branch'],
};
afterEach(() => vi.unstubAllEnvs());
describe('attendance connector authorization', () => {
  it('rejects a foreign branch and self-only user before provider access', async () => {
    vi.stubEnv('HR_RADAN_BRANCH_ID', 'branch');
    const hr = { importDevicePunches: vi.fn() };
    const service = new HrRadanDeviceService(hr as never, {} as never);
    await expect(
      service.sync({ ...actor, branchIds: ['foreign'] }),
    ).rejects.toThrow();
    await expect(
      service.sync({ ...actor, permissions: ['hr.self'] }),
    ).rejects.toThrow();
    expect(hr.importDevicePunches).not.toHaveBeenCalled();
  });
  it('does not start any timer when disabled', () => {
    vi.stubEnv('HR_RADAN_ENABLED', 'false');
    const service = new HrRadanDeviceService({} as never, {} as never);
    const timer = vi.spyOn(globalThis, 'setInterval');
    service.onModuleInit();
    expect(timer).not.toHaveBeenCalled();
    timer.mockRestore();
  });
});
