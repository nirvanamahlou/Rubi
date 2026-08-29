export interface CustomerDateParts {
  year: number;
  month: number;
  day: number;
}

export interface CustomerCalendarDay {
  day: number;
  iso: string;
}

export const persianMonths = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
] as const;

const persianFormatter = new Intl.DateTimeFormat('en-US-u-ca-persian', {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  timeZone: 'UTC',
});

export function persianParts(date: Date): CustomerDateParts {
  const parts = persianFormatter.formatToParts(date);
  const value = (type: 'year' | 'month' | 'day') =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: value('year'), month: value('month'), day: value('day') };
}

function isoParts(value: string): CustomerDateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match
    ? { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
    : null;
}

export function gregorianParts(value: string): CustomerDateParts {
  const parsed = isoParts(value);
  const date = parsed
    ? new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day))
    : new Date();
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

export function gregorianDateToIso(parts: CustomerDateParts): string | null {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (
    date.getUTCFullYear() !== parts.year ||
    date.getUTCMonth() + 1 !== parts.month ||
    date.getUTCDate() !== parts.day
  )
    return null;
  return date.toISOString().slice(0, 10);
}

export function persianDateToIso(parts: CustomerDateParts): string | null {
  const start = Date.UTC(parts.year + 620, 2, 1);
  for (let offset = 0; offset < 430; offset += 1) {
    const date = new Date(start + offset * 86_400_000);
    const candidate = persianParts(date);
    if (
      candidate.year === parts.year &&
      candidate.month === parts.month &&
      candidate.day === parts.day
    )
      return date.toISOString().slice(0, 10);
  }
  return null;
}

export function currentPersianParts(value: string): CustomerDateParts {
  const parsed = isoParts(value);
  return persianParts(
    parsed
      ? new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day))
      : new Date(),
  );
}

export function calendarMonthDays(
  mode: 'persian' | 'gregorian',
  year: number,
  month: number,
): Array<CustomerCalendarDay | null> {
  const toIso = mode === 'persian' ? persianDateToIso : gregorianDateToIso;
  const firstIso = toIso({ year, month, day: 1 });
  if (!firstIso) return [];

  const firstWeekday = new Date(`${firstIso}T00:00:00.000Z`).getUTCDay();
  const saturdayFirstOffset = (firstWeekday + 1) % 7;
  const cells: Array<CustomerCalendarDay | null> = Array.from(
    { length: saturdayFirstOffset },
    () => null,
  );
  for (let day = 1; day <= 31; day += 1) {
    const iso = toIso({ year, month, day });
    if (!iso) break;
    cells.push({ day, iso });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function shiftCalendarMonth(
  parts: Pick<CustomerDateParts, 'year' | 'month'>,
  direction: -1 | 1,
) {
  const month = parts.month + direction;
  if (month < 1) return { year: parts.year - 1, month: 12 };
  if (month > 12) return { year: parts.year + 1, month: 1 };
  return { year: parts.year, month };
}

export function calendarMonthTitle(
  mode: 'persian' | 'gregorian',
  year: number,
  month: number,
) {
  if (mode === 'persian')
    return `${persianMonths[month - 1]} ${persianNumber(year)}`;
  return new Intl.DateTimeFormat('fa-IR-u-ca-gregory', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function persianNumber(value: number) {
  return value.toLocaleString('fa-IR', { useGrouping: false });
}

export function formatCustomerDate(
  value: string | null,
  mode: 'persian' | 'gregorian',
) {
  if (!value) return 'ثبت نشده';
  return new Intl.DateTimeFormat(
    mode === 'persian' ? 'fa-IR-u-ca-persian' : 'fa-IR-u-ca-gregory',
    { dateStyle: 'medium', timeZone: 'UTC' },
  ).format(new Date(value));
}
