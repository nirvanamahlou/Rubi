import type { SalesPriceComponentInput } from '@nora/contracts';
import { calculateSalesBalances, sumSalesDecimals } from './sales.domain';
export const SALES_ASSISTANT_STATUSES = [
  'CONFIRMED',
  'SENT_TO_RESERVATIONS',
  'IN_PROGRESS',
  'COMPLETED',
] as const;
export const SALES_ASSISTANT_LIMIT = 5000;

export function tehranMidnight(day: Date): Date {
  const target = Date.UTC(
    day.getUTCFullYear(),
    day.getUTCMonth(),
    day.getUTCDate(),
  );
  let candidate = target;
  const format = new Intl.DateTimeFormat('en-GB-u-ca-gregory', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const candidates: number[] = [];
  for (let i = 0; i < 4; i++) {
    const parts = Object.fromEntries(
      format
        .formatToParts(new Date(candidate))
        .map((part) => [part.type, part.value]),
    );
    const wall = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    if (wall >= target && wall < target + 86400000) candidates.push(candidate);
    candidate += target - wall;
  }
  // A historical DST gap can skip midnight; select the first real instant of that civil day.
  return new Date(Math.min(...candidates));
}

export function salesAssistantWindows(now: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB-u-ca-gregory', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  const today = new Date(
    Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)),
  );
  const shift = (days: number) =>
    tehranMidnight(new Date(today.getTime() - days * 86400000));
  return {
    current: {
      startUtc: shift(7).toISOString(),
      endUtc: shift(0).toISOString(),
    },
    previous: {
      startUtc: shift(14).toISOString(),
      endUtc: shift(7).toISOString(),
    },
  };
}

export interface AssistantContractFact {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  confirmedAt: Date | null;
  status: string;
  originId: string;
  destinationId: string;
  _count: { passengers: number };
  priceComponents?: readonly SalesPriceComponentInput[];
}

export function buildSalesAssistantReport(
  facts: readonly AssistantContractFact[],
  now: Date,
  periods = salesAssistantWindows(now),
) {
  const eligible = [
    ...new Map(
      facts
        .filter(
          (fact) =>
            fact.confirmedAt &&
            fact.confirmedAt <= now &&
            SALES_ASSISTANT_STATUSES.some((status) => status === fact.status),
        )
        .map((fact) => [fact.id, fact]),
    ).values(),
  ];
  const summarize = (period: { startUtc: string; endUtc: string }) => {
    const selected = eligible.filter(
      (fact) =>
        fact.createdAt.toISOString() >= period.startUtc &&
        fact.createdAt.toISOString() < period.endUtc,
    );
    const routes = new Map<
      string,
      {
        originId: string;
        destinationId: string;
        contractCount: number;
        passengerCount: number;
      }
    >();
    for (const fact of selected) {
      const key = `${fact.originId}:${fact.destinationId}`;
      const route = routes.get(key) ?? {
        originId: fact.originId,
        destinationId: fact.destinationId,
        contractCount: 0,
        passengerCount: 0,
      };
      route.contractCount++;
      route.passengerCount += fact._count.passengers;
      routes.set(key, route);
    }
    return {
      ...period,
      contractCount: selected.length,
      passengerCount: selected.reduce(
        (total, fact) => total + fact._count.passengers,
        0,
      ),
      ...(facts.every((fact) => fact.priceComponents !== undefined)
        ? {
            contractAmountsBeforeRefunds: [
              ...new Set(
                selected.flatMap((fact) =>
                  fact.priceComponents!.map((row) => row.currencyCode),
                ),
              ),
            ]
              .sort()
              .map((currencyCode) => ({
                currencyCode,
                amount: sumSalesDecimals(
                  selected
                    .flatMap((fact) =>
                      calculateSalesBalances(fact.priceComponents!, []),
                    )
                    .filter((row) => row.currencyCode === currencyCode)
                    .map((row) => row.amount),
                ),
              })),
          }
        : {}),
      routes: [...routes.values()].sort(
        (a, b) =>
          b.contractCount - a.contractCount ||
          `${a.originId}:${a.destinationId}`.localeCompare(
            `${b.originId}:${b.destinationId}`,
          ),
      ),
    };
  };
  return {
    version: 1,
    source: 'sales.assistant.weekly.v1',
    scope: 'ALL_AUTHORIZED_SALES',
    timeBasis: 'CREATED_AT',
    timeZone: 'Asia/Tehran',
    observedAt: now.toISOString(),
    sourceUpdatedAt: eligible.length
      ? new Date(
          Math.max(...eligible.map((fact) => fact.updatedAt.getTime())),
        ).toISOString()
      : null,
    current: summarize(periods.current),
    previous: summarize(periods.previous),
    coverage: {
      rowLimit: SALES_ASSISTANT_LIMIT,
      routeBasis: 'PRIMARY_CONTRACT_ROUTE',
      truncated: false,
    },
    unavailable: [
      'NET_SALES_REFUND_SOURCE_PENDING',
      'CONTACT_COHORT_SOURCE_PENDING',
      'MULTI_ROUTE_PROJECTION_PENDING',
    ],
  };
}
