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
        arrivals[0] ?? '—',
        departures.at(-1) ?? '—',
        record.values[4] ?? '—',
        record.values[5] ?? '—',
      ];
    }),
  };
}
