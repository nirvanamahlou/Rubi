import type {
  SalesContractSummary,
  WorkbenchSalesPerformanceV1,
  WorkbenchMonthlySalesPeriodV1,
} from '@nora/contracts';
import { Prisma } from '@nora/database';

type Month = { year: number; month: number; day: number };
const calendar = new Intl.DateTimeFormat('en-US-u-ca-persian', {
  timeZone: 'Asia/Tehran',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});
const label = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  timeZone: 'Asia/Tehran',
  year: 'numeric',
  month: 'long',
});
const confirmedStatuses = new Set([
  'CONFIRMED',
  'SENT_TO_RESERVATIONS',
  'IN_PROGRESS',
  'COMPLETED',
]);

export function persianMonth(date: Date): Month {
  const parts = calendar.formatToParts(date);
  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: value('year'), month: value('month'), day: value('day') };
}

function amounts(rows: readonly SalesContractSummary[]) {
  const totals = new Map<string, Prisma.Decimal>();
  for (const row of rows)
    for (const balance of row.balances)
      totals.set(
        balance.currencyCode,
        (totals.get(balance.currencyCode) ?? new Prisma.Decimal(0)).plus(
          balance.amount,
        ),
      );
  return [...totals]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currencyCode, amount]) => ({
      currencyCode,
      amount: amount.toFixed(),
    }));
}

function period(
  rows: readonly SalesContractSummary[],
  elapsedDay: number,
): WorkbenchMonthlySalesPeriodV1 {
  return {
    contracts: rows.length,
    people: rows.reduce((count, row) => count + row.passengerNames.length, 0),
    amounts: amounts(rows),
    throughElapsedDay: amounts(
      rows.filter(
        (row) => persianMonth(new Date(row.createdAt)).day <= elapsedDay,
      ),
    ),
    daily: Array.from({ length: 31 }, (_, index) => ({
      day: index + 1,
      amounts: amounts(
        rows.filter(
          (row) => persianMonth(new Date(row.createdAt)).day === index + 1,
        ),
      ),
    })),
  };
}

export function monthlySales(
  rows: readonly SalesContractSummary[],
  now: Date,
): NonNullable<WorkbenchSalesPerformanceV1['monthly']> {
  const current = persianMonth(now);
  const previousDate = new Date(now.getTime() - current.day * 86_400_000);
  const previous = persianMonth(previousDate);
  const inMonth = (row: SalesContractSummary, month: Month) => {
    const value = persianMonth(new Date(row.createdAt));
    return value.year === month.year && value.month === month.month;
  };
  const confirmed = rows.filter((row) => confirmedStatuses.has(row.status));
  const currentRows = confirmed.filter((row) => inMonth(row, current));
  const previousRows = confirmed.filter((row) => inMonth(row, previous));
  const routes = new Map<
    string,
    { current: SalesContractSummary[]; previous: SalesContractSummary[] }
  >();
  for (const [month, items] of [
    ['current', currentRows],
    ['previous', previousRows],
  ] as const)
    for (const row of items) {
      const key = `${row.originId}:${row.destinationId}`;
      const group = routes.get(key) ?? { current: [], previous: [] };
      group[month].push(row);
      routes.set(key, group);
    }
  return {
    currentLabel: label.format(now),
    previousLabel: label.format(previousDate),
    elapsedDay: current.day,
    current: period(currentRows, current.day),
    previous: period(previousRows, current.day),
    routes: [...routes.values()]
      .map(({ current: currentItems, previous: previousItems }) => {
        const first = (currentItems[0] ?? previousItems[0])!;
        return {
          originId: first.originId,
          destinationId: first.destinationId,
          label: `از ${first.originName || first.originId} به ${first.destinationName || first.destinationId}`,
          contracts: currentItems.length,
          people: currentItems.reduce(
            (count, row) => count + row.passengerNames.length,
            0,
          ),
          amounts: amounts(currentItems),
          previousContracts: previousItems.length,
          previousPeople: previousItems.reduce(
            (count, row) => count + row.passengerNames.length,
            0,
          ),
          previousAmounts: amounts(previousItems),
        };
      })
      .sort(
        (a, b) => b.contracts - a.contracts || a.label.localeCompare(b.label),
      ),
  };
}
