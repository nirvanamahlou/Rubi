import type { HrRecordDto } from '@nora/contracts';
import { hrDisplayDate } from './hr-dates';
export const isEmployeeLeave = (record: HrRecordDto) =>
  !record.deletedAt &&
  ((record.section === 'time' && record.tab === 'leave') ||
    (record.section === 'requests' &&
      ['leave', 'radanLeave'].includes(record.tab)));
export function employeeLeaveDataset(records: HrRecordDto[]) {
  const items = records.filter(isEmployeeLeave);
  return {
    columns: [
      'شناسه',
      'نوع مرخصی',
      'از تاریخ',
      'تا تاریخ',
      'میزان عدم حضور',
      'وضعیت',
    ],
    rows: items.map((record) => [
      record.code,
      record.values[1] ?? '',
      hrDisplayDate(record.values[2] ?? ''),
      hrDisplayDate(record.values[3] ?? ''),
      record.tab === 'radanLeave'
        ? record.values[4] === 'ساعتی'
          ? `${record.values[5]} تا ${record.values[6]}`
          : `${Math.round((Date.parse(record.values[3]!) - Date.parse(record.values[2]!)) / 86400000) + 1} روز`
        : `${record.values[4]} روز`,
      record.status,
    ]),
    recordIds: items.map((record) => record.id),
    totalLabel: '',
  };
}
