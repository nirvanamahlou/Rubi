/** The Reporting panel sends inclusive Tehran calendar days as a half-open UTC range. */
export function reportDateRangeUtc(fromDate?: string, toDate?: string) {
  const filters: Record<string, string> = {};
  if (fromDate)
    filters.fromUtc = new Date(`${fromDate}T00:00:00+03:30`).toISOString();
  if (toDate) {
    const [year, month, day] = toDate.split('-').map(Number) as [
      number,
      number,
      number,
    ];
    const nextDay = new Date(Date.UTC(year, month - 1, day + 1))
      .toISOString()
      .slice(0, 10);
    filters.toUtc = new Date(`${nextDay}T00:00:00+03:30`).toISOString();
  }
  return filters;
}
