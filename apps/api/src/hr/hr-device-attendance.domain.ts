import { createHash } from 'node:crypto';

export type AttendanceEvent = { kind: string; at: Date };
/** Neutral reader punches alternate only inside the already-resolved shift window.
 * Explicit directions are authoritative. Exact duplicates do not toggle direction. */
export function resolveDeviceDirections(
  events: AttendanceEvent[],
): AttendanceEvent[] {
  let inside = false;
  const seen = new Set<string>();
  return [...events]
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .flatMap((event) => {
      const key = `${event.at.getTime()}:${event.kind}`;
      if (seen.has(key)) return [];
      seen.add(key);
      const kind =
        event.kind === 'اعلام حضور' ? (inside ? 'خروج' : 'ورود') : event.kind;
      if (kind === 'ورود') inside = true;
      if (kind === 'خروج') inside = false;
      return [{ ...event, kind }];
    });
}
export function deviceRecordId(source: string, id: string) {
  const hex = createHash('sha256')
    .update(`hr-radan:v1:${source}:${id}`)
    .digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
export function attendanceScheduleMetrics(
  events: AttendanceEvent[],
  start: Date,
  end: Date,
  grace = 0,
  overtimeStart: Date = end,
) {
  const sorted = [...events].sort((a, b) => a.at.getTime() - b.at.getTime());
  const ins = sorted.filter((e) => e.kind === 'ورود');
  const outs = sorted.filter((e) => e.kind === 'خروج');
  let open: Date | null = null;
  let within = 0,
    after = 0;
  for (const event of sorted) {
    if (event.kind === 'ورود' && !open) open = event.at;
    else if (event.kind === 'خروج' && open) {
      within += Math.max(
        0,
        Math.min(event.at.getTime(), end.getTime()) -
          Math.max(open.getTime(), start.getTime()),
      );
      after += Math.max(
        0,
        event.at.getTime() -
          Math.max(open.getTime(), end.getTime(), overtimeStart.getTime()),
      );
      open = null;
    }
  }
  return {
    firstIn: ins[0]?.at.toISOString() ?? null,
    lastOut: outs.at(-1)?.at.toISOString() ?? null,
    lateMinutes: ins.length
      ? Math.max(
          0,
          Math.floor((ins[0]!.at.getTime() - start.getTime()) / 60000) - grace,
        )
      : null,
    earlyMinutes:
      outs.length && !open
        ? Math.max(
            0,
            Math.floor((end.getTime() - outs.at(-1)!.at.getTime()) / 60000),
          )
        : null,
    overtimeMinutes: open ? null : Math.floor(after / 60000),
    deficitMinutes:
      open || !ins.length
        ? null
        : Math.max(
            0,
            Math.floor((end.getTime() - start.getTime() - within) / 60000),
          ),
  };
}

/** The standard office schedule has a shorter Thursday; other configured schedules retain their hours. */
export function workingHoursEnd(date: string, start: string, end: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay() === 4 &&
    start === '09:15' &&
    end === '17:00'
    ? '14:00'
    : end;
}
