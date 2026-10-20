import type { HrWorkflowData } from '@nora/contracts';
import { selection } from './hr-radan-completion.domain';
import { HR_RADAN_CALCULATION_COMPONENTS } from '@nora/contracts';

type Interval = [number, number];
function union(intervals: Interval[]) {
  const result: Interval[] = [];
  for (const interval of intervals
    .filter(([a, b]) => b > a)
    .sort((a, b) => a[0] - b[0])) {
    const last = result.at(-1);
    if (last && interval[0] <= last[1])
      last[1] = Math.max(last[1], interval[1]);
    else result.push([...interval]);
  }
  return result;
}
const length = (intervals: Interval[]) =>
  union(intervals).reduce((sum, [a, b]) => sum + Math.max(0, b - a), 0) / 60000;
/** Applies only explicit settings to canonical approved intervals, without deriving unseen coefficients. */
export function configuredAttendance(input: {
  settings: string[];
  start: Date;
  end: Date;
  worked: number;
  overtime: number;
  events: { kind: string; at: Date }[];
  requests: { tab: string; values: string[]; data: HrWorkflowData }[];
  holiday: boolean;
}) {
  const components = selection(
    input.settings[1]!,
    HR_RADAN_CALCULATION_COMPONENTS,
  );
  const start = input.start.getTime(),
    end = input.end.getTime(),
    covered: Interval[] = [],
    credits: Interval[] = [];
  let opened: number | undefined;
  for (const event of [...input.events].sort(
    (a, b) => a.at.getTime() - b.at.getTime(),
  )) {
    if (event.kind === 'ورود') opened ??= event.at.getTime();
    else if (opened !== undefined) {
      covered.push([
        Math.max(start, opened),
        Math.min(end, event.at.getTime()),
      ]);
      opened = undefined;
    }
  }
  const outsideIntervals: Interval[] = [];
  const dayStart =
      Math.floor((start + 3.5 * 3600000) / 86400000) * 86400000 - 3.5 * 3600000,
    dayEnd = dayStart + 86400000;
  for (const request of input.requests) {
    const data = request.data;
    if (!data.startsAt || !data.endsAt) continue;
    const a = Math.max(dayStart, Date.parse(data.startsAt)),
      b = Math.min(dayEnd, Date.parse(data.endsAt));
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) continue;
    const isRemote = request.tab === 'remote',
      isMission = ['radanMission', 'mission'].includes(request.tab),
      isLeave = ['radanLeave', 'leave'].includes(request.tab);
    const hourly = isRemote
      ? request.values[3] === 'ساعتی'
      : request.values[4] === 'ساعتی';
    const component = `${isRemote ? 'دورکاری' : isMission ? 'مأموریت' : 'مرخصی'} ${hourly ? 'ساعتی' : 'روزانه'}`;
    if ((isRemote || isMission || isLeave) && components.includes(component)) {
      if (Math.min(end, b) > Math.max(start, a))
        credits.push([Math.max(start, a), Math.min(end, b)]);
      if (isMission && input.settings[4] === 'بله') {
        if (a < start) outsideIntervals.push([a, Math.min(start, b)]);
        if (b > end) outsideIntervals.push([Math.max(a, end), b]);
      }
    }
  }
  const outsideMission = Math.floor(length(outsideIntervals));
  const credit = Math.max(
    0,
    length([...covered, ...credits]) - length(covered),
  );
  const worked = input.worked + credit;
  let overtime = input.overtime + outsideMission;
  if (input.settings[5] === 'بله')
    overtime = Math.max(
      0,
      overtime - Math.max(0, (end - start) / 60000 - worked),
    );
  const holidayOvertime = input.holiday ? overtime : 0;
  if (input.holiday && input.settings[8] !== 'بله') overtime = 0;
  const weekday = new Date(start + 3.5 * 3600000).getUTCDay();
  return {
    worked,
    overtime,
    metrics: {
      creditedMinutes: credit,
      outsideMissionMinutes: outsideMission,
      holidayOvertimeMinutes: holidayOvertime,
      thursdayMinutes:
        weekday === 4 && input.settings[6] === 'بله' ? overtime : 0,
      fridayMinutes:
        weekday === 5 && input.settings[7] === 'بله' ? overtime : 0,
    },
  };
}
