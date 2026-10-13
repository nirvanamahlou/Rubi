import { tehranDay } from './recommendations.mjs';
import { ServiceError } from './errors.mjs';
const iso = (value) =>
  typeof value === 'string' &&
  /^\d{4}-\d\d-\d\dT/.test(value) &&
  Number.isFinite(Date.parse(value));
export function personalFollowUps(tool, rows, now) {
  const cutoff = tehranDay(now) + 7;
  const result = [];
  for (const row of rows) {
    if (
      !row ||
      typeof row.id !== 'string' ||
      !row.id ||
      row.id.length > 100 ||
      typeof row.title !== 'string'
    )
      throw new ServiceError(502, 'INVALID_SOURCE');
    const due = tool === 'notes' ? row.reminderAt : row.dueAt;
    if (due != null && !iso(due)) throw new ServiceError(502, 'INVALID_SOURCE');
    if (tool === 'calendar' && ['COMPLETED', 'CANCELLED'].includes(row.status))
      continue;
    if (
      tool === 'notes' &&
      Array.isArray(row.items) &&
      row.items.length &&
      row.items.every((item) => item.done === true)
    )
      continue;
    if (tool !== 'procurement' && !due) continue;
    if (due && tehranDay(due) > cutoff) continue;
    if (
      tool === 'procurement' &&
      (typeof row.requestId !== 'string' || row.requestId.length > 100)
    )
      throw new ServiceError(502, 'INVALID_SOURCE');
    result.push({
      id: `${tool}:${row.id}`,
      title: row.title.slice(0, 200),
      source: tool,
      ...(['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(row.priority)
        ? { sourcePriority: row.priority }
        : {}),
      dueAt: due ? new Date(due).toISOString() : null,
      reason: !due
        ? 'ASSIGNED'
        : Date.parse(due) < now.getTime()
          ? 'OVERDUE'
          : 'DUE_SOON',
      href:
        tool === 'procurement'
          ? `/purchases?section=requests&request=${encodeURIComponent(row.requestId)}`
          : `/workbench?tab=${tool}`,
    });
  }
  return result;
}
