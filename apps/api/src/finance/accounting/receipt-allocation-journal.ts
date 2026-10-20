import { ConflictException } from '@nestjs/common';
import type { Prisma } from '@nora/database';
import { accountingFinancialEventLabels } from '@nora/contracts';
import * as v from './accounting.validation';
import type { PostedReceiptBasis } from './receipt-funds.public';
import { financialDate } from './accounting.financial-events';

export function receiptAllocationLines(
  event: Prisma.FinanceAccountingEventGetPayload<object>,
  basis: PostedReceiptBasis,
) {
  if (
    !event.carryingAmount?.isPositive() ||
    event.basisEventId !== basis.event.id ||
    event.carryingCurrency !== basis.journal.book.baseCurrency ||
    event.currency !== basis.event.currency ||
    !basis.credit.accountId ||
    !event.trackingNumber ||
    !event.trackingDate
  )
    throw new ConflictException('مبنای دفتری رویداد تخصیص معتبر نیست.');
  const original = v.attributes(basis.credit.attributes);
  const sourceTracking = {
    trackingNumber: String(
      original.trackingNumber ??
        basis.event.trackingNumber ??
        basis.event.requestId,
    ),
    trackingDate: String(
      original.trackingDate ??
        basis.event.trackingDate ??
        financialDate(basis.event.occurredAt),
    ),
  };
  const targetTracking = {
    trackingNumber: event.trackingNumber,
    trackingDate: event.trackingDate,
  };
  const reverse = event.kind === 'RECEIPT_ALLOCATION_REVERSAL';
  return [0, 1].map((index) => ({
    accountId: basis.credit.accountId!,
    detail4Id: basis.credit.detail4Id,
    detail5Id: basis.credit.detail5Id,
    detail6Id: basis.credit.detail6Id,
    debit: index === 0 ? event.carryingAmount!.toString() : '0',
    credit: index === 1 ? event.carryingAmount!.toString() : '0',
    description: accountingFinancialEventLabels[event.kind] ?? 'تخصیص دریافت',
    ...(basis.credit.currency &&
    basis.credit.currency !== basis.journal.book.baseCurrency
      ? {
          currency: basis.credit.currency,
          foreignAmount: event.amount.toString(),
          rate: basis.credit.rate!.toString(),
          fxSnapshotId: basis.credit.fxSnapshotId,
        }
      : {}),
    attributes: (index === 0) !== reverse ? sourceTracking : targetTracking,
  }));
}
