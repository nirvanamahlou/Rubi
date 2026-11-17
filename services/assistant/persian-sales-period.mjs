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
