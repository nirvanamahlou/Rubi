import { accountingFinancialEventLabels } from '@nora/contracts';
import type { Prisma } from '@nora/database';
import * as v from './accounting.validation';
import { DecimalValue } from '../finance.money';

export const FINANCIAL_RULE_KIND = 'financial-event-rules';
export const financialDate = (date: Date) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tehran' }).format(date);

export function ruleMatches(
  attributes: Prisma.JsonValue,
  event: Prisma.FinanceAccountingEventGetPayload<object>,
) {
  const a = v.attributes(attributes);
  return (
    a.kind === event.kind &&
    a.currency === event.currency &&
    a.settlementAccountId === (event.settlementAccountId ?? '') &&
    a.partyId === (event.partyId ?? '') &&
    typeof a.effectiveFrom === 'string' &&
    event.createdAt >= new Date(a.effectiveFrom)
  );
}

/** Build lines only from the immutable source amount; callers cannot override it. */
export function financialEventLines(
  event: Prisma.FinanceAccountingEventGetPayload<object>,
  mapping: Record<string, unknown>,
  fx?: { id: string; rate: Prisma.Decimal; baseCurrency: string },
) {
  const amount = fx
    ? DecimalValue.parse(event.amount.toString())
        .multiply(DecimalValue.parse(fx.rate.toString()))
        .round(
          fx.baseCurrency === 'IRR' ? 0 : 2,
          fx.baseCurrency === 'IRR' ? 'HALF_UP' : 'HALF_EVEN',
        )
        .toString()
    : event.amount.toString();
  return ['debit', 'credit'].map((side) => ({
    accountId: v.uuid(mapping[`${side}AccountId`])!,
    detail4Id: v.uuid(mapping[`${side}Detail4Id`], true),
    detail5Id: v.uuid(mapping[`${side}Detail5Id`], true),
    detail6Id: v.uuid(mapping[`${side}Detail6Id`], true),
    debit: side === 'debit' ? amount : '0',
    credit: side === 'credit' ? amount : '0',
    ...(fx
      ? {
          currency: event.currency,
          foreignAmount: event.amount.toString(),
          rate: fx.rate.toString(),
          fxSnapshotId: fx.id,
        }
      : {}),
    description: accountingFinancialEventLabels[event.kind] ?? 'عملیات مالی',
    attributes: {
      trackingNumber: event.trackingNumber ?? event.requestId,
      trackingDate: event.trackingDate ?? financialDate(event.occurredAt),
    },
  }));
}
