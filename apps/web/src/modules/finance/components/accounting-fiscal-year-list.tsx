'use client';

import { useQuery } from '@tanstack/react-query';
import { accountingApi } from '../api/accounting-api';
import { useFinanceFiscalContext } from '../finance-fiscal-context';
import { AccountingDate } from './accounting-date';

export function AccountingFiscalYearList() {
  const fiscal = useFinanceFiscalContext();
  const context = fiscal?.data;
  const company = context?.company;
  const companyKey = context?.companySelection ?? 'pending';
  const canRead =
    !!fiscal?.active && !!company && !fiscal.loading && !fiscal.error;
  const books = useQuery({
    queryKey: ['accounting', 'books', companyKey],
    queryFn: accountingApi.books,
    enabled: canRead,
  });
  const bookId = company
    ? (books.data?.books.find((book) => book.legalEntityId === company.id)
        ?.id ?? '')
    : '';
  const snapshot = useQuery({
    queryKey: ['accounting', 'snapshot', bookId, companyKey],
    queryFn: () => accountingApi.snapshot(bookId),
    enabled: canRead && !!bookId,
  });
  if (!fiscal?.active) return null;

  const loading =
    fiscal.loading ||
    (canRead && (books.isPending || (!!bookId && snapshot.isPending)));
  const error = fiscal.error || books.isError || snapshot.isError;
  const years = new Map(
    snapshot.data?.configurations
      .filter((year) => year.kind === 'fiscal-years')
      .map((year) => [year.id, year]),
  );
  const allocations =
    snapshot.data?.periods.flatMap((period) => {
      const year = years.get(period.fiscalYearId);
      return year ? [{ period, year }] : [];
    }) ?? [];

  return (
    <section
      aria-labelledby="accounting-fiscal-year-list-title"
      className="space-y-4"
    >
      <div>
        <h2
          id="accounting-fiscal-year-list-title"
          className="text-lg font-bold"
        >
          فهرست دوره مالی
        </h2>
        {!loading && !error && company && (
          <p className="text-sm text-muted-foreground">{company.title}</p>
        )}
      </div>
      {loading ? (
        <p role="status">در حال بارگذاری…</p>
      ) : !context || error ? (
        <p role="alert" className="text-sm text-destructive">
          دریافت فهرست دوره‌های مالی ناموفق بود.
        </p>
      ) : context.isAggregate ? (
        <p role="status" className="text-sm text-muted-foreground">
          برای مشاهدهٔ سال‌های مالی، یک شرکت را از نوار بالا انتخاب کنید.
        </p>
      ) : allocations.length === 0 ? (
        <p role="status" className="text-sm text-muted-foreground">
          برای این شرکت سال مالی به دفتر کل تخصیص داده نشده است.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-sm border">
          <table className="w-full text-start text-sm">
            <thead className="bg-muted">
              <tr>
                {['سال مالی', 'تاریخ شروع', 'تاریخ پایان'].map((label) => (
                  <th key={label} scope="col" className="px-3 py-2 text-start">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allocations.map(({ period, year }) => (
                <tr key={period.id} className="border-t">
                  <th scope="row" className="px-3 py-2 text-start font-medium">
                    {year.title}
                    {period.isDefault && year.active && (
                      <span className="ms-2 whitespace-nowrap text-xs text-muted-foreground">
                        پیش‌فرض شرکت
                      </span>
                    )}
                  </th>
                  <td className="px-3 py-2">
                    <AccountingDate value={period.startDate} />
                  </td>
                  <td className="px-3 py-2">
                    <AccountingDate value={period.endDate} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
