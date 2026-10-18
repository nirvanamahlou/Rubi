import { Prisma } from '@nora/database';
import * as v from './accounting.validation';

export const FINANCIAL_RULE_KIND = 'financial-event-rules';
export const financialDate = (date: Date) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tehran' }).format(date);

export function ruleMatches(
  attributes: Prisma.JsonValue,
  event: Prisma.FinanceAccountingEventGetPayload<object>,
) {
  const a = v.attributes(attributes);
  return a.kind === event.kind && a.currency === event.currency &&
    a.settlementAccountId === (event.settlementAccountId ?? '') &&
    a.partyId === (event.partyId ?? '') &&
    typeof a.effectiveFrom === 'string' && event.createdAt >= new Date(a.effectiveFrom);
}

/** Build lines only from the immutable source amount; callers cannot override it. */
export function financialEventLines(
  event: Prisma.FinanceAccountingEventGetPayload<object>,
  mapping: Record<string, unknown>,
) {
  return ['debit', 'credit'].map((side) => ({
    accountId: v.uuid(mapping[`${side}AccountId`])!,
    detail4Id: v.uuid(mapping[`${side}Detail4Id`], true),
    detail5Id: v.uuid(mapping[`${side}Detail5Id`], true),
    detail6Id: v.uuid(mapping[`${side}Detail6Id`], true),
    debit: side === 'debit' ? event.amount.toString() : '0',
    credit: side === 'credit' ? event.amount.toString() : '0',
    description: event.kind,
    attributes: { trackingNumber: event.requestId },
  }));
}
