import { Prisma } from '@nora/database';
import type {
  ReportQueryV1,
  TravelReportResultV1,
} from './reporting.contracts';
import type { readSalesReportingProjection } from '../sales/sales-reporting.public';

type SourceRow = Awaited<
  ReturnType<typeof readSalesReportingProjection>
>[number];
const currencyOrder = (codes: readonly string[]) =>
  [...new Set(codes)].sort((a, b) => {
    const order = ['IRR', 'EUR', 'USD'];
    return (
      (order.includes(a) ? order.indexOf(a) : 3) -
        (order.includes(b) ? order.indexOf(b) : 3) || a.localeCompare(b)
    );
  });
const symbol = (code: string) =>
  ({ IRR: 'ریال', EUR: '€', USD: '$' })[code] ?? code;

/** Count each authorized contract once; never add amounts across currencies. */
export function organizationMultiCurrencyResult(
  result: TravelReportResultV1,
  source: readonly SourceRow[],
  query: ReportQueryV1,
  includeAllRows: boolean,
  labels: {
    branches: ReadonlyMap<string, string>;
    users: ReadonlyMap<string, string>;
  },
): TravelReportResultV1 {
  const groups = new Map<
    string,
    {
      branchId: string;
      ownerId: string;
      contracts: Map<string, number>;
      money: Map<string, Prisma.Decimal>;
    }
  >();
  for (const row of source) {
    const key = JSON.stringify([row.branchId, row.ownerUserId]);
    const g = groups.get(key) ?? {
      branchId: row.branchId,
      ownerId: row.ownerUserId,
      contracts: new Map<string, number>(),
      money: new Map<string, Prisma.Decimal>(),
    };
    g.contracts.set(row.id, row.passengerCount);
    g.money.set(
      row.currencyCode,
      (g.money.get(row.currencyCode) ?? new Prisma.Decimal(0)).plus(
        row.salesAmount,
      ),
    );
    groups.set(key, g);
  }
  const currencies = currencyOrder(source.map((r) => r.currencyCode));
  const rows = [...groups].map(([key, g]) => {
    const amountsByCurrency = currencyOrder([...g.money.keys()]).map(
      (currencyCode) => ({
        currencyCode,
        amount: g.money.get(currencyCode)!.toString(),
      }),
    );
    const orderCount = g.contracts.size,
      passengerCount = [...g.contracts.values()].reduce((a, b) => a + b, 0);
    const primaryDimension = labels.branches.get(g.branchId) ?? g.branchId,
      secondaryDimension = labels.users.get(g.ownerId) ?? g.ownerId;
    return {
      grainId: key,
      primaryDimension,
      secondaryDimension,
      currencyCode: amountsByCurrency[0]?.currencyCode ?? '',
      orderCount,
      passengerCount,
      ticketCount: 0,
      salesAmount: amountsByCurrency[0]?.amount ?? '0',
      purchaseAmount: '0',
      grossProfit: '0',
      refundAmount: '0',
      settlementBalance: '0',
      pendingReservationActions: 0,
      amountsByCurrency,
      sourceValues: {
        primaryDimension,
        secondaryDimension,
        orderCount,
        passengerCount,
        salesAmount: amountsByCurrency
          .map((m) => `${m.amount} ${symbol(m.currencyCode)}`)
          .join(' - '),
      },
    };
  });
  const column = query.sort?.column ?? 'salesAmount';
  rows.sort((a, b) => {
    let comparison = 0;
    if (column === 'salesAmount' || column === 'currencyCode') {
      for (const currency of currencies) {
        const av =
            a.amountsByCurrency.find((m) => m.currencyCode === currency)
              ?.amount ?? '0',
          bv =
            b.amountsByCurrency.find((m) => m.currencyCode === currency)
              ?.amount ?? '0';
        comparison = new Prisma.Decimal(av).comparedTo(bv);
        if (comparison) break;
      }
    } else if (column === 'orderCount' || column === 'passengerCount')
      comparison = a[column] - b[column];
    else
      comparison = a[
        column === 'primaryDimension'
          ? 'primaryDimension'
          : 'secondaryDimension'
      ].localeCompare(
        b[
          column === 'primaryDimension'
            ? 'primaryDimension'
            : 'secondaryDimension'
        ],
        'fa',
      );
    return (
      comparison * (query.sort?.direction === 'ASC' ? 1 : -1) ||
      a.grainId.localeCompare(b.grainId)
    );
  });
  return {
    ...result,
    reportVersion: 4,
    grain: 'CONTRACT',
    dataLayout: 'SOURCE_COLUMNS',
    chartMeasure: 'salesAmount',
    columns: [
      { key: 'primaryDimension', label: 'شعبه', kind: 'TEXT' },
      { key: 'secondaryDimension', label: 'کارشناس', kind: 'TEXT' },
      { key: 'orderCount', label: 'تعداد قرارداد', kind: 'NUMBER' },
      { key: 'passengerCount', label: 'تعداد مسافر', kind: 'NUMBER' },
      { key: 'salesAmount', label: 'مبالغ قرارداد به تفکیک ارز', kind: 'TEXT' },
    ],
    rows: includeAllRows
      ? rows
      : rows.slice(
          (query.page - 1) * query.pageSize,
          query.page * query.pageSize,
        ),
    total: rows.length,
    filterSnapshot: {
      ...result.filterSnapshot,
      reportVersion: 4,
      grain: 'CONTRACT',
    },
  };
}
