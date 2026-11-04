import { isoDate } from './hr.validation';

/** Deployment-specific lower bound, applied after provider date correction. */
export function attendanceFrom(date: string): string {
  const configured = process.env.HR_RADAN_FROM_DATE;
  if (!configured) return date;
  const lower = isoDate(configured).toISOString().slice(0, 10);
  return date < lower ? lower : date;
}
