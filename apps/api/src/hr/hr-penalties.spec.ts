import { describe, expect, it, vi } from 'vitest';
import { HrService } from './hr.service';
const policy = {
  id: 'policy',
  tab: 'penaltySettings',
  status: 'فعال',
  values: ['50000', '60000', '2026-11-01', 'بله', 'بله', 'بله'],
  updatedAt: new Date(),
};
function setup(extra: unknown[] = [], values = policy.values) {
  const source = [{ ...policy, values }, ...extra];
  const service = new HrService(
    {
      client: { hrRecord: { findMany: vi.fn().mockResolvedValue(source) } },
    } as never,
    {} as never,
    {} as never,
    {} as never,
  );
  const internal = service as unknown as {
    dailyPenalty: (row: unknown) => Promise<string | null>;
    attendanceView: () => unknown;
    dailyAttendanceAmounts: (
      row: unknown,
      includeOvertime: boolean,
    ) => Promise<unknown>;
  };
  internal.attendanceView = () => ({
    shiftStart: new Date('2026-11-08T05:30:00Z'),
    shiftEnd: new Date('2026-11-08T13:30:00Z'),
    shiftValues: ['', '', '', '0'],
    events: [
      { kind: 'ورود', at: new Date('2026-11-08T05:40:00Z') },
      { kind: 'خروج', at: new Date('2026-11-08T13:25:00Z') },
    ],
    selected: [{ parentId: 'correction' }],
  });
  const row = {
    section: 'time',
    tab: 'attendance',
    branchId: 'branch',
    employeeId: 'person',
    values: ['', '2026-11-08'],
    data: { overtimeMinutes: 30, deficitMinutes: 15 },
  };
  return Object.assign(() => internal.dailyPenalty(row), {
    amounts: () => internal.dailyAttendanceAmounts(row, true),
  });
}
describe('daily attendance penalties', () => {
  it('uses separate Toman rates with exact arithmetic', async () =>
    expect(await setup()()).toBe('800000'));
  it('uses the configured rates for the recorded overtime and deficit minutes', async () => {
    const values = [...policy.values, '7500', '2000'];
    expect(await setup([], values).amounts()).toEqual({
      overtimeAmountToman: '225000',
      dailyPenaltyToman: '30000',
    });
  });
  it('does not apply a future policy', async () =>
    expect(
      await setup([], ['50000', '60000', '2026-12-01', 'بله', 'بله', 'بله'])(),
    ).toBeNull());
  it('exempts only approved hourly leave intervals', async () => {
    const leave = {
      employeeId: 'person',
      tab: 'radanLeave',
      status: 'تأییدشده',
      values: ['', '', '', '', 'ساعتی'],
      data: {
        startsAt: '2026-11-08T05:30:00Z',
        endsAt: '2026-11-08T05:40:00Z',
      },
    };
    expect(await setup([leave])()).toBe('300000');
    expect(await setup([{ ...leave, status: 'در انتظار تأیید' }])()).toBe(
      '800000',
    );
    expect(
      await setup(
        [leave],
        ['50000', '60000', '2026-11-01', 'بله', 'خیر', 'بله'],
      )(),
    ).toBe('800000');
  });
  it('exempts a confirmed device-error correction only when enabled', async () => {
    const correction = {
      id: 'correction',
      employeeId: 'person',
      tab: 'corrections',
      status: 'تأییدشده',
      data: { attendanceDeviceError: true },
    };
    expect(await setup([correction])()).toBe('0');
    expect(
      await setup(
        [correction],
        ['50000', '60000', '2026-11-01', 'بله', 'بله', 'خیر'],
      )(),
    ).toBe('800000');
  });
  it('applies approved mission coverage without double-counting overlapping exemptions', async () => {
    const mission = {
      employeeId: 'person',
      tab: 'mission',
      status: 'تأییدشده',
      values: [],
      data: {
        startsAt: '2026-11-08T05:30:00Z',
        endsAt: '2026-11-08T05:40:00Z',
      },
    };
    expect(await setup([mission, mission])()).toBe('300000');
  });
});
