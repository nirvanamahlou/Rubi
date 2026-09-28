import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  formatHeaderDate,
  formatHeaderTime,
  headerDateKey,
  headerMinuteKey,
  subscribeHeaderDate,
} from './header-today';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('header today in Tehran', () => {
  it('uses the Tehran day across UTC midnight boundaries', () => {
    expect(headerDateKey(new Date('2026-09-08T20:29:59Z'))).toBe('2026-09-08');
    expect(headerDateKey(new Date('2026-09-08T20:30:00Z'))).toBe('2026-09-09');
  });

  it('uses a minute snapshot without seconds', () => {
    expect(headerMinuteKey(new Date('2026-09-09T05:35:42.987Z'))).toBe(
      '2026-09-09T05:35',
    );
  });

  it('formats only hour and minute in the resolved timezone', () => {
    expect(
      formatHeaderTime(new Date('2026-09-09T05:35:42Z'), {
        locale: 'en-US',
        numberingSystem: 'latn',
        timezone: 'Asia/Tehran',
      }),
    ).toBe('09:05');
  });

  it('shows a Persian date and digits, including Nowruz rollover', () => {
    expect(formatHeaderDate('2026-03-21')).toBe('شنبه ۱ فروردین ۱۴۰۵');
    expect(formatHeaderDate('2026-09-09')).toBe('چهارشنبه ۱۸ شهریور ۱۴۰۵');
    expect(formatHeaderDate('2026-09-09')).not.toMatch(/[0-9]/);
  });

  it('keeps the Persian date in natural RTL order with resolved preferences', () => {
    expect(
      formatHeaderDate('2026-09-23', {
        calendar: 'persian',
        locale: 'fa-IR',
        numberingSystem: 'arabext',
        timezone: 'Asia/Tehran',
      }),
    ).toBe('چهارشنبه ۱ مهر ۱۴۰۵');
  });

  it('uses the resolved display calendar, digits and timezone', () => {
    expect(
      formatHeaderDate('2026-09-09', {
        calendar: 'gregorian',
        locale: 'en-US',
        numberingSystem: 'latn',
        timezone: 'Asia/Dubai',
      }),
    ).toContain('September 9, 2026');
  });

  it('refreshes at midnight, on focus and visibility, and removes all listeners', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-08T20:29:59.500Z'));
    const browser = new EventTarget();
    const page = new EventTarget();
    vi.stubGlobal('window', browser);
    vi.stubGlobal('document', page);
    const refresh = vi.fn();
    const unsubscribe = subscribeHeaderDate(refresh);
    vi.advanceTimersByTime(500);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(headerDateKey()).toBe('2026-09-09');
    browser.dispatchEvent(new Event('focus'));
    page.dispatchEvent(new Event('visibilitychange'));
    expect(refresh).toHaveBeenCalledTimes(3);
    unsubscribe();
    browser.dispatchEvent(new Event('focus'));
    page.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(120_000);
    expect(refresh).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });
});
