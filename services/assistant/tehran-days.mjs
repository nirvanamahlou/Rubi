export function tehranDayContext(observedAt) {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(observedAt);
  const midnight = Date.parse(date + 'T00:00:00+03:30');
  const iso = (offset) => new Date(midnight + offset * 86400000).toISOString();
  return {
    timeZone: 'Asia/Tehran',
    observedAt: observedAt.toISOString(),
    today: { start: iso(0), end: iso(1) },
    yesterday: { start: iso(-1), end: iso(0) },
  };
}
export function bindTehranDays(sql, context) {
  const values = {
    NORA_TODAY_START: context.today.start,
    NORA_TODAY_END: context.today.end,
    NORA_YESTERDAY_START: context.yesterday.start,
    NORA_YESTERDAY_END: context.yesterday.end,
  };
  return sql.replace(
    /NORA_(?:TODAY|YESTERDAY)_(?:START|END)/g,
    (key) => values[key],
  );
}
import { ServiceError } from './errors.mjs';
export function enforceRelativeDayQuery(sql, context, message) {
  const relative = /امروز|دیروز|\btoday\b|\byesterday\b/i.test(message);
  if (!relative) return bindTehranDays(sql, context);
  // Only the reviewed count grammar is accepted for relative-day requests.
  // Entire-string matching excludes joins, comments, OR, subqueries and unions.
  const match =
    /^\s*select\s+count\(\*\)\s+as\s+([a-z_][a-z0-9_]*)\s+from\s+(?:nora_agent\.)?contracts\s+where\s+created_at\s*>=\s*'NORA_(TODAY|YESTERDAY)_START'\s+and\s+created_at\s*<\s*'NORA_\2_END'\s*;?\s*$/i.exec(
      sql,
    );
  if (!match) throw new ServiceError(400, 'TEHRAN_DAY_QUERY_REQUIRED');
  const period = context[match[2].toLowerCase()];
  const end =
    match[2].toUpperCase() === 'TODAY' ? context.observedAt : period.end;
  return (
    'SELECT count(*) AS ' +
    match[1] +
    " FROM contracts WHERE created_at >= '" +
    period.start +
    "' AND created_at < '" +
    end +
    "'"
  );
}
