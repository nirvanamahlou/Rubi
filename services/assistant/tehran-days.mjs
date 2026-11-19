export function tehranDayContext(observedAt) {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(observedAt);
  const midnight = Date.parse(date + 'T00:00:00+03:30');
  const iso = (offset) => new Date(midnight + offset * 86400000).toISOString();
  return { timeZone: 'Asia/Tehran', observedAt: observedAt.toISOString(),
    today: { start: iso(0), end: iso(1) },
    yesterday: { start: iso(-1), end: iso(0) } };
}
export function bindTehranDays(sql, context) {
  const values = {
    NORA_TODAY_START: context.today.start, NORA_TODAY_END: context.today.end,
    NORA_YESTERDAY_START: context.yesterday.start,
    NORA_YESTERDAY_END: context.yesterday.end,
  };
  return sql.replace(/NORA_(?:TODAY|YESTERDAY)_(?:START|END)/g, (key) => values[key]);
}
