import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DisplayLocaleContext } from '@/i18n/locale-context';
import { DatePickerWeekdays } from './date-picker-weekdays';
import { calendarMonthDays } from './date-picker.utils';

function headings(
  system: 'persian' | 'gregorian',
  english: boolean,
  locale: 'fa' | 'en',
) {
  const html = renderToStaticMarkup(
    createElement(
      DisplayLocaleContext.Provider,
      { value: locale },
      createElement(DatePickerWeekdays, { calendarSystem: system, english }),
    ),
  );
  return [...html.matchAll(/<span[^>]*>(.*?)<\/span>/g)].map(
    (match) => match[1],
  );
}

describe('calendar-specific weekday headings', () => {
  it.each([
    ['fa', false],
    ['fa', true],
    ['en', false],
    ['en', true],
  ] as const)(
    'keeps Persian names in a %s interface with English date preference %s',
    (locale, english) => {
      expect(headings('persian', english, locale)).toEqual([
        'شنبه',
        'یکشنبه',
        'دوشنبه',
        'سه‌شنبه',
        'چهارشنبه',
        'پنجشنبه',
        'جمعه',
      ]);
    },
  );
  it('retains Gregorian Sunday-first English and Persian labels', () => {
    expect(headings('gregorian', true, 'en')).toEqual([
      'Sun',
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat',
    ]);
    expect(headings('gregorian', true, 'fa')).toEqual([
      'Sun',
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat',
    ]);
    expect(headings('gregorian', false, 'fa')).toEqual([
      'ی',
      'د',
      'س',
      'چ',
      'پ',
      'ج',
      'ش',
    ]);
  });
  it.each([new Date(2026, 2, 21, 12), new Date(2026, 9, 27, 12)])(
    'aligns each first-week cell with Saturday-first Persian and Sunday-first Gregorian headings at %s',
    (date) => {
      expect(
        calendarMonthDays(date, 'persian')
          .slice(0, 7)
          .map((day) => day.date.getDay()),
      ).toEqual([6, 0, 1, 2, 3, 4, 5]);
      expect(
        calendarMonthDays(date, 'gregorian')
          .slice(0, 7)
          .map((day) => day.date.getDay()),
      ).toEqual([0, 1, 2, 3, 4, 5, 6]);
    },
  );
});
