import { APPROVED } from './hr.validation';
import type {
  HrDashboardChartDto,
  HrDashboardChartsDto,
} from '@nora/contracts';

const DAY = 86400000;
const iso = (date: Date) => date.toISOString().slice(0, 10);
const shift = (date: string, days: number) =>
  iso(new Date(Date.parse(date) + days * DAY));
const persian = new Intl.DateTimeFormat('en-US-u-ca-persian', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});
function parts(date: string) {
  const p = persian.formatToParts(new Date(date));
  const n = (type: Intl.DateTimeFormatPartTypes) =>
    Number(p.find((x) => x.type === type)?.value);
  return { year: n('year'), month: n('month'), day: n('day') };
}
export function dashboardPeriods(now: Date) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const current = parts(today);
  const month = shift(today, 1 - current.day);
  let season = month;
  while ((parts(season).month - 1) % 3 !== 0)
    season = shift(season, -parts(shift(season, -1)).day);
  const quarterTo = shift(season, -1);
  let quarterFrom = quarterTo;
  // Three complete Persian months preceding the current season.
  for (let i = 0; i < 3; i++) {
    quarterFrom = shift(quarterFrom, 1 - parts(quarterFrom).day);
    if (i < 2) quarterFrom = shift(quarterFrom, -1);
  }
  let year = month;
  while (parts(year).month !== 1)
    year = shift(year, -parts(shift(year, -1)).day);
  return {
    today,
    month,
    year,
    jalaliYear: current.year,
    quarterFrom,
    quarterTo,
    week: shift(today, -6),
    daily: shift(today, -29),
  };
}
export type DashboardEmployee = {
  id: string;
  name: string;
  unit: string;
  branchId: string;
  organizationBranchId: string | null;
  company?: string;
};
export type DashboardRecord = {
  id: string;
  employeeId: string | null;
  section: string;
  tab: string;
  values: unknown;
  data: unknown;
  status: string;
  createdAt: Date;
  updatedAt?: Date;
};
export type DashboardLeave = {
  employeeId: string;
  year: number;
  days: { toString(): string };
  createdAt: Date;
};
const number = (value: unknown) => {
  if (typeof value !== 'number' && typeof value !== 'string') return 0;
  const normalized =
    typeof value === 'string'
      ? value
          .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
          .replace(/[٠١٢٣٤٥٦٧٨٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      : value;
  const result = Number(normalized);
  return Number.isFinite(result) ? result : 0;
};
const duration = (value: unknown) => {
  if (typeof value !== 'string') return 0;
  const match = /^(\d+):(\d{2})$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : number(value) * 60;
};
export function buildDashboardCharts(
  employees: DashboardEmployee[],
  records: DashboardRecord[],
  leaveEntries: DashboardLeave[],
  now: Date,
): HrDashboardChartsDto {
  const p = dashboardPeriods(now);
  const employeeMap = new Map(employees.map((e) => [e.id, e]));
  const department = (e: DashboardEmployee) =>
    `${e.organizationBranchId || e.branchId}:${e.unit}`;
  const departments = new Map(
    employees.map((e) => [department(e), e.unit || 'بدون واحد']),
  );
  const names = new Map<string, number>();
  for (const label of departments.values())
    names.set(label, (names.get(label) ?? 0) + 1);
  // Keep same-named units from separate companies distinct, without exposing private identities.
  const labels = new Map(
    [...departments].map(([key, label]) => [
      key,
      names.get(label)! > 1
        ? `${label} / ${employees.find((e) => department(e) === key)?.company || 'شعبه'}`
        : label,
    ]),
  );
  const chart = (
    id: HrDashboardChartDto['id'],
    title: string,
    description: string,
    from: string,
    to: string,
  ): HrDashboardChartDto => ({ id, title, description, from, to, points: [] });
  const present = chart(
    'present',
    'حاضرین در روز (تعداد افراد)',
    '۳۰ روز اخیر؛ هر کارمند در هر روز یک‌بار، با کارکرد مثبت',
    p.daily,
    p.today,
  );
  const late = chart(
    'quarterLate',
    'تاخیرها در فصل اخیر',
    'مجموع دقیقه تأخیر در روزهای فصل شمسی قبل',
    p.quarterFrom,
    p.quarterTo,
  );
  const weekly = chart(
    'weeklyAttendance',
    'میزان حضور کارمندان در هفته اخیر',
    'ساعت کارکرد ثبت‌شده هر کارمند در ۷ روز اخیر',
    p.week,
    p.today,
  );
  const overtime = chart(
    'overtime',
    'اضافه کاری ماه جاری بر اساس دپارتمان',
    'ساعت اضافه‌کاری محاسبه‌شده در ماه شمسی جاری',
    p.month,
    p.today,
  );
  const departmentLate = chart(
    'departmentLate',
    'تاخیر در روز بر اساس دپارتمان',
    'مجموع دقیقه تأخیر امروز',
    p.today,
    p.today,
  );
  const leave = chart(
    'leave',
    'مرخصی دپارتمان ها در فصل اخیر',
    'تعداد درخواست‌های تأییدشده دارای هم‌پوشانی با فصل شمسی قبل',
    p.quarterFrom,
    p.quarterTo,
  );
  const balance = chart(
    'leaveBalance',
    'مانده مرخصی دپارتمان ها از ابتدای سال',
    'کاردکس دقیقه‌ای سال شمسی جاری به ساعت؛ دفتر روزانه با سال میلادی مستقل نمایش داده می‌شود',
    p.year,
    p.today,
  );
  const days = (from: string, to: string) => {
    const result: string[] = [];
    for (let d = from; d <= to; d = shift(d, 1)) result.push(d);
    return result;
  };
  const dateLabel = (date: string) =>
    new Intl.DateTimeFormat('fa-IR', {
      timeZone: 'UTC',
      month: 'short',
      day: 'numeric',
    }).format(new Date(date));
  const presentDays = new Map(
    days(p.daily, p.today).map((d) => [d, new Set<string>()]),
  );
  const lateDays = new Map(days(p.quarterFrom, p.quarterTo).map((d) => [d, 0]));
  const weeklyHours = new Map(employees.map((e) => [e.id, 0]));
  const overtimeHours = new Map([...departments.keys()].map((k) => [k, 0]));
  const lateMinutes = new Map(overtimeHours);
  const leaveCounts = new Map(overtimeHours);
  const minuteBalances = new Map<string, number>();
  const dayBalances = new Map<string, number>();
  // Attendance processor produces one row/day. Select latest deterministically if legacy duplicates exist.
  const attendance = new Map<string, DashboardRecord>();
  for (const row of records) {
    const employee = row.employeeId
      ? employeeMap.get(row.employeeId)
      : undefined;
    if (!employee) continue;
    const v = Array.isArray(row.values) ? (row.values as string[]) : [];
    const key = department(employee);
    if (row.section === 'time' && row.tab === 'attendance') {
      const day = v[1] ?? '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
      const unique = `${employee.id}:${day}`;
      const old = attendance.get(unique);
      if (
        !old ||
        (row.updatedAt ?? row.createdAt) > (old.updatedAt ?? old.createdAt) ||
        ((row.updatedAt ?? row.createdAt).getTime() ===
          (old.updatedAt ?? old.createdAt).getTime() &&
          row.id > old.id)
      )
        attendance.set(unique, row);
    }
    if (!APPROVED.has(row.status)) continue;
    if (
      (row.tab === 'leave' && ['time', 'requests'].includes(row.section)) ||
      (row.section === 'requests' && row.tab === 'radanLeave')
    ) {
      const from = v[2] ?? '',
        to = v[3] ?? from;
      if (from && to && from <= p.quarterTo && to >= p.quarterFrom)
        leaveCounts.set(key, (leaveCounts.get(key) ?? 0) + 1);
    }
    if (
      row.section === 'time' &&
      row.tab === 'minuteLedger' &&
      number(v[1]) === p.jalaliYear &&
      number(v[2]) >= 1 &&
      number(v[2]) <= parts(p.today).month &&
      row.createdAt <= now
    ) {
      minuteBalances.set(
        key,
        (minuteBalances.get(key) ?? 0) + number(v[5]) / 60,
      );
    }
  }
  for (const row of attendance.values()) {
    const employee = employeeMap.get(row.employeeId!)!;
    const key = department(employee),
      v = row.values as string[],
      day = v[1]!;
    const d =
      row.data && typeof row.data === 'object'
        ? (row.data as Record<string, unknown>)
        : {};
    const worked = Math.max(
      0,
      d.workedMinutes == null ? duration(v[3]) : number(d.workedMinutes),
    );
    const tardy = Math.max(
      0,
      d.lateMinutes == null ? number(v[4]) : number(d.lateMinutes),
    );
    if (worked > 0) presentDays.get(day)?.add(employee.id);
    if (lateDays.has(day)) lateDays.set(day, lateDays.get(day)! + tardy);
    if (day >= p.week && day <= p.today)
      weeklyHours.set(employee.id, weeklyHours.get(employee.id)! + worked / 60);
    if (day >= p.month && day <= p.today)
      overtimeHours.set(
        key,
        overtimeHours.get(key)! + Math.max(0, number(d.overtimeMinutes)) / 60,
      );
    if (day === p.today) lateMinutes.set(key, lateMinutes.get(key)! + tardy);
  }
  for (const entry of leaveEntries) {
    const employee = employeeMap.get(entry.employeeId);
    // Legacy day grants are Gregorian-year entitlements; do not mislabel them as Jalali or convert days to hours.
    if (
      employee &&
      entry.year === Number(p.today.slice(0, 4)) &&
      entry.createdAt <= now
    ) {
      const key = department(employee);
      dayBalances.set(
        key,
        (dayBalances.get(key) ?? 0) + number(entry.days.toString()),
      );
    }
  }
  present.points = [...presentDays].map(([key, values]) => ({
    key,
    label: dateLabel(key),
    value: values.size,
    unit: 'نفر',
  }));
  late.points = [...lateDays].map(([key, value]) => ({
    key,
    label: dateLabel(key),
    value,
    unit: 'دقیقه',
  }));
  weekly.points = employees.map((e) => ({
    key: e.id,
    label: e.name,
    value: weeklyHours.get(e.id)!,
    unit: 'ساعت',
  }));
  const departmentPoints = (
    values: Map<string, number>,
    unit: HrDashboardChartDto['points'][number]['unit'],
  ) =>
    [...values].map(([key, value]) => ({
      key,
      label: labels.get(key)!,
      value,
      unit,
    }));
  overtime.points = departmentPoints(overtimeHours, 'ساعت');
  departmentLate.points = departmentPoints(lateMinutes, 'دقیقه');
  leave.points = departmentPoints(leaveCounts, 'درخواست');
  balance.points = [
    ...departmentPoints(minuteBalances, 'ساعت'),
    ...departmentPoints(dayBalances, 'روز').map((x) => ({
      ...x,
      key: `${x.key}:days`,
      label: `${x.label} / ${p.today.slice(0, 4)}`,
    })),
  ];
  return {
    asOf: p.today,
    charts: [present, late, weekly, overtime, departmentLate, leave, balance],
  };
}
