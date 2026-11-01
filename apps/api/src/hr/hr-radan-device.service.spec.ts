import { describe, it, expect, vi, afterEach } from 'vitest';
import { HrRadanDeviceService } from './hr-radan-device.service';
import type { AuthenticatedActor } from '@nora/contracts';
const actor: AuthenticatedActor = {
  userId: 'u',
  sessionId: 's',
  permissions: ['hr.manage'],
  branchIds: ['branch'],
};
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
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
    const timer = vi.spyOn(globalThis, 'setTimeout');
    service.onModuleInit();
    expect(timer).not.toHaveBeenCalled();
    timer.mockRestore();
  });
});

it('does not fetch at startup and switches from quarter-hour to hourly slots', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-01T05:29:00Z'));
  vi.stubEnv('HR_RADAN_ENABLED', 'true');
  vi.stubEnv('HR_RADAN_BRANCH_ID', 'branch');
  const iam = {
    authenticateSessionReferenceV1: vi.fn().mockResolvedValue(actor),
  };
  const service = new HrRadanDeviceService({} as never, iam as never);
  const sync = vi.spyOn(service, 'sync').mockResolvedValue({ state: 'ready' });
  service.onModuleInit();
  expect(sync).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(60000);
  expect(sync).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(60 * 60000);
  expect(sync).toHaveBeenCalledTimes(5);
  await vi.advanceTimersByTimeAsync(59 * 60000);
  expect(sync).toHaveBeenCalledTimes(5);
  await vi.advanceTimersByTimeAsync(60000);
  expect(sync).toHaveBeenCalledTimes(6);
  service.onModuleDestroy();
  await vi.advanceTimersByTimeAsync(3600000);
  expect(sync).toHaveBeenCalledTimes(6);
});
it('reschedules at the next clock slot after failure rather than retrying every two minutes', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-01T13:29:00Z'));
  vi.stubEnv('HR_RADAN_ENABLED', 'true');
  vi.stubEnv('HR_RADAN_BRANCH_ID', 'branch');
  const iam = {
    authenticateSessionReferenceV1: vi
      .fn()
      .mockRejectedValue(new Error('synthetic')),
  };
  const service = new HrRadanDeviceService({} as never, iam as never);
  service.onModuleInit();
  await vi.advanceTimersByTimeAsync(60000);
  expect(service.status(actor)).toMatchObject({
    state: 'error',
    nextSyncAt: '2026-11-01T13:45:00.000Z',
  });
  await vi.advanceTimersByTimeAsync(14 * 60000);
  expect(iam.authenticateSessionReferenceV1).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(60000);
  expect(iam.authenticateSessionReferenceV1).toHaveBeenCalledTimes(2);
  service.onModuleDestroy();
});
