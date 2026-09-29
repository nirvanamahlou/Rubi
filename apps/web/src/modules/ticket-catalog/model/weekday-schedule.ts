import { eligibleTicketReturn, validReturnWindow } from '@nora/contracts';
import type { ProductInput } from './catalog';

export const scheduleWeekdays = [
  { day: 6, code: 'Sa', name: 'شنبه' },
  { day: 0, code: 'Su', name: 'یکشنبه' },
  { day: 1, code: 'Mo', name: 'دوشنبه' },
  { day: 2, code: 'Tu', name: 'سه‌شنبه' },
  { day: 3, code: 'We', name: 'چهارشنبه' },
  { day: 4, code: 'Th', name: 'پنجشنبه' },
  { day: 5, code: 'Fr', name: 'جمعه' },
] as const;

export interface WeekdayStay {
  day: number;
  stayDays: number;
}
export interface ScheduleDate {
  outbound: string;
  returning?: string;
}
const DAY = 86_400_000;
function dateMillis(date: string) {
  const value = Date.parse(date + 'T00:00:00Z');
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(value) ||
    new Date(value).toISOString().slice(0, 10) !== date
  )
    throw new Error('تاریخ شروع و پایان معتبر لازم است.');
  return value;
}
export function addScheduleDays(date: string, days: number) {
  return new Date(dateMillis(date) + days * DAY).toISOString().slice(0, 10);
}

/** Inclusive outbound range; the number under a weekday is stay length, never occurrence count. */
export function scheduleDates(
  start: string,
  end: string,
  weekdays: readonly WeekdayStay[],
  roundTrip: boolean,
): ScheduleDate[] {
  const from = dateMillis(start),
    to = dateMillis(end);
  if (to < from || to - from > 365 * DAY)
    throw new Error('بازه پرواز باید به ترتیب و حداکثر یک سال باشد.');
  if (!weekdays.length) throw new Error('حداقل یک روز هفته را انتخاب کنید.');
  if (
    new Set(weekdays.map((w) => w.day)).size !== weekdays.length ||
    weekdays.some(
      (w) =>
        !Number.isInteger(w.day) ||
        w.day < 0 ||
        w.day > 6 ||
        (roundTrip &&
          (!Number.isInteger(w.stayDays) ||
            w.stayDays < 0 ||
            w.stayDays > 365)),
    )
  )
    throw new Error('روز هفته یا فاصله برگشت معتبر نیست.');
  const result: ScheduleDate[] = [];
  for (let date = from; date <= to; date += DAY) {
    const weekday = weekdays.find((w) => w.day === new Date(date).getUTCDay());
    if (!weekday) continue;
    const outbound = new Date(date).toISOString().slice(0, 10);
    result.push({
      outbound,
      ...(roundTrip
        ? { returning: addScheduleDays(outbound, weekday.stayDays) }
        : {}),
    });
  }
  if (!result.length)
    throw new Error('روزهای انتخاب‌شده در این بازه وجود ندارند.');
  return result;
}

export interface ScheduleLeg {
  departure: string;
  arrival: string;
  arrivalDayOffset: number;
}
export function buildWeekdayTickets(
  dates: readonly ScheduleDate[],
  outbound: ProductInput,
  returning: ProductInput | undefined,
  outboundTime: ScheduleLeg,
  returnTime: ScheduleLeg,
  batchId: string,
  toUtc: (wall: string, zone: string) => string,
): ProductInput[] {
  if (!validReturnWindow(outbound.returnMinDays, outbound.returnMaxDays))
    throw new Error('بازه حداقل و حداکثر روزهای برگشت معتبر نیست.');
  const uses = new Map<string, number>();
  for (const pair of dates)
    if (pair.returning)
      uses.set(pair.returning, (uses.get(pair.returning) ?? 0) + 1);
  const inputs: ProductInput[] = [],
    returned = new Set<string>();
  const make = (
    template: ProductInput,
    date: string,
    time: ScheduleLeg,
    group?: string,
  ): ProductInput => {
    if (
      !/^\d{2}:\d{2}$/.test(time.departure) ||
      !/^\d{2}:\d{2}$/.test(time.arrival) ||
      !Number.isInteger(time.arrivalDayOffset) ||
      time.arrivalDayOffset < 0 ||
      time.arrivalDayOffset > 2
    )
      throw new Error('ساعت حرکت، رسیدن و روز رسیدن را کامل کنید.');
    const segment = template.segments[0]!;
    const departureAt = toUtc(
      date + 'T' + time.departure,
      segment.departureZone,
    );
    const arrivalAt = toUtc(
      addScheduleDays(date, time.arrivalDayOffset) + 'T' + time.arrival,
      segment.arrivalZone,
    );
    if (arrivalAt <= departureAt)
      throw new Error(
        'رسیدن باید بعد از حرکت باشد؛ برای پرواز شبانه روز رسیدن را تغییر دهید.',
      );
    return {
      ...template,
      serviceDate: date,
      tripGroupId: group,
      segments: [{ ...segment, departureAt, arrivalAt }],
      fare: { ...template.fare },
    };
  };
  for (const pair of dates) {
    const group =
      pair.returning && uses.get(pair.returning) === 1
        ? batchId + ':' + pair.outbound
        : undefined;
    const going = make(outbound, pair.outbound, outboundTime, group);
    inputs.push(going);
    if (!pair.returning || !returning) continue;
    const back = make(returning, pair.returning, returnTime, group);
    const a = going.segments[0]!,
      b = back.segments[0]!;
    if (
      !eligibleTicketReturn(
        {
          originId: a.originCityId,
          destinationId: a.destinationCityId,
          departureAt: a.departureAt,
          arrivalAt: a.arrivalAt,
          returnMinDays: going.returnMinDays ?? null,
          returnMaxDays: going.returnMaxDays ?? null,
        },
        {
          originId: b.originCityId,
          destinationId: b.destinationCityId,
          departureAt: b.departureAt,
          arrivalAt: b.arrivalAt,
        },
      )
    )
      throw new Error(
        'برگشت خودکار باید پس از رسیدن رفت و داخل محدوده Min / Max باشد.',
      );
    if (!returned.has(pair.returning)) {
      inputs.push(back);
      returned.add(pair.returning);
    }
  }
  return inputs;
}
