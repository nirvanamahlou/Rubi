export type CalendarSystem = 'persian' | 'gregorian';

export interface CalendarParts {
  year: number;
  month: number;
  day: number;
}

export interface CalendarDay extends CalendarParts {
  date: Date;
  isoDate: string;
  isCurrentMonth: boolean;
  isToday: boolean;
}

const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
const arabicDigits = '٠١٢٣٤٥٦٧٨٩';

function latinNumber(value: string): number {
  const normalized = [...value]
    .map((character) => {
      const persianIndex = persianDigits.indexOf(character);
      if (persianIndex >= 0) return String(persianIndex);
      const arabicIndex = arabicDigits.indexOf(character);
      return arabicIndex >= 0 ? String(arabicIndex) : character;
    })
    .join('');
  return Number(normalized);
}

function localeFor(system: CalendarSystem): string {
  return system === 'persian' ? 'fa-IR-u-ca-persian' : 'fa-IR-u-ca-gregory';
}

export function parseIsoDate(value?: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  )
    return null;
  return date;
}

export function toIsoDate(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function calendarParts(
  date: Date,
  system: CalendarSystem,
): CalendarParts {
  const parts = new Intl.DateTimeFormat(localeFor(system), {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    latinNumber(parts.find((part) => part.type === type)?.value ?? '0');
  return { year: value('year'), month: value('month'), day: value('day') };
}

function atNoon(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
}

function addDays(date: Date, amount: number): Date {
  const next = atNoon(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function firstDayOfCalendarMonth(anchor: Date, system: CalendarSystem): Date {
  let cursor = atNoon(anchor);
  for (let index = 0; index < 35; index += 1) {
    if (calendarParts(cursor, system).day === 1) return cursor;
    cursor = addDays(cursor, -1);
  }
  return cursor;
}

export function moveCalendarMonth(
  anchor: Date,
  direction: -1 | 1,
  system: CalendarSystem,
): Date {
  if (system === 'gregorian') {
    const day = anchor.getDate();
    const target = new Date(
      anchor.getFullYear(),
      anchor.getMonth() + direction,
      1,
      12,
    );
    const lastDay = new Date(
      target.getFullYear(),
      target.getMonth() + 1,
      0,
    ).getDate();
    target.setDate(Math.min(day, lastDay));
    return target;
  }

  const originalDay = calendarParts(anchor, system).day;
  const currentFirst = firstDayOfCalendarMonth(anchor, system);
  let targetFirst: Date;
  if (direction === 1) {
    targetFirst = addDays(currentFirst, 32);
    targetFirst = firstDayOfCalendarMonth(targetFirst, system);
  } else {
    targetFirst = firstDayOfCalendarMonth(addDays(currentFirst, -1), system);
  }

  let target = targetFirst;
  for (let index = 1; index < originalDay; index += 1) {
    const next = addDays(target, 1);
    if (
      calendarParts(next, system).month !==
      calendarParts(targetFirst, system).month
    )
      break;
    target = next;
  }
  return target;
}

export function calendarMonthDays(
  anchor: Date,
  system: CalendarSystem,
): CalendarDay[] {
  const first = firstDayOfCalendarMonth(anchor, system);
  const target = calendarParts(first, system);
  const weekStartsOn = system === 'persian' ? 6 : 0;
  const offset = (first.getDay() - weekStartsOn + 7) % 7;
  const gridStart = addDays(first, -offset);
  const today = toIsoDate(new Date());

  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(gridStart, index);
    const parts = calendarParts(date, system);
    const isoDate = toIsoDate(date);
    return {
      ...parts,
      date,
      isoDate,
      isCurrentMonth:
        parts.year === target.year && parts.month === target.month,
      isToday: isoDate === today,
    };
  });
}

export function calendarMonthLabel(
  anchor: Date,
  system: CalendarSystem,
): string {
  return new Intl.DateTimeFormat(localeFor(system), {
    year: 'numeric',
    month: 'long',
  }).format(anchor);
}

export function formatCalendarValue(
  value: string,
  system: CalendarSystem,
  includeTime = false,
): string {
  const date = parseIsoDate(value);
  if (!date) return '';
  const formattedDate = new Intl.DateTimeFormat(localeFor(system), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
  if (!includeTime) return formattedDate;
  const time = /T(\d{2}:\d{2})/.exec(value)?.[1];
  return time ? `${formattedDate}، ساعت ${time}` : formattedDate;
}

export function joinDateAndTime(
  isoDate: string,
  currentValue: string,
  includeTime: boolean,
): string {
  if (!includeTime) return isoDate;
  const time = /T(\d{2}:\d{2})/.exec(currentValue)?.[1] ?? '00:00';
  return `${isoDate}T${time}`;
}
