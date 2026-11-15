import type { FinanceInboxItemV1 } from '@nora/contracts';
import {
  currentFinanceFiscalRequest,
  financeFiscalDay,
  FinanceFiscalStorage,
} from './finance-fiscal-storage';
import { decimalUnits, isClosedFinanceItem } from '../finance-inbox-query';

/** Source obligations stay intact. Old open balances are a distinct, linked projection. */
export function fiscalInboxItems(items: FinanceInboxItemV1[]) {
  const scope = currentFinanceFiscalRequest();
  const period = new FinanceFiscalStorage().require();
  if (!scope || !period) return items;
  return items.flatMap((item): FinanceInboxItemV1[] => {
    const date = financeFiscalDay(item.createdAt);
    if (!date || date > period.endDate) return [];
    if (date >= period.startDate) return [{ ...item, fiscalBucket: 'CURRENT' }];
    if (isClosedFinanceItem(item)) return [];
    // Mixed-currency reservation envelopes retain separate exact currency balances.
    const balances = item.reservationPurchase
      ? item.reservationPurchase.lines
          .filter(
            (line) =>
              line.status !== 'REJECTED' &&
              decimalUnits(line.remainingAmount) > 0n,
          )
          .map((line) => ({
            currencyCode: line.currencyCode,
            originalAmount: line.amount,
            remainingAmount: line.remainingAmount,
          }))
      : item.amount &&
          decimalUnits(item.settlement?.remainingAmount ?? item.amount.amount) >
            0n
        ? [
            {
              currencyCode: item.amount.currencyCode,
              originalAmount: item.amount.amount,
              remainingAmount:
                item.settlement?.remainingAmount ?? item.amount.amount,
            },
          ]
        : [];
    if (!balances.length) return [];
    const origin = scope.periods.find(
      (year) => date >= year.startDate && date <= year.endDate,
    );
    return [
      {
        ...item,
        fiscalBucket: 'CARRY_FORWARD',
        carryForward: {
          originalDate: item.createdAt,
          originalPeriodId: origin?.id ?? null,
          originalYearTitle: origin?.title ?? null,
          balances,
        },
      },
    ];
  });
}
