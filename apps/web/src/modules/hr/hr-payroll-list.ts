import {
  payrollDigits,
  type PayrollWorksheetSummary,
  type PayrollWorksheetStatus,
} from '@nora/contracts';

export const payrollWorksheetStatusLabels: Record<
  PayrollWorksheetStatus,
  string
> = {
  DRAFT: 'پیش‌نویس',
  HR_APPROVED: 'آماده ارسال به مالی',
  PENDING_FINANCE: 'در انتظار مالی',
  APPROVED: 'تأییدشده',
  CORRECTION_REQUIRED: 'نیازمند اصلاح',
  REJECTED: 'ردشده',
  CANCELLED: 'لغوشده',
};

export const payrollMonths = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];
export const payrollPeriodLabel = (period: string) =>
  `${payrollMonths[Number(period.slice(5)) - 1]} ${period.slice(0, 4)}`;

export interface PayrollListFilters {
  query: string;
  branchId: string;
  year: string;
  month: string;
  status: '' | PayrollWorksheetSummary['status'];
  rows: '' | 'empty' | 'populated';
  sort: 'periodDesc' | 'periodAsc' | 'updatedDesc' | 'rowsDesc';
}
export const defaultPayrollListFilters: PayrollListFilters = {
  query: '',
  branchId: '',
  year: '',
  month: '',
  status: '',
  rows: '',
  sort: 'periodDesc',
};
const normalize = (text: string) =>
  payrollDigits(text.normalize('NFKC'))
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[/⁄]/g, '-')
    .replace(/[\s\u200c]+/g, ' ')
    .toLowerCase();

/** Filters only the already authorized summaries, without reading employee snapshots. */
export function filterPayrollList(
  summaries: readonly PayrollWorksheetSummary[],
  branches: readonly { id: string; name: string }[],
  filters: PayrollListFilters,
) {
  const names = new Map(branches.map((branch) => [branch.id, branch.name]));
  const terms = normalize(filters.query).split(' ').filter(Boolean);
  return summaries
    .filter((item) => {
      if (filters.branchId && item.branchId !== filters.branchId) return false;
      if (
        filters.year &&
        item.period.slice(0, 4) !== payrollDigits(filters.year)
      )
        return false;
      if (
        filters.month &&
        item.period.slice(5) !== payrollDigits(filters.month).padStart(2, '0')
      )
        return false;
      if (filters.status && item.status !== filters.status) return false;
      if (filters.rows === 'empty' && item.rowCount !== 0) return false;
      if (filters.rows === 'populated' && item.rowCount === 0) return false;
      const text = normalize(
        `${item.period} ${payrollPeriodLabel(item.period)} ${names.get(item.branchId) ?? ''}`,
      );
      return terms.every((term) => text.includes(term));
    })
    .sort((a, b) => {
      const byPeriod = b.period.localeCompare(a.period);
      const primary =
        filters.sort === 'periodAsc'
          ? -byPeriod
          : filters.sort === 'updatedDesc'
            ? b.updatedAt.localeCompare(a.updatedAt)
            : filters.sort === 'rowsDesc'
              ? b.rowCount - a.rowCount
              : byPeriod;
      return (
        primary ||
        byPeriod ||
        a.branchId.localeCompare(b.branchId) ||
        a.id.localeCompare(b.id)
      );
    });
}
