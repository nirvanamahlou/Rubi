import { describe, it, expect } from 'vitest';
import {
  attendanceScheduleMetrics as metrics,
  resolveDeviceDirections as resolve,
  deviceRecordId,
  workingHoursEnd,
} from './hr-device-attendance.domain';
import { localClockToUtc as at } from './hr.validation';
const date = '2026-11-01';
const start = at(date, '09:15'),
  end = at(date, '17:00');
const event = (time: string, kind = 'اعلام حضور') => ({
  kind,
  at: at(date, time),
});
describe('device attendance interpretation', () => {
  it('alternates neutral punches chronologically and removes exact duplicate readings', () => {
    const events = resolve([event('17:30'), event('09:20'), event('09:20')]);
    expect(events.map((e) => e.kind)).toEqual(['ورود', 'خروج']);
    expect(metrics(events, start, end)).toMatchObject({
      lateMinutes: 5,
      earlyMinutes: 0,
      overtimeMinutes: 30,
      deficitMinutes: 5,
    });
  });
  it('measures early departure in minutes', () =>
    expect(
      metrics(resolve([event('09:15'), event('16:40')]), start, end),
    ).toMatchObject({
      lateMinutes: 0,
      earlyMinutes: 20,
      overtimeMinutes: 0,
      deficitMinutes: 20,
    }));
  it('does not offset lateness against time actually worked after 17:00', () =>
    expect(
      metrics(resolve([event('10:15'), event('18:00')]), start, end),
    ).toMatchObject({
      lateMinutes: 60,
      overtimeMinutes: 60,
      deficitMinutes: 60,
    }));
  it('counts internal breaks as deficit without counting pre-start time as overtime', () =>
    expect(
      metrics(
        resolve([
          event('08:00'),
          event('12:00'),
          event('13:00'),
          event('17:45'),
        ]),
        start,
        end,
      ),
    ).toMatchObject({
      lateMinutes: 0,
      earlyMinutes: 0,
      overtimeMinutes: 45,
      deficitMinutes: 60,
    }));
  it('does not invent an exit, overtime or final deficit for an open day', () =>
    expect(metrics(resolve([event('09:25')]), start, end)).toMatchObject({
      lateMinutes: 10,
      lastOut: null,
      earlyMinutes: null,
      overtimeMinutes: null,
      deficitMinutes: null,
    }));
  it('preserves explicit directions when mixed with neutral readings', () =>
    expect(
      resolve([
        event('09:15', 'ورود'),
        event('12:00'),
        event('13:00'),
        event('17:00', 'خروج'),
      ]).map((e) => e.kind),
    ).toEqual(['ورود', 'خروج', 'ورود', 'خروج']));
  it('supports an overnight configured schedule', () => {
    const events = [
      { kind: 'ورود', at: at(date, '22:05') },
      { kind: 'خروج', at: at('2026-11-02', '06:30') },
    ];
    expect(
      metrics(events, at(date, '22:00'), at('2026-11-02', '06:00')),
    ).toMatchObject({ lateMinutes: 5, overtimeMinutes: 30, deficitMinutes: 5 });
  });
  it('retains branch/source identity and idempotent UUIDs', () => {
    expect(deviceRecordId('source-a', '1')).toBe(
      deviceRecordId('source-a', '1'),
    );
    expect(deviceRecordId('source-a', '1')).not.toBe(
      deviceRecordId('source-b', '1'),
    );
    expect(deviceRecordId('source-a', '1')).toMatch(
      /^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-a[a-f0-9]{3}-[a-f0-9]{12}$/,
    );
  });
});

it('applies the Thursday office end and the independent17:30 overtime boundary', () => {
  expect(workingHoursEnd('2026-11-05', '09:15', '17:00')).toBe('14:00');
  expect(workingHoursEnd('2026-11-04', '09:15', '17:00')).toBe('17:00');
  expect(
    metrics(
      resolve([event('09:20'), event('17:45')]),
      start,
      end,
      0,
      at(date, '17:30'),
    ),
  ).toMatchObject({ lateMinutes: 5, deficitMinutes: 5, overtimeMinutes: 15 });
  expect(
    metrics(
      resolve([event('09:15'), event('17:20')]),
      start,
      end,
      0,
      at(date, '17:30'),
    ).overtimeMinutes,
  ).toBe(0);
  expect(
    metrics(
      resolve([event('09:20'), event('13:50')]),
      start,
      at(date, '14:00'),
      0,
      at(date, '17:30'),
    ),
  ).toMatchObject({
    lateMinutes: 5,
    earlyMinutes: 10,
    deficitMinutes: 15,
    overtimeMinutes: 0,
  });
});
