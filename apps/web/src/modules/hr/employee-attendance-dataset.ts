import type { HrRecordDto } from '@nora/contracts';
import { recordsDataset } from './hr-live-data';
import { hrDisplayDate } from './hr-dates';

export function employeeAttendanceDataset(
  records: readonly HrRecordDto[],
  preserveServerOrder = false,
) {
  const attendance = records.filter(
    (r) => r.section === 'time' && r.tab === 'attendance' && !r.deletedAt,
  );
  // Profiles combine multiple resources ordered by creation time, not work date.
  // Paginated lists already carry the server's selected ordering.
  if (!preserveServerOrder) {
    attendance.sort(
      (a, b) =>
        (b.values[1] ?? '').localeCompare(a.values[1] ?? '') ||
        a.id.localeCompare(b.id),
    );
  }
  const base = recordsDataset('time', 'attendance', attendance);
  return {
    ...base,
    inactiveRecordIds: attendance
      .filter(
        (record) =>
          record.data.attendanceActive === false || record.status === 'غیرفعال',
      )
      .map((record) => record.id),
    columns: [
      'تاریخ',
      'روز هفته',
      'ورود',
      'خروج',
      'تأخیر',
      'خروج زودهنگام',
      'کسری کار',
      'اضافه‌کاری',
      'مبلغ اضافه‌کاری',
      'جریمه روز',
      'وضعیت',
    ],
    rows: attendance.map((record) => {
      const date = record.values[1] ?? '';
      const punches = records.filter(
        (r) =>
          r.section === 'time' &&
          r.tab === 'checkins' &&
          !r.deletedAt &&
          r.employeeId === record.employeeId &&
          r.values[1] === date,
      );
      const times = (direction: string) =>
        punches
          .filter((r) => r.values[3] === direction)
          .map((r) => r.values[2] ?? '')
          .filter(Boolean)
          .sort();
      const arrivals = times('ورود');
      const departures = times('خروج');
      const inactive =
        record.status === 'غیرفعال' || record.data.attendanceActive === false;
      const override = inactive
        ? undefined
        : record.data.attendanceStatusOverride;
      const clearLate =
        override === 'حاضر' || override === 'حاضر با خروج زودهنگام';
      const clearEarly = override === 'حاضر' || override === 'حاضر با تأخیر';
      const exempt = override === 'مرخصی' || override === 'عدم روزکاری';
      const deficit = record.data.deficitMinutes;
      const displayedDeficit =
        exempt || override === 'حاضر'
          ? 0
          : deficit == null
            ? null
            : Math.max(
                0,
                deficit -
                  (clearLate ? (record.data.lateMinutes ?? 0) : 0) -
                  (clearEarly ? (record.data.earlyMinutes ?? 0) : 0),
              );
      return [
        hrDisplayDate(date),
        /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date))
          ? new Intl.DateTimeFormat('fa-IR', {
              timeZone: 'Asia/Tehran',
              weekday: 'long',
            }).format(new Date(`${date}T12:00:00Z`))
          : '—',
        record.data.firstIn !== undefined
          ? attendanceClock(record.data.firstIn)
          : (arrivals[0] ?? '—'),
        record.data.lastOut !== undefined
          ? attendanceClock(record.data.lastOut)
          : (departures.at(-1) ?? '—'),
        inactive ? '—' : clearLate || exempt ? '0' : (record.values[4] ?? '—'),
        inactive ? '—' : clearEarly || exempt ? '0' : (record.values[5] ?? '—'),
        inactive || displayedDeficit == null ? '—' : String(displayedDeficit),
        record.data.overtimeMinutes == null
          ? '—'
          : String(record.data.overtimeMinutes),
        record.data.overtimeAmountToman == null
          ? '—'
          : `${BigInt(record.data.overtimeAmountToman).toLocaleString('fa-IR')} تومان`,
        record.data.dailyPenaltyToman == null
          ? '—'
          : `${Number(record.data.dailyPenaltyToman).toLocaleString('fa-IR')} تومان`,
        inactive
          ? 'غیرفعال'
          : (override ??
            (record.status === 'حاضر'
              ? Number(record.values[4]) > 0 && Number(record.values[5]) > 0
                ? 'حاضر با تأخیر و خروج زودهنگام'
                : Number(record.values[4]) > 0
                  ? 'حاضر با تأخیر'
                  : Number(record.values[5]) > 0
                    ? 'حاضر با خروج زودهنگام'
                    : 'حاضر'
              : record.status)),
      ];
    }),
  };
}

function attendanceClock(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tehran',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value));
}
export function recentAttendanceDataset(
  records: readonly HrRecordDto[],
  employees: readonly {
    id: string;
    personnelCode: string;
    name: string;
    status?: string;
  }[],
) {
  const inactive = new Set(
    employees.filter((e) => e.status && e.status !== 'فعال').map((e) => e.id),
  );
  records = records.filter((r) => !r.employeeId || !inactive.has(r.employeeId));
  const data = employeeAttendanceDataset(records, true);
  const rows = records.filter(
    (r) => r.section === 'time' && r.tab === 'attendance' && !r.deletedAt,
  );
  return {
    ...data,
    columns: ['کد پرسنلی', 'کارمند', ...data.columns],
    rows: data.rows.map((row, index) => {
      const record = rows[index]!;
      const employee = employees.find((e) => e.id === record.employeeId);
      return [
        employee?.personnelCode ?? '—',
        employee?.name ?? record.values[0] ?? '—',
        ...row,
      ];
    }),
  };
}

/** Calculation/export consumers use this; history tables intentionally keep all days. */
export function eligibleAttendanceRecords(records: readonly HrRecordDto[]) {
  const excluded = new Set(
    records
      .filter(
        (row) =>
          row.section === 'time' &&
          row.tab === 'attendance' &&
          (row.status === 'غیرفعال' || row.data.attendanceActive === false),
      )
      .map((row) => `${row.employeeId}:${row.values[1]}`),
  );
  return records.filter(
    (row) =>
      !(
        row.section === 'time' &&
        ['attendance', 'checkins'].includes(row.tab) &&
        (row.data.attendanceActive === false ||
          row.status === 'غیرفعال' ||
          excluded.has(`${row.employeeId}:${row.values[1]}`))
      ),
  );
}
