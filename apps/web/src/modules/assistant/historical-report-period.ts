import { normalizeQuestion } from './question-text';

const months =
  'فروردین اردیبهشت خرداد تیر مرداد شهریور مهر آبان آذر دی بهمن اسفند'.split(
    ' ',
  );
const namedPeriod = new RegExp(
  `(?:^| )(?:(\\d{1,2}) (?:تا|الی) (?:پایان )?)?(\\d{1,2}) (${months.join('|')}) (1[34]\\d{2})(?= |$)`,
);
const persianDay = new Intl.DateTimeFormat('en-US-u-ca-persian', {
  timeZone: 'Asia/Tehran',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

export function historicalReportPeriod(message: string) {
  const match = normalizeQuestion(message).match(namedPeriod);
  if (!match) return;
  const year = Number(match[4]);
  // Tehran has used UTC+03:30 year-round since Persian year 1402.
  if (year < 1402) return;
  const month = months.indexOf(match[3]!) + 1;
  const first = Number(match[1] ?? match[2]);
  const last = Number(match[2]);
  if (first < 1 || first > last || last > 31) return;
  const dayMs = 86_400_000;
  const start = Date.UTC(year + 621, 2, 18);
  let from: string | undefined;
  for (let offset = 0; offset < 370; offset++) {
    const date = new Date(start + offset * dayMs);
    const parts = persianDay.formatToParts(date);
    const key = ['month', 'day', 'year']
      .map((part) => Number(parts.find(({ type }) => type === part)?.value))
      .join('/');
    const midnight = Date.parse(
      date.toISOString().slice(0, 10) + 'T00:00:00+03:30',
    );
    if (key === `${month}/${first}/${year}`)
      from = new Date(midnight).toISOString();
    if (from && key === `${month}/${last}/${year}`) {
      return {
        from,
        to: new Date(midnight + dayMs).toISOString(),
        label: match[0].trim(),
      };
    }
  }
}

export function asksHistoricalOwnRequestCount(message: string) {
  const text = normalizeQuestion(message);
  return (
    /درخواست/.test(text) &&
    /کار ?تابل/.test(text) &&
    /خودم|کارتابل من|کارتابلم/.test(text) &&
    /چن(?:د)? تا|چند|تعداد/.test(text) &&
    /ثبت/.test(text) &&
    !/چگونه|چطور|نحوه|راهنما/.test(text)
  );
}
