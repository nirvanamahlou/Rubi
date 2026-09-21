export type DashboardCalendarRange =
  | 'today'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year';

export type DashboardTrendRange = DashboardCalendarRange | 'custom';

const tehranTimeZone = 'Asia/Tehran';

type CivilDateParts = {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  second?: number;
};

function numberPart(parts: Intl.DateTimeFormatPart[], type: string) {
  const value = parts.find((part) => part.type === type)?.value;
  if (!value) throw new Error(`بخش زمانی ${type} قابل خواندن نیست.`);
  return Number(value);
}

function gregorianParts(value: Date): CivilDateParts {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', {
    timeZone: tehranTimeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(value);
  return {
    year: numberPart(parts, 'year'),
    month: numberPart(parts, 'month'),
    day: numberPart(parts, 'day'),
    hour: numberPart(parts, 'hour'),
    minute: numberPart(parts, 'minute'),
    second: numberPart(parts, 'second'),
  };
}

function persianParts(value: Date): CivilDateParts {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {
    timeZone: tehranTimeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(value);
  return {
    year: numberPart(parts, 'year'),
    month: numberPart(parts, 'month'),
    day: numberPart(parts, 'day'),
  };
}

/** Returns the UTC instant for the first moment of the displayed Tehran day. */
function tehranDayStart(value: Date) {
  const local = gregorianParts(value);
  const utcGuess = Date.UTC(local.year, local.month - 1, local.day);
  const observed = gregorianParts(new Date(utcGuess));
  const observedAsUtc = Date.UTC(
    observed.year,
    observed.month - 1,
    observed.day,
    observed.hour ?? 0,
    observed.minute ?? 0,
    observed.second ?? 0,
  );
  return new Date(utcGuess - (observedAsUtc - utcGuess));
}

function addTehranDays(dayStart: Date, days: number) {
  // Noon is intentionally used while moving a civil day so an offset change
  // cannot select the adjacent Tehran date.
  return tehranDayStart(
    new Date(dayStart.getTime() + 12 * 60 * 60 * 1000 + days * 86_400_000),
  );
}

function findPersianBoundary(
  dayStart: Date,
  predicate: (parts: CivilDateParts) => boolean,
  maximumDays: number,
) {
  let cursor = dayStart;
  for (let index = 0; index <= maximumDays; index += 1) {
    if (predicate(persianParts(cursor))) return cursor;
    cursor = addTehranDays(cursor, -1);
  }
  throw new Error('مرز تقویم فارسی در بازهٔ مجاز پیدا نشد.');
}

function nextPersianMonthStart(dayStart: Date) {
  const current = persianParts(dayStart);
  let cursor = addTehranDays(dayStart, 1);
  for (let index = 0; index <= 32; index += 1) {
    const next = persianParts(cursor);
    if (
      next.day === 1 &&
      (next.month !== current.month || next.year !== current.year)
    )
      return cursor;
    cursor = addTehranDays(cursor, 1);
  }
  throw new Error('مرز ماه فارسی در بازهٔ مجاز پیدا نشد.');
}

/**
 * Returns only completed or currently active calendar buckets. Future buckets
 * are intentionally excluded so an as-of dashboard never implies a measured
 * zero for a future hour, day, week or month.
 */
export function dashboardTrendBucketStarts({
  from,
  range,
  to,
}: {
  from: Date;
  range?: DashboardTrendRange | undefined;
  to: Date;
}) {
  if (from.getTime() >= to.getTime()) return [] as Date[];
  const duration = to.getTime() - from.getTime();
  const resolvedRange =
    range === 'custom'
      ? duration <= 24 * 60 * 60 * 1000
        ? 'today'
        : duration <= 31 * 24 * 60 * 60 * 1000
          ? 'month'
          : duration <= 94 * 24 * 60 * 60 * 1000
            ? 'quarter'
            : 'year'
      : range;
  const nextBucket =
    resolvedRange === 'today'
      ? (value: Date) => new Date(value.getTime() + 60 * 60 * 1000)
      : resolvedRange === 'week' || resolvedRange === 'month'
        ? (value: Date) => addTehranDays(value, 1)
        : resolvedRange === 'quarter'
          ? (value: Date) => addTehranDays(value, 7)
          : resolvedRange === 'year'
            ? nextPersianMonthStart
            : (value: Date) => addTehranDays(value, 1);
  const starts: Date[] = [];
  let cursor = from;
  while (cursor.getTime() < to.getTime()) {
    starts.push(cursor);
    const next = nextBucket(cursor);
    if (next.getTime() <= cursor.getTime())
      throw new Error('مرز بازهٔ روند معتبر نیست.');
    cursor = next;
  }
  return starts;
}

/**
 * Calendar-to-date starts in the reporting timezone. The Persian calendar is
 * intentional: Dashboard controls default to it and its week starts Saturday.
 */
export function dashboardCalendarRangeStart(
  now: Date,
  range: DashboardCalendarRange,
) {
  const today = tehranDayStart(now);
  if (range === 'today') return today;
  if (range === 'week') {
    const local = gregorianParts(today);
    const weekDay = new Date(
      Date.UTC(local.year, local.month - 1, local.day),
    ).getUTCDay();
    return addTehranDays(today, -((weekDay + 1) % 7));
  }
  if (range === 'month')
    return findPersianBoundary(today, (parts) => parts.day === 1, 31);
  if (range === 'quarter')
    return findPersianBoundary(
      today,
      (parts) => parts.day === 1 && (parts.month - 1) % 3 === 0,
      94,
    );
  return findPersianBoundary(
    today,
    (parts) => parts.month === 1 && parts.day === 1,
    366,
  );
}

export function dashboardPersianDateParts(value: Date) {
  return persianParts(value);
}
