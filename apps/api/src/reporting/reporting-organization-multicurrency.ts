import { selectReportRows } from './reporting-page';
import { Prisma } from '@nora/database';
import type {
  ReportQueryV1,
  TravelReportResultV1,
} from './reporting.contracts';
import type { SalesReportingRow } from '../sales/sales-reporting.public';

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
export function createOrganizationMultiCurrencyProjection(
  query: ReportQueryV1,
  includeAllRows: boolean,
  labels: {
    branches: ReadonlyMap<string, string>;
    users: ReadonlyMap<string, string>;
  },
  grouping?: {
    dimensions: (
      row: SalesReportingRow,
    ) => readonly [string, string, string, string];
    labels: readonly [string, string];
  },
) {
  const groups = new Map<
    string,
    {
      grainId: string;
      primaryDimension: string;
      secondaryDimension: string;
      passengerCount: number;
      contracts: Map<string, number>;
      money: Map<string, Prisma.Decimal>;
    }
  >();
  const sourceCurrencies = new Set<string>();
  const add = (row: SalesReportingRow) => {
    sourceCurrencies.add(row.currencyCode);
    const [primaryId, secondaryId, primaryLabel, secondaryLabel] = grouping
      ? grouping.dimensions(row)
      : [
          row.branchId,
          row.ownerUserId,
          labels.branches.get(row.branchId) ?? row.branchId,
          labels.users.get(row.ownerUserId) ?? row.ownerUserId,
        ];
    const key = JSON.stringify([primaryId, secondaryId]);
    const g = groups.get(key) ?? {
      grainId: key,
      primaryDimension: primaryLabel,
      secondaryDimension: secondaryLabel,
      passengerCount: 0,
      contracts: new Map<string, number>(),
      money: new Map<string, Prisma.Decimal>(),
    };
    g.passengerCount += row.passengerCount - (g.contracts.get(row.id) ?? 0);
    g.contracts.set(row.id, row.passengerCount);
    g.money.set(
      row.currencyCode,
      (g.money.get(row.currencyCode) ?? new Prisma.Decimal(0)).plus(
        row.salesAmount,
      ),
    );
    groups.set(key, g);
  };
  const finish = (result: TravelReportResultV1): TravelReportResultV1 => {
    const currencies = currencyOrder([...sourceCurrencies]);
    // Mixed currencies cannot be ranked by amount without an approved FX policy.
    const requestedColumn =
      query.sort?.column ?? (grouping ? 'orderCount' : 'salesAmount');
    const column =
      grouping && ['salesAmount', 'currencyCode'].includes(requestedColumn)
        ? 'orderCount'
        : requestedColumn;
    const zero = new Prisma.Decimal(0);
    const selected = selectReportRows(
      groups.values(),
      groups.size,
      query,
      includeAllRows,
      (a, b) => {
        let comparison = 0;
        if (column === 'salesAmount' || column === 'currencyCode') {
          for (const currency of currencies) {
            const av = a.money.get(currency) ?? zero;
            const bv = b.money.get(currency) ?? zero;
            comparison = av.comparedTo(bv);
            if (comparison) break;
          }
        } else if (column === 'orderCount')
          comparison = a.contracts.size - b.contracts.size;
        else if (column === 'passengerCount')
          comparison = a.passengerCount - b.passengerCount;
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
      },
    );
    const rows = selected.map((g) => {
      const amountsByCurrency = currencyOrder([...g.money.keys()]).map(
        (currencyCode) => ({
          currencyCode,
          amount: g.money.get(currencyCode)!.toString(),
        }),
      );
      const orderCount = g.contracts.size;
      const { grainId, primaryDimension, secondaryDimension, passengerCount } =
        g;
      return {
        grainId,
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
            .join(' + '),
        },
      };
    });
    return {
      ...result,
      reportVersion: grouping ? 2 : 4,
      grain: 'CONTRACT',
      dataLayout: 'SOURCE_COLUMNS',
      chartMeasure: 'salesAmount',
      columns: [
        {
          key: 'primaryDimension',
          label: grouping?.labels[0] ?? 'شعبه',
          kind: 'TEXT',
        },
        {
          key: 'secondaryDimension',
          label: grouping?.labels[1] ?? 'کارشناس',
          kind: 'TEXT',
        },
        { key: 'orderCount', label: 'تعداد قرارداد', kind: 'NUMBER' },
        { key: 'passengerCount', label: 'تعداد مسافر', kind: 'NUMBER' },
        {
          key: 'salesAmount',
          label: 'مبالغ قرارداد به تفکیک ارز',
          kind: 'TEXT',
        },
      ],
      rows,
      total: groups.size,
      ...(grouping
        ? {
            warnings: [
              ...result.warnings,
              'مرتب‌سازی مبلغ چندارزی تا تعیین مبنای نرخ تبدیل انجام نمی‌شود؛ ترتیب مبلغ بر اساس تعداد قرارداد است.',
            ],
          }
        : {}),
      filterSnapshot: {
        ...result.filterSnapshot,
        reportVersion: grouping ? 2 : 4,
        grain: 'CONTRACT',
      },
    };
  };
  return { add, finish };
}
