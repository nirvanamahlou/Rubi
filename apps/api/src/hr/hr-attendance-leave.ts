import type { AttendanceEvent } from './hr-device-attendance.domain';
type Interval = [number, number];
function union(rows: Interval[]): Interval[] {
  const out: Interval[] = [];
  for (const row of rows
    .filter(([a, b]) => b > a)
    .sort((a, b) => a[0] - b[0])) {
    const last = out.at(-1);
    if (last && row[0] <= last[1]) last[1] = Math.max(last[1], row[1]);
    else out.push([...row]);
  }
  return out;
}
const minutes = (rows: Interval[]) =>
  Math.floor(union(rows).reduce((n, [a, b]) => n + b - a, 0) / 60000);
export function approvedLeaveCoverage(
  events: AttendanceEvent[],
  start: Date,
  end: Date,
  leaves: Interval[],
) {
  const lo = start.getTime(),
    hi = end.getTime();
  const clipped = union(
    leaves.map(([a, b]) => [Math.max(lo, a), Math.min(hi, b)]),
  );
  const worked: Interval[] = [];
  let open: number | undefined;
  const sorted = [...events].sort((a, b) => a.at.getTime() - b.at.getTime());
  for (const e of sorted) {
    if (e.kind === 'ورود') open ??= e.at.getTime();
    else if (e.kind === 'خروج' && open !== undefined) {
      worked.push([Math.max(lo, open), Math.min(hi, e.at.getTime())]);
      open = undefined;
    }
  }
  const first = sorted.find((e) => e.kind === 'ورود')?.at.getTime() ?? hi;
  const last =
    sorted
      .filter((e) => e.kind === 'خروج')
      .at(-1)
      ?.at.getTime() ?? lo;
  return {
    leaveMinutes: minutes(clipped),
    creditMinutes: minutes([...worked, ...clipped]) - minutes(worked),
    lateCredit: minutes(clipped.map(([a, b]) => [a, Math.min(b, first)])),
    earlyCredit: minutes(clipped.map(([a, b]) => [Math.max(a, last), b])),
    fullDay:
      minutes(clipped) > 0 && minutes(clipped) >= Math.floor((hi - lo) / 60000),
  };
}
