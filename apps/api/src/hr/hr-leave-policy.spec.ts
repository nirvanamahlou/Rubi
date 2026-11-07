import { describe, expect, it } from 'vitest';
import {
  assertLeaveDeadline,
  assertMonthlyLeaveQuota,
  leavePolicyValues,
  leaveUsage,
  parseMonthlyLeavePolicy,
} from './hr-leave-policy';
const policy = parseMonthlyLeavePolicy([
  'استحقاقی',
  '2.5',
  '8',
  '1',
  '14:00',
  'خیر',
  '0',
])!;
const leave = {
  from: '2026-11-06',
  to: '2026-11-06',
  mode: 'روزانه' as const,
  reason: 'آزمایش مرخصی',
};
describe('monthly leave policy', () => {
  it('requires all quotas and registration deadlines and accepts Persian digits', () => {
    expect(
      parseMonthlyLeavePolicy([
        'استحقاقی',
        '۲.۵',
        '۸',
        '۱',
        '۱۴:۰۰',
        'خیر',
        '۰',
      ]),
    ).toEqual(policy);
    expect(() =>
      parseMonthlyLeavePolicy(['استحقاقی', '', '8', '1', '14:00', 'خیر', '0']),
    ).toThrow();
    expect(() =>
      parseMonthlyLeavePolicy(['استحقاقی', '2', '8', '1', '25:00', 'خیر', '0']),
    ).toThrow();
    expect(
      parseMonthlyLeavePolicy(['old', 'استحقاقی', '30', 'خیر', '0', '1405']),
    ).toBeNull();
    expect(
      leavePolicyValues(['old', 'استحقاقی', '30', 'خیر', '0', '1405']),
    ).toEqual(['استحقاقی', '', '', '1', '0', 'خیر', '0']);
  });
  it('uses integer days for both notice fields and retains legacy cutoff compatibility', () => {
    const numeric = parseMonthlyLeavePolicy([
      'استحقاقی',
      '2',
      '8',
      '1',
      '2',
      'خیر',
      '0',
    ])!;
    expect(numeric.hourlyNoticeDays).toBe(2);
    const hourly = {
      ...leave,
      mode: 'ساعتی' as const,
      startTime: '14:00',
      endTime: '16:00',
    };
    expect(() =>
      assertLeaveDeadline(hourly, numeric, new Date('2026-11-05T08:00:00Z')),
    ).toThrow();
    expect(() =>
      assertLeaveDeadline(hourly, numeric, new Date('2026-11-04T08:00:00Z')),
    ).not.toThrow();
    expect(
      leavePolicyValues(['استحقاقی', '2', '8', '1', '14:00', 'خیر', '0'])[4],
    ).toBe('0');
    expect(() =>
      parseMonthlyLeavePolicy(['استحقاقی', '2', '8', '1', '366', 'خیر', '0']),
    ).toThrow();
  });
  it('uses Tehran calendar days rather than UTC or rolling 24 hours', () => {
    expect(() =>
      assertLeaveDeadline(leave, policy, new Date('2026-11-05T20:29:59Z')),
    ).not.toThrow();
    expect(() =>
      assertLeaveDeadline(leave, policy, new Date('2026-11-05T20:30:00Z')),
    ).toThrow();
  });
  it('allows hourly requests through the exact cutoff, rejects late and past dates', () => {
    const hourly = {
      ...leave,
      mode: 'ساعتی' as const,
      startTime: '14:00',
      endTime: '17:00',
    };
    expect(() =>
      assertLeaveDeadline(hourly, policy, new Date('2026-11-06T10:30:00Z')),
    ).not.toThrow();
    expect(() =>
      assertLeaveDeadline(hourly, policy, new Date('2026-11-06T10:30:01Z')),
    ).toThrow();
    expect(() =>
      assertLeaveDeadline(hourly, policy, new Date('2026-11-07T05:00:00Z')),
    ).toThrow();
  });
  it('counts Jalali months separately and hourly quota independently from daily quota', () => {
    expect([
      ...leaveUsage({
        ...leave,
        from: '2026-11-21',
        to: '2026-11-22',
      }).values(),
    ]).toEqual([1, 1]);
    expect(() =>
      assertMonthlyLeaveQuota(leave, policy, [leave, leave]),
    ).toThrow();
    expect(() =>
      assertMonthlyLeaveQuota(leave, policy, [
        { ...leave, mode: 'ساعتی', startTime: '09:00', endTime: '17:00' },
      ]),
    ).not.toThrow();
    expect(() =>
      assertMonthlyLeaveQuota(
        { ...leave, mode: 'ساعتی', startTime: '14:00', endTime: '17:00' },
        policy,
        [{ ...leave, mode: 'ساعتی', startTime: '09:00', endTime: '15:00' }],
      ),
    ).toThrow();
  });
});
