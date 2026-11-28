import { normalizeQuestion } from './question-text';

const months =
  'فروردین اردیبهشت خرداد تیر مرداد شهریور مهر آبان آذر دی بهمن اسفند'.split(
    ' ',
  );
const month = months.join('|');
const year = '1[34]\\d{2}';
const namedDate = `(\\d{1,2}) (${month}) (${year})`;
const rangeSeparator = / (?:تا|الی) (?:پایان )?/;
const fullRange = new RegExp(
  `(?:^| )(\\d{1,2}) (${month})(?: (${year}))?${rangeSeparator.source}${namedDate}(?= |$)`,
);
const namedPeriod = new RegExp(
  `(?:^| )(?:(\\d{1,2})${rangeSeparator.source})?${namedDate}(?= |$)`,
);
const namedMonth = new RegExp(`(?:^| )(${month}) (${year})(?= |$)`);
const persianDay = new Intl.DateTimeFormat('en-US-u-ca-persian', {
  timeZone: 'Asia/Tehran',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});
const dayMs = 86_400_000;

function tehranMidnight(day: string, month: string, year: string) {
  const y = Number(year);
  const d = Number(day);
  // Tehran has used UTC+03:30 year-round since Persian year 1402.
  if (y < 1402 || d < 1 || d > 31) return;
  const monthIndex = months.indexOf(month) + 1;
  const start = Date.UTC(y + 621, 2, 18) + (monthIndex - 1) * 29 * dayMs;
  for (let offset = 0; offset < 60; offset++) {
    const date = new Date(start + offset * dayMs);
    const parts = persianDay.formatToParts(date);
    const key = ['month', 'day', 'year']
      .map((part) => Number(parts.find(({ type }) => type === part)?.value))
      .join('/');
    if (key === `${monthIndex}/${d}/${y}`)
      return Date.parse(date.toISOString().slice(0, 10) + 'T00:00:00+03:30');
  }
}

export function historicalReportPeriod(message: string) {
  const text = normalizeQuestion(message);
  const full = text.match(fullRange);
  const short = text.match(namedPeriod);
  const wholeMonth = text.match(namedMonth);
  const match = full ?? short ?? wholeMonth;
  if (!match) return;
  let from: number | undefined;
  let last: number | undefined;
  if (full) {
    from = tehranMidnight(full[1]!, full[2]!, full[3] ?? full[6]!);
    last = tehranMidnight(full[4]!, full[5]!, full[6]!);
  } else if (short) {
    from = tehranMidnight(short[1] ?? short[2]!, short[3]!, short[4]!);
    last = tehranMidnight(short[2]!, short[3]!, short[4]!);
  } else {
    const index = months.indexOf(wholeMonth![1]!);
    const y = Number(wholeMonth![2]);
    from = tehranMidnight('1', months[index]!, String(y));
    const next = tehranMidnight(
      '1',
      months[(index + 1) % months.length]!,
      String(y + Number(index === months.length - 1)),
    );
    if (next !== undefined) last = next - dayMs;
  }
  if (from === undefined || last === undefined || from > last) return;
  return {
    from: new Date(from).toISOString(),
    to: new Date(last + dayMs).toISOString(),
    label: match[0].trim(),
  };
}

export function asksHistoricalOwnRequestCount(message: string) {
  const text = normalizeQuestion(message);
  return (
    /درخواست/.test(text) &&
    /کار ?تابل|میز ?کار/.test(text) &&
    /(?:کار ?تابل|میز ?کار)(?: خودم| من|م)(?= |$)|ثبت (?:کردم|کرده ام|کرده م)/.test(
      text,
    ) &&
    /چن(?:د)? تا|چند|تعداد/.test(text) &&
    /ثبت/.test(text) &&
    !/چگونه|چطور|چجور|نحوه|راهنما|تایید|رد شده|بسته شده|دریافتی|به تفکیک/.test(
      text,
    )
  );
}
