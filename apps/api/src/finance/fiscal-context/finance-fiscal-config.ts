import type { Prisma } from '@nora/database';
import { FinanceFiscalStorage } from './finance-fiscal-storage';

/** JSON date fields are canonical Gregorian date-only strings, scoped before paging. */
export function fiscalConfigWhere(
  bookId: string,
  dateKey: string,
): Prisma.AccountingConfigurationWhereInput {
  const period = new FinanceFiscalStorage().require(bookId);
  return period
    ? {
        attributes: {
          path: [dateKey],
          gte: period.startDate,
          lte: period.endDate,
        },
      }
    : {};
}
export function assertFiscalConfigDate(
  bookId: string,
  date: unknown,
  writable = false,
) {
  const fiscal = new FinanceFiscalStorage();
  if (fiscal.require(bookId)) fiscal.assertDate(String(date ?? ''), writable);
}
