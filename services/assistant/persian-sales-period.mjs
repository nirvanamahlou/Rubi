// Calendar arithmetic belongs to the runtime, never to language-model memory.
const day = 86400000;
const calendar = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {
  timeZone: 'Asia/Tehran',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});
const civil = new Intl.DateTimeFormat('en-CA-u-ca-gregory-nu-latn', {
  timeZone: 'Asia/Tehran',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const months = [
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
];
export function normalizeSalesText(text) {
  return text
    .normalize('NFKC')
    .replace(/[۰-۹٠-٩]/g, (c) =>
      String(c.charCodeAt(0) - (c <= '۹' && c >= '۰' ? 1776 : 1632)),
    )
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u200c\u200e\u200f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
const parts = (formatter, date) =>
  Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((p) => ['year', 'month', 'day'].includes(p.type))
      .map((p) => [p.type, Number(p.value)]),
  );
const key = (p) => p.year * 10000 + p.month * 100 + p.day;
function gregorianDate(year, month, date) {
  let lo = Math.floor(Date.UTC(year + 620, 0, 1) / day),
    hi = Math.ceil(Date.UTC(year + 622, 11, 31) / day);
  const target = year * 10000 + month * 100 + date;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (key(parts(calendar, new Date(mid * day + 12 * 3600000))) < target)
      lo = mid + 1;
    else hi = mid;
  }
  if (key(parts(calendar, new Date(lo * day + 12 * 3600000))) !== target)
    throw new Error('INVALID_PERSIAN_DATE');
  return new Date(lo * day).toISOString().slice(0, 10);
}
function midnight(date) {
  const t = Date.parse(date + 'T00:00:00Z');
  const target = Number(date.replaceAll('-', ''));
  let lo = (t - day) / 1000,
    hi = (t + day) / 1000;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (key(parts(civil, new Date(mid * 1000))) < target) lo = mid + 1;
    else hi = mid;
  }
  return new Date(lo * 1000).toISOString();
}
export function resolvePersianSalesPeriod(message, now = new Date()) {
  const text = normalizeSalesText(message);
  const names = months.join('|');
  const match = text.match(
    new RegExp(
      `(?:از\\s*)?(\\d{1,2})\\s*(?:(${names})\\s*)?(?:تا|الی|–|-)\\s*(\\d{1,2})\\s*(${names})(?:\\s*(?:سال\\s*)?(1[34]\\d{2}|امسال))?`,
    ),
  );
  if (!match) return null;
  const year =
    match[5] && match[5] !== 'امسال'
      ? Number(match[5])
      : parts(calendar, now).year;
  if (year < 1300 || year > 1499) throw new Error('INVALID_PERSIAN_DATE');
  const startDate = gregorianDate(
    year,
    months.indexOf(match[2] ?? match[4]) + 1,
    Number(match[1]),
  );
  const endDate = gregorianDate(
    year,
    months.indexOf(match[4]) + 1,
    Number(match[3]),
  );
  if (
    endDate < startDate ||
    Date.parse(endDate) - Date.parse(startDate) > 90 * day
  )
    throw new Error('INVALID_PERSIAN_DATE');
  const nextDate = new Date(Date.parse(endDate + 'T00:00:00Z') + day)
    .toISOString()
    .slice(0, 10);
  return {
    calendar: 'persian',
    timeZone: 'Asia/Tehran',
    year,
    startDay: Number(match[1]),
    startMonth: match[2] ?? match[4],
    endDay: Number(match[3]),
    endMonth: match[4],
    startDate,
    endDate,
    startUtc: midnight(startDate),
    endExclusiveUtc: midnight(nextDate),
  };
}

export const civilShift = (date, offset) =>
  new Date(Date.parse(date + 'T00:00:00Z') + offset * day)
    .toISOString()
    .slice(0, 10);

export const tehranCivilDate = (now) => civil.format(new Date(now));

export function resolveRelativeSalesPeriods(message, now) {
  const text = normalizeSalesText(message);
  const gregorian = /میلادی/.test(text);
  const today = tehranCivilDate(now);
  const dow = new Date(today + 'T00:00:00Z').getUTCDay();
  const startOfWeek = civilShift(today, -((dow + (gregorian ? 6 : 1)) % 7));
  const current = parts(gregorian ? civil : calendar, now);
  const make = (startDate, endDate, partial = false, cutoff) => ({
    startDate,
    endDate,
    startUtc: midnight(startDate),
    endExclusiveUtc:
      cutoff ??
      (partial ? now.toISOString() : midnight(civilShift(endDate, 1))),
    partial,
    calendar: gregorian ? 'gregory' : 'persian',
  });
  const pattern =
    /این (هفته|ماه|سال)|(هفته|ماه|سال) (?:ی )?(قبل تر|قبلی تر|پیش تر|گذشته|قبل|پیش)|(?<![\p{L}\p{N}])(?:سی|30|هفت|7) روز گذشته|(امروز|دیروز|پریروز)(?![\p{L}\p{N}])/gu;
  const terms = [...text.matchAll(pattern)];
  if (!terms.length) return null;
  const matchedTime = /تا همین (?:موقع|زمان)/.test(text);
  const periods = terms.map((term) => {
    if (term[4]) {
      const offset = { امروز: 0, دیروز: -1, پریروز: -2 }[term[4]];
      const date = civilShift(today, offset);
      const cutoff =
        matchedTime && offset !== 0
          ? new Date(
              Date.parse(midnight(date)) +
                now.getTime() -
                Date.parse(midnight(today)),
            ).toISOString()
          : undefined;
      return make(date, date, offset === 0 || Boolean(cutoff), cutoff);
    }
    const unit = term[1] ?? term[2];
    if (!unit) {
      const days = /^(?:سی|30)/.test(term[0]) ? 30 : 7;
      return make(civilShift(today, -days), civilShift(today, -1));
    }
    const offset = term[1] ? 0 : term[3].endsWith(' تر') ? -2 : -1;
    if (unit === 'هفته') {
      const start = civilShift(startOfWeek, offset * 7);
      const sameDay = civilShift(today, offset * 7);
      const cutoff = new Date(
        Date.parse(midnight(sameDay)) +
          now.getTime() -
          Date.parse(midnight(today)),
      ).toISOString();
      return make(
        start,
        offset === 0 ? today : matchedTime ? sameDay : civilShift(start, 6),
        offset === 0 || matchedTime,
        matchedTime ? cutoff : undefined,
      );
    }
    const monthIndex =
      current.year * 12 + (unit === 'سال' ? 0 : current.month - 1);
    const edge = (shift) => {
      const n = monthIndex + shift * (unit === 'سال' ? 12 : 1);
      const y = Math.floor(n / 12);
      const m = (n % 12) + 1;
      return gregorian
        ? new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10)
        : gregorianDate(y, m, 1);
    };
    return make(
      edge(offset),
      offset === 0 ? today : civilShift(edge(offset + 1), -1),
      offset === 0,
    );
  });
  if (
    periods.length > 2 ||
    (periods.length === 2 && periods[0].startDate === periods[1].startDate)
  )
    return [];
  return periods;
}
