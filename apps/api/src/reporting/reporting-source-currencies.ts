import { Prisma } from '@nora/database';
import type { ReportSource } from '../common/report-source';
import { currencyValues } from './reporting-currency-values';

/** Consolidate only identities explicitly supplied by the owning module. */
export function consolidateSourceCurrencies(
  source: ReportSource,
): ReportSource {
  const money = source.columns.filter((c) => c.kind === 'MONEY');
  if (!money.length || !source.rows.some((r) => r.values.currencyCode))
    return source;
  const groups = new Map<string, (typeof source.rows)[number][]>();
  for (const row of source.rows) {
    const key = row.currencyGroupId ?? row.id;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  return {
    ...source,
    columns: source.columns
      .filter((c) => c.key !== 'currencyCode')
      .map((c) => (c.kind === 'MONEY' ? { ...c, kind: 'TEXT' as const } : c)),
    rows: [...groups].map(([id, rows]) => {
      const values = { ...rows[0]!.values };
      const amounts = new Map<string, Map<string, Prisma.Decimal>>();
      for (const column of money) {
        const byCurrency = new Map<string, Prisma.Decimal>();
        for (const row of rows) {
          const code = String(row.values.currencyCode);
          byCurrency.set(
            code,
            (byCurrency.get(code) ?? new Prisma.Decimal(0)).plus(
              String(row.values[column.key] ?? 0),
            ),
          );
        }
        amounts.set(column.key, byCurrency);
        values[column.key] = currencyValues(
          new Map(
            [...byCurrency].map(([code, value]) => [code, value.toString()]),
          ),
        );
      }
      for (const column of source.columns.filter((c) => c.kind === 'NUMBER')) {
        const identities = rows.flatMap(
          (r) => r.distinctCounts?.[column.key] ?? [],
        );
        values[column.key] = rows.every((r) => r.distinctCounts?.[column.key])
          ? new Set(identities).size
          : rows.reduce((sum, r) => sum + Number(r.values[column.key] ?? 0), 0);
      }
      delete values.currencyCode;
      return {
        id,
        at: rows[0]!.at,
        updatedAt: new Date(
          rows.reduce(
            (latest, row) => Math.max(latest, row.updatedAt.getTime()),
            -Infinity,
          ),
        ),
        values,
        chartAmounts: [...(amounts.get(source.chartMeasure) ?? [])].map(
          ([currencyCode, amount]) => ({
            currencyCode,
            amount: amount.toString(),
          }),
        ),
      };
    }),
  };
}
