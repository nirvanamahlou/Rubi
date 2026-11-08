import { expect, it, vi } from 'vitest';
import { HrService } from './hr.service';
const id = '11111111-1111-4111-8111-111111111111';
function fixture() {
  const attendance = {
    id,
    section: 'time',
    tab: 'attendance',
    employeeId: id,
    branchId: id,
    values: ['Employee', '2026-11-08'],
    version: 1,
  };
  const tx = {
    hrRecord: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn().mockImplementation(async ({ data }) => ({
        id: 'correction',
        ...data,
      })),
    },
  };
  const effects = vi.fn();
  const service = Object.assign(Object.create(HrService.prototype), {
    database: { client: tx },
    canManuallyEditAttendance: vi.fn().mockResolvedValue(true),
    command: async (
      _a: unknown,
      _k: unknown,
      _i: unknown,
      fn: (t: unknown) => unknown,
    ) => fn(tx),
    record: vi.fn().mockResolvedValue(attendance),
    assertOpenPeriod: vi.fn(),
    employee: vi.fn().mockResolvedValue({ id, name: 'Employee' }),
    effects,
    audit: vi.fn(),
    processAttendance: vi.fn(),
    recordDto: (row: unknown) => row,
  }) as HrService;
  return { service, tx, effects };
}
it.each([
  [{ arrival: '09:20' }, 'startsAt', 'endsAt'],
  [{ departure: '17:00' }, 'endsAt', 'startsAt'],
] as const)(
  'accepts one clock and an omitted reason (%j)',
  async (input, present, absent) => {
    const { service, tx, effects } = fixture();
    await service.editAttendance(
      id,
      { version: 1, ...input },
      'key',
      {} as never,
    );
    const data = tx.hrRecord.create.mock.calls[0]![0].data;
    expect(data.data[present]).toBeTruthy();
    expect(data.data[absent]).toBeUndefined();
    expect(data.data.reason).toBe('');
    expect(effects).toHaveBeenCalledOnce();
  },
);
it('accepts all empty fields without inventing a clock or correction', async () => {
  const { service, tx } = fixture();
  await service.editAttendance(
    id,
    { version: 1, arrival: '', departure: '', reason: '' },
    'key',
    {} as never,
  );
  expect(tx.hrRecord.create).not.toHaveBeenCalled();
});
it.each([
  { arrival: 'bad' },
  { departure: '25:00' },
  { arrival: '17:00', departure: '09:00' },
])('rejects invalid supplied times (%j)', async (input) => {
  const { service, tx } = fixture();
  await expect(
    service.editAttendance(id, { version: 1, ...input }, 'key', {} as never),
  ).rejects.toThrow();
  expect(tx.hrRecord.create).not.toHaveBeenCalled();
});
it('preserves optimistic concurrency for optional fields', async () => {
  const { service, tx } = fixture();
  tx.hrRecord.updateMany.mockResolvedValue({ count: 0 });
  await expect(
    service.editAttendance(
      id,
      { version: 1, arrival: '09:20' },
      'key',
      {} as never,
    ),
  ).rejects.toThrow('نسخه');
});
it.each(['startsAt', 'endsAt'] as const)(
  'applies only the supplied %s correction punch',
  async (clock) => {
    const { service, tx } = fixture();
    const update = vi.fn().mockResolvedValue({});
    Object.assign(tx.hrRecord, { update });
    const effects = (
      HrService.prototype as unknown as {
        effects: (...args: unknown[]) => Promise<void>;
      }
    ).effects;
    await effects.call(
      service,
      tx,
      {
        id: 'correction',
        branchId: id,
        values: ['Employee', '2026-11-08'],
        data: { [clock]: '2026-11-08T06:00:00.000Z' },
      },
      { key: 'time.corrections' },
      {},
      { id, name: 'Employee' },
    );
    expect(tx.hrRecord.create).toHaveBeenCalledOnce();
    expect(tx.hrRecord.create.mock.calls[0]![0].data.values[3]).toBe(
      clock === 'startsAt' ? 'ورود' : 'خروج',
    );
    expect(update).toHaveBeenCalledOnce();
  },
);
