'use client';

import { DisplayLocaleContext } from '@/i18n/locale-context';
import type { CalendarSystem } from './date-picker.utils';

const persianWeekdays = [
  'شنبه',
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنجشنبه',
  'جمعه',
];
const gregorianWeekdays = {
  english: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  persian: ['ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش'],
};

/** Weekday language follows Persian mode even when foreign-trip fields prefer English dates. */
export function DatePickerWeekdays({
  calendarSystem,
  english,
}: {
  calendarSystem: CalendarSystem;
  english: boolean;
}) {
  const persian = calendarSystem === 'persian';
  const labels = persian
    ? persianWeekdays
    : english
      ? gregorianWeekdays.english
      : gregorianWeekdays.persian;
  return (
    <DisplayLocaleContext.Provider value={persian || !english ? 'fa' : 'en'}>
      {labels.map((label, index) => (
        <span
          className="py-1 text-[11px] font-bold text-primary"
          lang={persian ? 'fa' : undefined}
          key={index}
        >
          {label}
        </span>
      ))}
    </DisplayLocaleContext.Provider>
  );
}
