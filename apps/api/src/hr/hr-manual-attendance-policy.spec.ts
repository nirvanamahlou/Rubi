import { afterEach, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import { canEditAttendance } from './hr-manual-attendance-policy';
import { HrService } from './hr.service';
const actor: AuthenticatedActor = {
  userId: 'allowed-user',
  sessionId: 'session',
  branchIds: [],
  permissions: ['hr.manage', 'hr.approve'],
};
afterEach(() => vi.unstubAllEnvs());
it('allows only demo and nima with HR management permission', () => {
  expect(canEditAttendance(actor, '')).toBe(false);
  expect(canEditAttendance(actor, 'another-user')).toBe(false);
  expect(canEditAttendance({ ...actor, permissions: [] }, actor.userId)).toBe(
    false,
  );
  expect(canEditAttendance(actor, 'demo')).toBe(true);
  expect(canEditAttendance(actor, 'nima')).toBe(true);
  expect(canEditAttendance(actor, 'original')).toBe(false);
});
it('rejects an unauthorized manual correction before reading or writing records', async () => {
  vi.stubEnv('HR_MANUAL_ATTENDANCE_USER_ID', 'another-user');
  const database = { client: { hrRecord: { findUnique: vi.fn() } } };
  const service = new HrService(
    database as never,
    {
      describeMessagingParticipants: vi
        .fn()
        .mockResolvedValue([{ id: actor.userId, username: 'other' }]),
    } as never,
    {} as never,
    {} as never,
  );
  await expect(service.editAttendance('id', {}, 'key', actor)).rejects.toThrow(
    'ویرایش دستی',
  );
  expect(database.client.hrRecord.findUnique).not.toHaveBeenCalled();
});

it('accepts a lone clock and allows metadata edits without rewriting punches', async () => {
  const id = '22222222-2222-4222-a222-222222222222';
  const date = '2026-11-03';
  const day = {
    id,
    version: 1,
    section: 'time',
    tab: 'attendance',
    branchId: 'branch',
    employeeId: 'employee',
    values: ['Synthetic', date],
    data: {},
  };
  const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
    ...data,
    id: 'correction',
  }));
  const updateMany = vi.fn().mockResolvedValue({ count: 1 });
  const tx = { hrRecord: { create, updateMany, update: vi.fn() } };
  const service = new HrService(
    { client: tx } as never,
    {} as never,
    {} as never,
    {} as never,
  );
  const processAttendance = vi.fn();
  Object.assign(service, {
    canManuallyEditAttendance: vi.fn().mockResolvedValue(true),
    command: async (
      _actor: unknown,
      _key: unknown,
      _input: unknown,
      work: (db: typeof tx) => unknown,
    ) => work(tx),
    record: vi.fn().mockResolvedValue(day),
    recordDto: (row: unknown) => row,
    employee: vi.fn().mockResolvedValue({ id: 'employee', name: 'Synthetic' }),
    assertOpenPeriod: vi.fn(),
    audit: vi.fn(),
    processAttendance,
  });
  await service.editAttendance(
    id,
    { version: 1, arrival: '09:30', departure: '' },
    'synthetic-first',
    actor,
  );
  expect(create).toHaveBeenCalledTimes(2);
  expect(create.mock.calls[0]?.[0].data.data).toEqual({
    startsAt: `${date}T06:00:00.000Z`,
    reason: '',
  });
  expect(create.mock.calls[1]?.[0].data).toMatchObject({
    values: expect.arrayContaining(['ورود']),
  });
  expect(processAttendance).toHaveBeenCalledOnce();
  create.mockClear();
  processAttendance.mockClear();

  await service.editAttendance(
    id,
    { version: 1, reason: 'Synthetic', deviceError: true },
    'synthetic-meta',
    actor,
  );
  expect(create).not.toHaveBeenCalled();
  expect(processAttendance).not.toHaveBeenCalled();
  expect(updateMany).toHaveBeenLastCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ data: { attendanceDeviceError: true } }),
    }),
  );
});
