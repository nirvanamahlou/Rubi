export type DossierDateRange = { from: string; to: string };
const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tehran',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
export function dossierDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = formatter.formatToParts(date);
  return ['year', 'month', 'day']
    .map((k) => parts.find((p) => p.type === k)?.value)
    .join('-');
}
export function inDossierDateRange(value: string, range: DossierDateRange) {
  if (range.from && range.to && range.from > range.to) return false;
  if (!range.from && !range.to) return true;
  const day = dossierDate(value);
  return (
    !!day &&
    (!range.from || day >= range.from) &&
    (!range.to || day <= range.to)
  );
}
export function dossierDateBoundary(day: string, end = false) {
  const base = Date.parse(day + 'T00:00:00Z');
  if (
    !Number.isFinite(base) ||
    new Date(base).toISOString().slice(0, 10) !== day
  )
    throw Error('تاریخ معتبر نیست.');
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const target = base + (end ? 86400000 : 0);
  let result = target;
  for (let i = 0; i < 3; i++) {
    const p = f.formatToParts(new Date(result));
    const v = (key: string) => Number(p.find((x) => x.type === key)?.value);
    result +=
      target -
      Date.UTC(
        v('year'),
        v('month') - 1,
        v('day'),
        v('hour'),
        v('minute'),
        v('second'),
      );
  }
  return new Date(result - (end ? 1 : 0)).toISOString();
}
