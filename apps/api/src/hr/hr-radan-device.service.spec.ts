import { RadanDeviceClient } from './hr-radan-device.client';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { HrRadanDeviceService } from './hr-radan-device.service';
import type { AuthenticatedActor } from '@nora/contracts';
const actor: AuthenticatedActor = {
  userId: 'u',
  sessionId: 's',
  permissions: ['hr.manage'],
  branchIds: ['branch'],
};

function dualSource() {
  for (const [key, value] of Object.entries({
    HR_RADAN_BRANCH_ID: 'branch',
    HR_RADAN_BASE_URL: 'http://one',
    HR_RADAN_USERNAME: 'synthetic',
    HR_RADAN_PASSWORD: 'synthetic',
    HR_RADAN_SECONDARY_BRANCH_ID: 'second',
    HR_RADAN_SECONDARY_BASE_URL: 'http://two',
  }))
    vi.stubEnv(key, value);
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-04T12:00:00Z'));
  vi.spyOn(RadanDeviceClient.prototype, 'login').mockResolvedValue(undefined);
  vi.spyOn(RadanDeviceClient.prototype, 'list').mockImplementation(
    async (path) =>
      (path === '/V1/Users'
        ? [{ id: 1, profile: { personnel_id: '2001' } }]
        : [
            {
              id: 1,
              user_id: 1,
              datetime: '2026-11-03 09:30:00',
              entry_type: 'in',
              status: 'accepted',
            },
          ]) as never,
  );
  const hr = {
    importDevicePunches: vi.fn().mockResolvedValue({
      imported: 1,
      unchanged: 0,
      unmatched: 0,
      closed: 0,
      dates: [],
    }),
    processAttendance: vi.fn(),
  };
  return { hr, service: new HrRadanDeviceService(hr as never, {} as never) };
}

it('isolates identical source IDs and personnel codes by branch and date policy', async () => {
  const { hr, service } = dualSource();
  const result = await service.sync({
    ...actor,
    branchIds: ['branch', 'second'],
  });
  expect(result.state).toBe('ready');
  expect(
    hr.importDevicePunches.mock.calls.map(([input]) => ({
      branchId: input.branchId,
      source: input.source,
      date: input.punches[0].date,
    })),
  ).toEqual([
    { branchId: 'branch', source: 'radan:branch', date: '2026-11-04' },
    {
      branchId: 'second',
      source: 'radan:secondary:second',
      date: '2026-11-03',
    },
  ]);
  expect(service.status(actor)).toMatchObject({
    sources: [expect.objectContaining({ branchId: 'branch' })],
  });
});

it('continues the second source after a provider fails', async () => {
  const { service, hr } = dualSource();
  vi.mocked(RadanDeviceClient.prototype.login).mockRejectedValueOnce(
    new Error('offline'),
  );
  expect(
    await service.sync({ ...actor, branchIds: ['branch', 'second'] }),
  ).toMatchObject({ state: 'partial' });
  expect(hr.importDevicePunches).toHaveBeenCalledTimes(1);
  expect(hr.importDevicePunches.mock.calls[0]![0].branchId).toBe('second');
});

it('fetches only the branch authorized for the caller', async () => {
  const { service, hr } = dualSource();
  await service.sync({ ...actor, branchIds: ['second'] });
  expect(hr.importDevicePunches).toHaveBeenCalledTimes(1);
  expect(hr.importDevicePunches.mock.calls[0]![0].branchId).toBe('second');
  expect(service.status(actor)).toMatchObject({ state: 'idle' });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it('allows two providers for the same branch but skips non-allowlisted secondary personnel', async () => {
  const { service, hr } = dualSource();
  vi.stubEnv('HR_RADAN_SECONDARY_BRANCH_ID', 'branch');
  vi.stubEnv('HR_RADAN_SECONDARY_PERSONNEL_CODES', '2003,2004');
  vi.mocked(RadanDeviceClient.prototype.list).mockImplementation(
    async (path) =>
      (path === '/V1/Users'
        ? [
            { id: 1, profile: { personnel_id: '2001' } },
            { id: 2, profile: { personnel_id: '2003' } },
          ]
        : [1, 2].map((id) => ({
            id,
            user_id: id,
            datetime: '2026-11-03 09:30:00',
            entry_type: 'in',
            status: 'accepted',
          }))) as never,
  );
  await service.sync(actor);
  const calls = hr.importDevicePunches.mock.calls.map(([input]) => input);
  expect(calls[0].source).toBe('radan:branch');
  expect(calls[0].punches).toHaveLength(2);
  expect(calls[1].source).toBe('radan:secondary:branch');
  expect(calls[1].branchId).toBe('branch');
  expect(calls[1].punches).toEqual([
    expect.objectContaining({ personnelCode: '2003', date: '2026-11-03' }),
  ]);
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

it('catches up at startup and polls every minute throughout the day', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-01T05:29:00Z'));
  vi.stubEnv('HR_RADAN_ENABLED', 'true');
  vi.stubEnv('HR_RADAN_BRANCH_ID', 'branch');
  const iam = {
    authenticateAttendanceConnectorV1: vi.fn().mockResolvedValue(actor),
  };
  const service = new HrRadanDeviceService({} as never, iam as never);
  const sync = vi.spyOn(service, 'sync').mockResolvedValue({ state: 'ready' });
  service.onModuleInit();
  await vi.advanceTimersByTimeAsync(0);
  expect(sync).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(60000);
  expect(sync).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(60 * 60000);
  expect(sync).toHaveBeenCalledTimes(62);
  await vi.advanceTimersByTimeAsync(59 * 60000);
  expect(sync).toHaveBeenCalledTimes(121);
  await vi.advanceTimersByTimeAsync(60000);
  expect(sync).toHaveBeenCalledTimes(122);
  service.onModuleDestroy();
  await vi.advanceTimersByTimeAsync(3600000);
  expect(sync).toHaveBeenCalledTimes(122);
});
it('retries at the next minute after failure', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-01T13:29:00Z'));
  vi.stubEnv('HR_RADAN_ENABLED', 'true');
  vi.stubEnv('HR_RADAN_BRANCH_ID', 'branch');
  const iam = {
    authenticateAttendanceConnectorV1: vi
      .fn()
      .mockRejectedValue(new Error('synthetic')),
  };
  const service = new HrRadanDeviceService({} as never, iam as never);
  service.onModuleInit();
  await vi.advanceTimersByTimeAsync(60000);
  expect(service.status(actor)).toMatchObject({
    state: 'error',
    nextSyncAt: '2026-11-01T13:31:00.000Z',
  });
  await vi.advanceTimersByTimeAsync(14 * 60000);
  expect(iam.authenticateAttendanceConnectorV1).toHaveBeenCalledTimes(16);
  await vi.advanceTimersByTimeAsync(60000);
  expect(iam.authenticateAttendanceConnectorV1).toHaveBeenCalledTimes(17);
  service.onModuleDestroy();
});

it('normalizes the raw provider date once and reconciles both affected days', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-02T12:00:00Z'));
  for (const [key, value] of Object.entries({
    HR_RADAN_BRANCH_ID: 'branch',
    HR_RADAN_BASE_URL: 'http://localhost:2222',
    HR_RADAN_USERNAME: 'synthetic',
    HR_RADAN_PASSWORD: 'synthetic',
  }))
    vi.stubEnv(key, value);
  vi.spyOn(RadanDeviceClient.prototype, 'login').mockResolvedValue(undefined);
  vi.spyOn(RadanDeviceClient.prototype, 'list').mockImplementation(
    async (path) =>
      (path === '/V1/Users'
        ? [{ id: 1, profile: { personnel_id: '0012' } }]
        : [
            {
              id: 7,
              user_id: 1,
              datetime: '2026-11-01 09:20:00',
              entry_type: 'in',
              status: 'accepted',
              type_id: 159,
            },
          ]) as never,
  );
  const hr = {
    importDevicePunches: vi.fn().mockResolvedValue({
      imported: 1,
      unchanged: 0,
      unmatched: 0,
      closed: 0,
      dates: ['2026-11-01', '2026-11-02'],
      reconcile: [{ date: '2026-11-01', employeeId: 'e' }],
    }),
    processAttendance: vi.fn().mockResolvedValue({}),
  };
  const service = new HrRadanDeviceService(hr as never, {} as never);
  await service.sync(actor);
  await service.sync(actor);
  for (const [input] of hr.importDevicePunches.mock.calls)
    expect(input.punches[0]).toMatchObject({
      id: '7',
      date: '2026-11-02',
      time: '09:20',
    });
  expect(hr.processAttendance).toHaveBeenCalledWith(
    { branchId: 'branch', date: '2026-11-01' },
    expect.any(String),
    actor,
    true,
    ['e'],
  );
});

it('recovers attendance synchronization on a later valid login without restarting the API', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-01T05:29:00Z'));
  vi.stubEnv('HR_RADAN_ENABLED', 'true');
  vi.stubEnv('HR_RADAN_BRANCH_ID', 'branch');
  vi.stubEnv('HR_RADAN_ACTOR_ID', 'configured-actor');
  const iam = {
    authenticateAttendanceConnectorV1: vi
      .fn()
      .mockRejectedValueOnce(new Error('no active session'))
      .mockResolvedValue(actor),
  };
  const service = new HrRadanDeviceService({} as never, iam as never);
  const sync = vi.spyOn(service, 'sync').mockResolvedValue({ state: 'ready' });
  service.onModuleInit();
  await vi.advanceTimersByTimeAsync(0);
  expect(sync).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(60000);
  expect(sync).toHaveBeenCalledOnce();
  expect(iam.authenticateAttendanceConnectorV1).toHaveBeenLastCalledWith(
    'configured-actor',
  );
  service.onModuleDestroy();
});

it('uses a bounded recent window between successful hourly reconciliations', async () => {
  const { service, hr } = dualSource();
  await service.sync(actor, true);
  expect(vi.mocked(RadanDeviceClient.prototype.list).mock.calls.at(-1)).toEqual(
    ['/V1/Ta/Clockings', 'clockings', undefined],
  );
  hr.processAttendance.mockClear();
  await service.sync(actor, true);
  expect(vi.mocked(RadanDeviceClient.prototype.list).mock.calls.at(-1)).toEqual(
    ['/V1/Ta/Clockings', 'clockings', '2026-11-02'],
  );
  expect(hr.processAttendance.mock.calls.map(([input]) => input.date)).toEqual([
    '2026-11-03',
    '2026-11-04',
  ]);
  vi.setSystemTime(new Date('2026-11-04T13:00:00Z'));
  await service.sync(actor, true);
  expect(vi.mocked(RadanDeviceClient.prototype.list).mock.calls.at(-1)).toEqual(
    ['/V1/Ta/Clockings', 'clockings', undefined],
  );
});
it('never overlaps a long-running scheduled pull and stops after destruction', async () => {
  vi.useFakeTimers();
  vi.stubEnv('HR_RADAN_ENABLED', 'true');
  const service = new HrRadanDeviceService(
    {} as never,
    {
      authenticateAttendanceConnectorV1: vi.fn().mockResolvedValue(actor),
    } as never,
  );
  let finish!: (value: Record<string, unknown>) => void;
  const sync = vi.spyOn(service, 'sync').mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  service.onModuleInit();
  await vi.advanceTimersByTimeAsync(180000);
  expect(sync).toHaveBeenCalledOnce();
  service.onModuleDestroy();
  finish({ state: 'ready' });
  await vi.advanceTimersByTimeAsync(120000);
  expect(sync).toHaveBeenCalledOnce();
});

it('honors the confirmed source date correction only from its configured cutover', async () => {
  const { service, hr } = dualSource();
  vi.stubEnv('HR_RADAN_DATE_CORRECTED_FROM', '2026-11-04');
  vi.mocked(RadanDeviceClient.prototype.list).mockImplementation(
    async (path) =>
      (path === '/V1/Users'
        ? [{ id: 1, profile: { personnel_id: '2001' } }]
        : [
            {
              id: 1,
              user_id: 1,
              datetime: '2026-11-03 09:30:00',
              entry_type: 'in',
              status: 'accepted',
            },
            {
              id: 2,
              user_id: 1,
              datetime: '2026-11-04 09:30:00',
              entry_type: 'in',
              status: 'accepted',
            },
          ]) as never,
  );
  await service.sync(actor);
  expect(
    hr.importDevicePunches.mock.calls[0]![0].punches.map(
      (p: { date: string }) => p.date,
    ),
  ).toEqual(['2026-11-04', '2026-11-04']);
});
