import type { HrRecordDto } from '@nora/contracts';
import { recordsDataset } from './hr-live-data';
import { hrDisplayDate } from './hr-dates';

export function employeeAttendanceDataset(records: readonly HrRecordDto[]) {
  const attendance = records.filter(
    (r) => r.section === 'time' && r.tab === 'attendance' && !r.deletedAt,
  );
  const base = recordsDataset('time', 'attendance', attendance);
  return {
    ...base,
    columns: ['تاریخ', 'ورود', 'خروج', 'تأخیر', 'خروج زودهنگام'],
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
      return [
        hrDisplayDate(date),
        record.data.firstIn !== undefined
          ? attendanceClock(record.data.firstIn)
          : (arrivals[0] ?? '—'),
        record.data.lastOut !== undefined
          ? attendanceClock(record.data.lastOut)
          : (departures.at(-1) ?? '—'),
        record.values[4] ?? '—',
        record.values[5] ?? '—',
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
  employees: readonly { id: string; personnelCode: string; name: string }[],
) {
  const data = employeeAttendanceDataset(records);
  const rows = records.filter(
    (r) => r.section === 'time' && r.tab === 'attendance' && !r.deletedAt,
  );
  return {
    ...data,
    columns: ['کد پرسنلی', 'کارمند', ...data.columns, 'اضافه‌کاری'],
    rows: data.rows.map((row, index) => {
      const record = rows[index]!;
      const employee = employees.find((e) => e.id === record.employeeId);
      return [
        employee?.personnelCode ?? '—',
        employee?.name ?? record.values[0] ?? '—',
        ...row,
        record.data.overtimeMinutes == null
          ? '—'
          : String(record.data.overtimeMinutes),
      ];
    }),
  };
}
