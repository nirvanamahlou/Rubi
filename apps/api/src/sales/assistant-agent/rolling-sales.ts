import { BadRequestException, ConflictException } from '@nestjs/common';
import type { DatabaseClient } from '@nora/database';
import { randomUUID } from 'node:crypto';
import { readReservationReportingCancellations } from '../../reservations/reservation-reporting-cancellations.public';
import {
  SALES_ASSISTANT_LIMIT,
  SALES_ASSISTANT_STATUSES,
  tehranMidnight,
} from '../sales-assistant-report';
import { calculateSalesBalances, sumSalesDecimals } from '../sales.domain';
import type { AgentScope } from './query.service';

export function rollingSalesPeriod(asOf: unknown) {
  if (
    typeof asOf !== 'string' ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(asOf)
  )
    throw new BadRequestException('INVALID_SALES_PERIOD');
  const end = new Date(asOf);
  if (!Number.isFinite(end.getTime()) || end.toISOString() !== asOf)
    throw new BadRequestException('INVALID_SALES_PERIOD');
  const civil = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(end);
  const start = tehranMidnight(
    new Date(Date.parse(civil + 'T00:00:00Z') - 13 * 86400000),
  );
  return { start, end };
}

export function rollingSalesFilter(asOf: string) {
  const { start, end } = rollingSalesPeriod(asOf);
  return {
    status: { in: [...SALES_ASSISTANT_STATUSES] },
    createdAt: { gte: start, lt: end },
    confirmedAt: { lte: end },
  };
}

export async function readRollingSales(
  database: DatabaseClient,
  scope: AgentScope,
  asOf: string,
) {
  const filter = rollingSalesFilter(asOf);
  const receipt = await readStandardSales(
    database,
    scope,
    asOf,
    filter.createdAt,
  );
  return { ...receipt, start: filter.createdAt.gte.toISOString(), end: asOf };
}

export async function readStandardSalesSummary(
  database: DatabaseClient,
  scope: AgentScope,
) {
  const cutoff = new Date();
  const { observedAt, total, totals, missingAmounts } = await readStandardSales(
    database,
    scope,
    cutoff.toISOString(),
    { lt: cutoff },
  );
  return {
    version: 1,
    metric: 'standard-sales',
    asOf: cutoff.toISOString(),
    observedAt,
    total,
    totals,
    missingAmounts,
  };
}

async function readStandardSales(
  database: DatabaseClient,
  scope: AgentScope,
  asOf: string,
  createdAt: { lt: Date; gte?: Date },
) {
  return database.$transaction(
    async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      await tx.$executeRaw`SET LOCAL statement_timeout = '5000ms'`;
      const records = await tx.salesContract.findMany({
        where: {
          createdAt,
          status: { in: [...SALES_ASSISTANT_STATUSES] },
          confirmedAt: { lte: new Date(asOf) },
          hiddenAt: null,
          ...(scope.companyId ? { legalEntityId: scope.companyId } : {}),
          ...(scope.mode !== 'all'
            ? { branchId: { in: [...scope.branchIds] } }
            : {}),
          ...(scope.mode === 'own' ? { ownerUserId: scope.userId } : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        select: {
          id: true,
          contractNumber: true,
          status: true,
          customerNameSnapshot: true,
          priceComponents: {
            select: {
              amount: true,
              currencyCode: true,
              type: true,
              title: true,
            },
          },
        },
        take: SALES_ASSISTANT_LIMIT + 1,
      });
      if (records.length > SALES_ASSISTANT_LIMIT)
        throw new ConflictException('SALES_SOURCE_CAP_EXCEEDED');
      const cancelled = await readReservationReportingCancellations(
        tx,
        records.map((row) => row.id),
      );
      const rows = records
        .filter((row) => !cancelled.has(row.id))
        .map((row) => ({
          number: row.contractNumber,
          customer: row.customerNameSnapshot,
          status: row.status,
          amounts: calculateSalesBalances(
            row.priceComponents.map((p) => ({
              ...p,
              amount: p.amount.toString(),
            })),
            [],
          ).map(({ currencyCode, amount }) => ({ currencyCode, amount })),
        }));
      const amounts = new Map<string, string[]>();
      for (const row of rows)
        for (const { currencyCode, amount } of row.amounts) {
          const bucket = amounts.get(currencyCode);
          if (bucket) bucket.push(amount);
          else amounts.set(currencyCode, [amount]);
        }
      return {
        version: 1,
        resultId: randomUUID(),
        observedAt: new Date().toISOString(),
        total: rows.length,
        missingAmounts: rows.filter((row) => !row.amounts.length).length,
        totals: Array.from(amounts, ([currencyCode, values]) => ({
          currencyCode,
          amount: sumSalesDecimals(values),
        })).sort((a, b) => a.currencyCode.localeCompare(b.currencyCode)),
        rows: rows.slice(0, 10),
        truncated: rows.length > 10,
      };
    },
    { isolationLevel: 'RepeatableRead', timeout: 8000 },
  );
}
