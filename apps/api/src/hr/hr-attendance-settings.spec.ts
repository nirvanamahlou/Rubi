import { describe, expect, it } from 'vitest';
import { configuredAttendance } from './hr-attendance-settings';

describe('explicit attendance settings', () => {
  const settings = [
    'پیش‌فرض',
    JSON.stringify(['دورکاری ساعتی', 'مأموریت ساعتی']),
    'خیر',
    '480',
    'بله',
    'خیر',
    'بله',
    'بله',
    'بله',
    'تردد',
  ];
  const start = new Date('2026-10-20T05:00:00Z'),
    end = new Date('2026-10-20T13:00:00Z');
  it('credits authorized intervals once even when punches and requests overlap', () => {
    const result = configuredAttendance({
      settings,
      start,
      end,
      worked: 120,
      overtime: 0,
      events: [
        { kind: 'ورود', at: start },
        { kind: 'خروج', at: new Date('2026-10-20T07:00:00Z') },
      ],
      requests: [
        {
          tab: 'remote',
          values: ['', '', '', 'ساعتی'],
          data: {
            startsAt: '2026-10-20T06:00:00Z',
            endsAt: '2026-10-20T09:00:00Z',
          },
        },
        {
          tab: 'remote',
          values: ['', '', '', 'ساعتی'],
          data: {
            startsAt: '2026-10-20T08:00:00Z',
            endsAt: '2026-10-20T09:00:00Z',
          },
        },
      ],
      holiday: false,
    });
    expect(result.worked).toBe(240);
    expect(result.metrics.creditedMinutes).toBe(120);
  });
  it('never credits a mission from another day and de-duplicates outside time', () => {
    const request = {
      tab: 'radanMission',
      values: ['', '', '', '', 'ساعتی'],
      data: {
        startsAt: '2026-10-20T12:00:00Z',
        endsAt: '2026-10-20T14:00:00Z',
      },
    };
    const result = configuredAttendance({
      settings,
      start,
      end,
      worked: 480,
      overtime: 0,
      events: [],
      requests: [
        request,
        request,
        {
          ...request,
          data: {
            startsAt: '2027-10-20T12:00:00Z',
            endsAt: '2027-10-20T14:00:00Z',
          },
        },
      ],
      holiday: false,
    });
    expect(result.metrics.outsideMissionMinutes).toBe(60);
    expect(result.overtime).toBe(60);
  });
  it('does not count unselected components', () => {
    const result = configuredAttendance({
      settings: settings.map((v, i) => (i === 1 ? '[]' : v)),
      start,
      end,
      worked: 0,
      overtime: 0,
      events: [],
      requests: [
        {
          tab: 'remote',
          values: ['', '', '', 'ساعتی'],
          data: { startsAt: start.toISOString(), endsAt: end.toISOString() },
        },
      ],
      holiday: false,
    });
    expect(result.worked).toBe(0);
  });
});
