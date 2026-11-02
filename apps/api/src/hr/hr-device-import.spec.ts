import { describe, it, expect, vi } from 'vitest';
import { HrService } from './hr.service';
import type { AuthenticatedActor } from '@nora/contracts';
const branch = '11111111-1111-4111-a111-111111111111';
const actor: AuthenticatedActor = {
  userId: '22222222-2222-4222-a222-222222222222',
  sessionId: 'session',
  branchIds: [branch],
  permissions: ['hr.manage'],
};
function fixture(closed = false) {
  const records = new Map<string, Record<string, unknown>>();
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    hrEmployee: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'employee',
          personnelCode: '0012',
          name: 'Synthetic',
          branchId: branch,
        },
      ]),
    },
    hrRecord: {
      findMany: vi
        .fn()
        .mockResolvedValue(
          closed ? [{ values: ['closed', '2026-11-01', '2026-11-01'] }] : [],
        ),
      findUnique: vi.fn(async ({ where }) => records.get(where.id) ?? null),
      create: vi.fn(async ({ data }) => {
        records.set(data.id, data);
        return data;
      }),
      update: vi.fn(async ({ where, data }) => {
        const result = { ...records.get(where.id), ...data };
        records.set(where.id, result);
        return result;
      }),
    },
    hrCommand: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    },
    hrAuditEvent: { create: vi.fn().mockResolvedValue({}) },
    hrNotification: { create: vi.fn().mockResolvedValue({}) },
  };
  const client = { $transaction: vi.fn(async (work) => work(tx)) };
  const hr = new HrService(
    { client } as never,
    {} as never,
    {} as never,
    {} as never,
  );
  const input = {
    branchId: branch,
    source: 'synthetic-source',
    punches: [
      {
        id: '1',
        personnelCode: '0012',
        date: '2026-11-01',
        time: '09:20',
        kind: 'اعلام حضور',
        accepted: true,
      },
    ],
  };
  return { hr, tx, records, input };
}
describe('trusted HR device import', () => {
  it('matches exact personnel code including leading zeros and remains idempotent across polls', async () => {
    const f = fixture();
    expect(
      await f.hr.importDevicePunches(f.input, 'first-key', actor),
    ).toMatchObject({ imported: 1, unmatched: 0 });
    expect(
      await f.hr.importDevicePunches(f.input, 'second-key', actor),
    ).toMatchObject({ imported: 0, unchanged: 1 });
    expect(f.tx.hrRecord.create).toHaveBeenCalledTimes(1);
    expect([...f.records.values()][0]).toMatchObject({
      branchId: branch,
      employeeId: 'employee',
      data: { sourceRecordId: '1' },
    });
  });
  it('does not map a different or unknown code by name or provider user ID', async () => {
    const f = fixture();
    f.input.punches[0]!.personnelCode = '12';
    expect(
      await f.hr.importDevicePunches(f.input, 'unmapped-key', actor),
    ).toMatchObject({ imported: 0, unmatched: 1 });
    expect(f.tx.hrRecord.create).not.toHaveBeenCalled();
  });
  it('preserves closed periods and does not insert punches', async () => {
    const f = fixture(true);
    expect(
      await f.hr.importDevicePunches(f.input, 'closed-key', actor),
    ).toMatchObject({ imported: 0, closed: 1 });
    expect(f.tx.hrRecord.create).not.toHaveBeenCalled();
  });
  it('does not resurrect an archived imported punch', async () => {
    const f = fixture();
    await f.hr.importDevicePunches(f.input, 'initial-key', actor);
    const row = [...f.records.values()][0]!;
    row.deletedAt = new Date();
    expect(
      await f.hr.importDevicePunches(f.input, 'archived-key', actor),
    ).toMatchObject({ imported: 0, unchanged: 1 });
    expect(f.tx.hrRecord.update).not.toHaveBeenCalled();
  });
  it('denies another branch before reading or writing HR data', async () => {
    const f = fixture();
    await expect(
      f.hr.importDevicePunches(f.input, 'foreign-key', {
        ...actor,
        branchIds: [],
      }),
    ).rejects.toThrow();
    expect(f.tx.hrEmployee.findMany).not.toHaveBeenCalled();
  });
});

it('rejects ambiguous normalized personnel codes', async () => {
  const f = fixture();
  f.tx.hrEmployee.findMany.mockResolvedValue([
    { id: 'a', personnelCode: '0012', name: 'Synthetic', branchId: branch },
    { id: 'b', personnelCode: '۰۰۱۲', name: 'Synthetic', branchId: branch },
  ]);
  await expect(
    f.hr.importDevicePunches(f.input, 'ambiguous-key', actor),
  ).rejects.toThrow();
  expect(f.tx.hrRecord.create).not.toHaveBeenCalled();
});

it('retains device punches after the shift end even with zero assigned template buffers', () => {
  const shift = {
    id: 'shift',
    tab: 'shift',
    employeeId: 'e',
    status: 'فعال',
    values: [
      'day',
      '09:15',
      '17:00',
      '0',
      '',
      '',
      '',
      '2026-11-01',
      '2026-11-01',
    ],
    data: {
      shiftEndDayOffset: 0,
      attendanceBeforeHours: 0,
      attendanceAfterHours: 0,
    },
  };
  const punch = (time: string) => ({
    tab: 'checkins',
    employeeId: 'e',
    parentId: null,
    values: ['Synthetic', '2026-11-01', time, 'اعلام حضور'],
    data: { attendanceSource: 'synthetic' },
    createdAt: new Date(),
  });
  const view = (
    HrService.prototype as unknown as {
      attendanceView: (
        s: unknown[],
        e: string,
        d: string,
      ) => {
        result: { worked: number; exceptions: string[] };
        events: { kind: string; at: Date }[];
      };
    }
  ).attendanceView.call(
    {},
    [shift, punch('09:20'), punch('18:00')],
    'e',
    '2026-11-01',
  );
  expect(view.events.map((e) => e.kind)).toEqual(['ورود', 'خروج']);
  expect(view.result.worked).toBe(520);
  expect(view.result.exceptions).toEqual([]);
});

it('bounds raw punch reads around the work date so historical accumulation cannot exhaust calculation limits', async () => {
  const f = fixture();
  f.tx.hrEmployee.findMany.mockResolvedValue([]);
  await f.hr.processAttendance(
    { branchId: branch, date: '2026-11-01' },
    'bounded-key',
    actor,
    true,
  );
  const calls = f.tx.hrRecord.findMany.mock.calls as unknown as [
    { where: { OR?: { tab?: string; AND?: unknown[] }[] } },
  ][];
  const source = calls.find(([q]) => q.where.OR)?.[0];
  expect(source?.where.OR?.find((q) => q.tab === 'checkins')?.AND).toEqual([
    { values: { path: ['1'], gte: '2026-10-30' } },
    { values: { path: ['1'], lte: '2026-11-05' } },
  ]);
});

it('moves a source ID once and requests recalculation of its old employee/day', async () => {
  const f = fixture();
  await f.hr.importDevicePunches(f.input, 'before-key', actor);
  f.input.punches[0]!.date = '2026-11-02';
  const result = await f.hr.importDevicePunches(f.input, 'after-key', actor);
  expect(result.reconcile).toEqual([
    { date: '2026-11-01', employeeId: 'employee' },
  ]);
  expect(result.dates).toEqual(['2026-11-01', '2026-11-02']);
  expect(f.records.size).toBe(1);
  expect(
    await f.hr.importDevicePunches(f.input, 'repeat-key', actor),
  ).toMatchObject({
    imported: 0,
    unchanged: 1,
    reconcile: [{ date: '2026-11-01', employeeId: 'employee' }],
  });
});

it('clears stale derived presence on the old date without creating absence for unrelated employees', async () => {
  const f = fixture();
  f.records.set('daily', {
    id: 'daily',
    employeeId: 'employee',
    values: ['Synthetic', '2026-11-01', 'day', '8:00', '5', '0'],
    data: { firstIn: '2026-11-01T05:50:00Z', workedMinutes: 480 },
    status: 'حاضر',
    version: 1,
  });
  f.tx.hrRecord.findMany.mockImplementation(async (...args: unknown[]) => {
    const q = args[0] as { where: { OR?: unknown; tab?: string } };
    if (q.where.OR)
      return [
        {
          id: 'hours',
          tab: 'workingHours',
          status: 'فعال',
          values: ['day', '', '09:15', '17:00', 'همان روز', '0', '0'],
          data: {},
        },
      ] as never;
    return q.where.tab === 'attendance'
      ? ([f.records.get('daily')] as never)
      : [];
  });
  await f.hr.processAttendance(
    { branchId: branch, date: '2026-11-01' },
    'reconcile-key',
    actor,
    true,
    ['employee'],
  );
  expect(f.records.get('daily')?.deletedAt).toBeInstanceOf(Date);
  expect(f.records.get('daily')?.status).toBe('حاضر');
  expect(f.tx.hrRecord.create).not.toHaveBeenCalled();
});

it('persists a sortable work date and repairs missing legacy dates even when metrics are unchanged', async () => {
  const f = fixture();
  const source = [
    {
      id: 'hours',
      tab: 'workingHours',
      status: 'فعال',
      values: ['day', '', '09:15', '17:00', 'همان روز', '0', '0'],
      data: {},
    },
    ...['09:20', '17:40'].map((time, i) => ({
      id: `punch-${i}`,
      tab: 'checkins',
      employeeId: 'employee',
      parentId: null,
      values: ['Synthetic', '2026-11-01', time, 'اعلام حضور'],
      data: { attendanceSource: 'synthetic' },
      createdAt: new Date(),
    })),
  ];
  f.tx.hrRecord.findMany.mockImplementation(async (...args: unknown[]) => {
    const q = args[0] as { where: { OR?: unknown; tab?: string } };
    if (q.where.OR) return source as never;
    return q.where.tab === 'attendance' && f.records.has('daily')
      ? ([f.records.get('daily')] as never)
      : [];
  });
  const run = (key: string) =>
    f.hr.processAttendance(
      { branchId: branch, date: '2026-11-01' },
      key,
      actor,
      true,
    );
  await run('create-date-key');
  const created = f.tx.hrRecord.create.mock.calls.at(-1)![0].data;
  expect(created.effectiveAt).toBeInstanceOf(Date);
  const expectedDate = created.effectiveAt;
  f.records.set('daily', {
    ...created,
    id: 'daily',
    effectiveAt: null,
    version: 1,
  });
  await run('repair-date-key');
  expect(f.tx.hrRecord.update).toHaveBeenCalledTimes(1);
  expect(f.records.get('daily')?.effectiveAt).toEqual(expectedDate);
  await run('repeat-date-key');
  expect(f.tx.hrRecord.update).toHaveBeenCalledTimes(1);
});
