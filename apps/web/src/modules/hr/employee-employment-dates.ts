import type { HrRecordDto } from '@nora/contracts';
import { persianDateToIso } from './hr-dates';

type EmploymentDates = { contractEnd?: string; employmentEnd?: string };

function workDate(value: string | undefined) {
  const date = value ? persianDateToIso(value).slice(0, 10) : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date))
    ? date
    : '';
}

/** Use the latest recorded business dates, including pending cases, without reviving cancelled cases. */
export function employeeEmploymentDates(records: readonly HrRecordDto[]) {
  const result = new Map<string, EmploymentDates>();
  const chosen = new Map<string, HrRecordDto>();
  for (const record of records) {
    if (
      !record.employeeId ||
      record.deletedAt ||
      /رد|لغو|باطل|حذف/.test(record.status)
    )
      continue;
    const contract = record.section === 'contracts' && record.tab === 'active';
    const separation =
      record.section === 'lifecycle' && record.tab === 'separation';
    if (!contract && !separation) continue;
    const key = `${record.employeeId}:${contract ? 'contract' : 'separation'}`;
    const previous = chosen.get(key);
    const index = contract ? 4 : 2;
    const rank = (r: HrRecordDto) =>
      `${workDate(r.values[index])}|${r.createdAt}|${r.id}`;
    if (previous && rank(previous) >= rank(record)) continue;
    chosen.set(key, record);
    const dates = result.get(record.employeeId) ?? {};
    if (contract) dates.contractEnd = workDate(record.values[5]);
    else dates.employmentEnd = workDate(record.values[2]);
    result.set(record.employeeId, dates);
  }
  return result;
}
