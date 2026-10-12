import type {
  SalesPaymentStatus,
  SalesPriceComponentInput,
} from '@nora/contracts';
import { calculateSalesBalances, sumSalesDecimals } from './sales.domain';

export interface ContractBalanceFact {
  id: string;
  contractNumber: string;
  updatedAt: Date;
  priceComponents: readonly SalesPriceComponentInput[];
  payments: readonly {
    amount: string;
    currencyCode: string;
    status: SalesPaymentStatus;
  }[];
}

/** Operational Sales balances only; not accounting receivables or refund-adjusted sales. */
export function buildAssistantBalances(
  facts: readonly ContractBalanceFact[],
  now: Date,
) {
  const rows = facts.map((fact) => ({
    contractId: fact.id,
    contractNumber: fact.contractNumber,
    href: '/sales',
    balances: calculateSalesBalances(fact.priceComponents, fact.payments),
  }));
  const balances = rows.flatMap((row) => row.balances);
  const currencies = [
    ...new Set(balances.map((row) => row.currencyCode)),
  ].sort();
  return {
    version: 1,
    source: 'sales.assistant.contract-balances.v1',
    scope: 'ALL_AUTHORIZED_SALES',
    observedAt: now.toISOString(),
    sourceUpdatedAt: facts.length
      ? new Date(
          Math.max(...facts.map((fact) => fact.updatedAt.getTime())),
        ).toISOString()
      : null,
    contractCount: facts.length,
    totals: currencies.map((currencyCode) => {
      const selected = balances.filter(
        (row) => row.currencyCode === currencyCode,
      );
      return {
        currencyCode,
        amount: sumSalesDecimals(selected.map((row) => row.amount)),
        confirmedPaid: sumSalesDecimals(
          selected.map((row) => row.confirmedPaid),
        ),
        pendingFinance: sumSalesDecimals(
          selected.map((row) => row.pendingFinance),
        ),
        outstanding: sumSalesDecimals(selected.map((row) => row.outstanding)),
      };
    }),
    items: rows
      .filter((row) =>
        row.balances.some(
          (balance) =>
            !balance.outstanding.startsWith('-') && balance.outstanding !== '0',
        ),
      )
      .slice(0, 30),
    coverage: {
      rowLimit: 5000,
      itemLimit: 30,
      itemsTruncated:
        rows.filter((row) =>
          row.balances.some(
            (balance) =>
              !balance.outstanding.startsWith('-') &&
              balance.outstanding !== '0',
          ),
        ).length > 30,
      basis: 'CURRENT_CONFIRMED_CONTRACTS',
      refundsIncluded: false,
    },
    unavailable: [
      'ACCOUNTING_RECEIVABLES_SOURCE_PENDING',
      'DUE_SCHEDULE_SOURCE_PENDING',
      'REFUND_ADJUSTMENT_SOURCE_PENDING',
    ],
  };
}
