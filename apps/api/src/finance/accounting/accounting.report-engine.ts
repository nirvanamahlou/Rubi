import { DecimalValue } from '../finance.money';
import * as v from './accounting.validation';

export interface InternalReportLine {
  id: string;
  accountId: string;
  accountCode: string;
  accountTitle: string;
  detail4Id: string | null;
  detail5Id: string | null;
  detail6Id: string | null;
  documentDate: string;
  journalId: string;
  debit: string;
  credit: string;
  currency: string | null;
  foreignAmount: string | null;
  opening?: boolean;
}
const axes = [
  'account',
  'detail4',
  'detail5',
  'detail6',
  'month',
  'currency',
] as const;
export type ReportAxis = (typeof axes)[number];
export function reportAxes(value: unknown): ReportAxis[] {
  if (value !== undefined && typeof value !== 'string')
    v.invalid('ابعاد گزارش معتبر نیستند.');
  const parts = typeof value === 'string' ? value.split(',') : ['account'];
  if (
    !parts.length ||
    parts.length > axes.length ||
    new Set(parts).size !== parts.length ||
    parts.some((p) => !axes.includes(p as ReportAxis))
  )
    v.invalid('ابعاد گزارش معتبر نیستند.');
  return parts as ReportAxis[];
}
const dimension = (r: InternalReportLine, axis: ReportAxis) =>
  axis === 'account'
    ? r.accountId
    : axis === 'month'
      ? r.documentDate.slice(0, 7)
      : axis === 'currency'
        ? r.currency
        : r[`${axis}Id`];

/** I11–I14: one set of source lines, exact base totals, separate foreign currencies. */
export function aggregateInternalReport(
  lines: InternalReportLine[],
  dimensions: ReportAxis[],
  from: string,
) {
  const groups = new Map<
    string,
    {
      key: string;
      dimensions: Record<string, string | null>;
      accountCode: string | null;
      accountTitle: string | null;
      opening: DecimalValue;
      debit: DecimalValue;
      credit: DecimalValue;
      foreign: Map<string, DecimalValue>;
      sourceLineIds: string[];
    }
  >();
  let totalDebit = DecimalValue.zero(),
    totalCredit = DecimalValue.zero();
  for (const line of lines) {
    const dims = Object.fromEntries(
      dimensions.map((axis) => [axis, dimension(line, axis)]),
    );
    const key = JSON.stringify(dims);
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        dimensions: dims,
        accountCode: dimensions.includes('account') ? line.accountCode : null,
        accountTitle: dimensions.includes('account') ? line.accountTitle : null,
        opening: DecimalValue.zero(),
        debit: DecimalValue.zero(),
        credit: DecimalValue.zero(),
        foreign: new Map(),
        sourceLineIds: [],
      };
      groups.set(key, group);
    }
    const debit = DecimalValue.parse(line.debit),
      credit = DecimalValue.parse(line.credit);
    if (line.documentDate < from)
      group.opening = group.opening.add(debit).subtract(credit);
    else {
      group.debit = group.debit.add(debit);
      group.credit = group.credit.add(credit);
      totalDebit = totalDebit.add(debit);
      totalCredit = totalCredit.add(credit);
    }
    if (line.currency && line.foreignAmount) {
      const foreign = DecimalValue.parse(line.foreignAmount);
      group.foreign.set(
        line.currency,
        (group.foreign.get(line.currency) ?? DecimalValue.zero()).add(
          debit.isZero ? DecimalValue.zero().subtract(foreign) : foreign,
        ),
      );
    }
    group.sourceLineIds.push(line.id);
  }
  return {
    debit: totalDebit.toString(),
    credit: totalCredit.toString(),
    rows: [...groups.values()]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((g) => ({
        key: g.key,
        dimensions: g.dimensions,
        accountCode: g.accountCode,
        accountTitle: g.accountTitle,
        opening: g.opening.toString(),
        debit: g.debit.toString(),
        credit: g.credit.toString(),
        balance: g.opening.add(g.debit).subtract(g.credit).toString(),
        foreignBalances: Object.fromEntries(
          [...g.foreign.entries()].map(([currency, amount]) => [
            currency,
            amount.toString(),
          ]),
        ),
        sourceLineIds: g.sourceLineIds,
      })),
  };
}

/** I09: explicit document-date FIFO estimate, never advertised as invoice settlement. */
export function ageInternalLines(lines: InternalReportLine[], asOf: string) {
  const groups = new Map<string, InternalReportLine[]>();
  for (const line of lines) {
    const key = JSON.stringify([
      line.accountId,
      line.detail4Id,
      line.detail5Id,
      line.detail6Id,
      line.currency,
    ]);
    groups.set(key, [...(groups.get(key) ?? []), line]);
  }
  return [...groups.entries()]
    .map(([key, values]) => {
      const net = values.reduce(
        (sum, r) =>
          sum
            .add(DecimalValue.parse(r.debit))
            .subtract(DecimalValue.parse(r.credit)),
        DecimalValue.zero(),
      );
      const positive = values
        .filter(
          (r) =>
            !(
              net.isNegative
                ? DecimalValue.parse(r.credit)
                : DecimalValue.parse(r.debit)
            ).isZero,
        )
        .sort(
          (a, b) =>
            a.documentDate.localeCompare(b.documentDate) ||
            a.journalId.localeCompare(b.journalId) ||
            a.id.localeCompare(b.id),
        );
      let remaining = net.isNegative ? DecimalValue.zero().subtract(net) : net;
      const buckets = Array.from({ length: 5 }, () => DecimalValue.zero());
      const sources: { lineId: string; amount: string; days: number | null }[] =
        [];
      let unknownAge = DecimalValue.zero();
      // FIFO consumes earliest charges first; residual obligations are the newest charges.
      for (const line of [...positive].reverse()) {
        if (remaining.isZero) break;
        const amount = DecimalValue.parse(
          net.isNegative ? line.credit : line.debit,
        );
        const residual = amount.compare(remaining) > 0 ? remaining : amount;
        const days = Math.floor(
          (Date.parse(`${asOf}T00:00:00Z`) -
            Date.parse(`${line.documentDate}T00:00:00Z`)) /
            86400000,
        );
        if (!Number.isFinite(days) || days < 0)
          v.invalid('تاریخ مبنای تجزیه سنی معتبر نیست.');
        const index =
          days <= 30
            ? 0
            : days <= 60
              ? 1
              : days <= 90
                ? 2
                : days <= 120
                  ? 3
                  : 4;
        if (line.opening) unknownAge = unknownAge.add(residual);
        else buckets[index] = buckets[index]!.add(residual);
        remaining = remaining.subtract(residual);
        sources.push({
          lineId: line.id,
          amount: residual.toString(),
          days: line.opening ? null : days,
        });
      }
      return {
        key,
        accountId: values[0]!.accountId,
        accountCode: values[0]!.accountCode,
        accountTitle: values[0]!.accountTitle,
        detail4Id: values[0]!.detail4Id,
        detail5Id: values[0]!.detail5Id,
        detail6Id: values[0]!.detail6Id,
        currency: values[0]!.currency,
        side: net.isNegative ? 'CREDIT' : 'DEBIT',
        balance: net.toString(),
        buckets: buckets.map((x) => x.toString()),
        unknownAge: unknownAge.toString(),
        sources,
      };
    })
    .filter((r) => r.balance !== '0');
}
