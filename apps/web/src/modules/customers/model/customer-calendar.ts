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

export const gregorianMonths = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const persianYearBreaks = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192,
  2262, 2324, 2394, 2456, 3178,
] as const;

function integerDivision(value: number, divisor: number) {
  return Math.trunc(value / divisor);
}

function integerMod(value: number, divisor: number) {
  return value - integerDivision(value, divisor) * divisor;
}

function gregorianToDayNumber(year: number, month: number, day: number) {
  let result =
    integerDivision((year + integerDivision(month - 8, 6) + 100100) * 1461, 4) +
    integerDivision(153 * integerMod(month + 9, 12) + 2, 5) +
    day -
    34840408;
  result -=
    integerDivision(
      integerDivision(year + 100100 + integerDivision(month - 8, 6), 100) * 3,
      4,
    ) - 752;
  return result;
}

function dayNumberToGregorian(dayNumber: number): CustomerDateParts {
  let value = 4 * dayNumber + 139361631;
  value =
    value +
    integerDivision(integerDivision(4 * dayNumber + 183187720, 146097) * 3, 4) *
      4 -
    3908;
  const interim = integerDivision(integerMod(value, 1461), 4) * 5 + 308;
  const day = integerDivision(integerMod(interim, 153), 5) + 1;
  const month = integerMod(integerDivision(interim, 153), 12) + 1;
  const year =
    integerDivision(value, 1461) - 100100 + integerDivision(8 - month, 6);
  return { year, month, day };
}

function persianYearData(year: number) {
  const gregorianYear = year + 621;
  let leapDays = -14;
  let previousBreak: number = persianYearBreaks[0]!;
  let jump = 0;
  let nextBreak = 0;

  for (let index = 1; index < persianYearBreaks.length; index += 1) {
    nextBreak = persianYearBreaks[index] ?? persianYearBreaks.at(-1)!;
    jump = nextBreak - previousBreak;
    if (year < nextBreak) break;
    leapDays +=
      integerDivision(jump, 33) * 8 + integerDivision(integerMod(jump, 33), 4);
    previousBreak = nextBreak;
  }

  let offset = year - previousBreak;
  leapDays +=
    integerDivision(offset, 33) * 8 +
    integerDivision(integerMod(offset, 33) + 3, 4);
  if (integerMod(jump, 33) === 4 && jump - offset === 4) leapDays += 1;

  const gregorianLeapDays =
    integerDivision(gregorianYear, 4) -
    integerDivision((integerDivision(gregorianYear, 100) + 1) * 3, 4) -
    150;
  const marchDay = 20 + leapDays - gregorianLeapDays;

  if (jump - offset < 6)
    offset = offset - jump + integerDivision(jump + 4, 33) * 33;
  let leap = integerMod(integerMod(offset + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { gregorianYear, marchDay, leap };
}

function persianToDayNumber(year: number, month: number, day: number) {
  const yearData = persianYearData(year);
  return (
    gregorianToDayNumber(yearData.gregorianYear, 3, yearData.marchDay) +
    (month - 1) * 31 -
    integerDivision(month, 7) * (month - 7) +
    day -
    1
  );
}

function dayNumberToPersian(dayNumber: number): CustomerDateParts {
  const gregorian = dayNumberToGregorian(dayNumber);
  let year = gregorian.year - 621;
  const yearData = persianYearData(year);
  const firstDay = gregorianToDayNumber(gregorian.year, 3, yearData.marchDay);
  let offset = dayNumber - firstDay;

  if (offset >= 0 && offset <= 185)
    return {
      year,
      month: 1 + integerDivision(offset, 31),
      day: integerMod(offset, 31) + 1,
    };
  if (offset >= 0) offset -= 186;
  else {
    year -= 1;
    offset += 179;
    if (yearData.leap === 1) offset += 1;
  }
  return {
    year,
    month: 7 + integerDivision(offset, 30),
    day: integerMod(offset, 30) + 1,
  };
}

export function persianParts(date: Date): CustomerDateParts {
  return dayNumberToPersian(
    gregorianToDayNumber(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate(),
    ),
  );
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
  if (parts.month < 1 || parts.month > 12 || parts.day < 1) return null;
  const gregorian = dayNumberToGregorian(
    persianToDayNumber(parts.year, parts.month, parts.day),
  );
  const convertedBack = dayNumberToPersian(
    gregorianToDayNumber(gregorian.year, gregorian.month, gregorian.day),
  );
  if (
    convertedBack.year !== parts.year ||
    convertedBack.month !== parts.month ||
    convertedBack.day !== parts.day
  )
    return null;
  return gregorianDateToIso(gregorian);
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
  return `${calendarMonthName(mode, month)} ${calendarYearLabel(mode, year)}`;
}

export function calendarMonthName(
  mode: 'persian' | 'gregorian',
  month: number,
) {
  return mode === 'persian'
    ? persianMonths[month - 1]
    : gregorianMonths[month - 1];
}

export function calendarYearLabel(mode: 'persian' | 'gregorian', year: number) {
  return mode === 'persian' ? persianNumber(year) : String(year);
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
