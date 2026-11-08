import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@nora/database';
import { bankUuid } from '../bank-accounts/bank-account.validation';

export async function exchangePaymentSource(
  tx: Prisma.TransactionClient,
  officeId: string,
  currencyCode: string,
) {
  const office = await tx.financeExchangeOffice.findFirst({
    where: { id: bankUuid(officeId), isActive: true, deletedAt: null },
    select: {
      id: true,
      title: true,
      balances: { where: { currencyCode }, select: { id: true } },
    },
  });
  if (!office || !office.balances.length)
    throw new BadRequestException('صرافی فعال با موجودی این ارز یافت نشد.');
  return {
    account: null,
    payingSupplierId: null,
    payingSupplierName: null,
    exchangeOfficeId: office.id,
    exchangeOfficeName: office.title,
  };
}
/** Must run in the payment transaction, only after its replay/version guard. */
export async function debitExchange(
  tx: Prisma.TransactionClient,
  input: {
    officeId?: string | null;
    currencyCode: string;
    amount: string;
    actorUserId: string;
    supplierPaymentId?: string;
    ticketPaymentId?: string;
    invoicePaymentId?: string;
  },
) {
  if (!input.officeId) return;
  const amount = new Prisma.Decimal(input.amount);
  if (
    !amount.isFinite() ||
    amount.lte(0) ||
    amount.decimalPlaces() > 4 ||
    amount.gte('100000000000000000000')
  )
    throw new BadRequestException('مبلغ پرداخت صرافی معتبر نیست.');
  const office = await tx.financeExchangeOffice.updateMany({
    where: { id: input.officeId, isActive: true, deletedAt: null },
    data: { version: { increment: 1 } },
  });
  if (office.count !== 1)
    throw new ConflictException('صرافی غیرفعال یا حذف شده است.');
  const changed = await tx.financeExchangeBalance.updateMany({
    where: {
      officeId: input.officeId,
      currencyCode: input.currencyCode,
      amount: { gte: amount },
    },
    data: { amount: { decrement: amount } },
  });
  if (changed.count !== 1)
    throw new BadRequestException('موجودی صرافی برای این پرداخت کافی نیست.');
  const balance = await tx.financeExchangeBalance.findUniqueOrThrow({
    where: {
      officeId_currencyCode: {
        officeId: input.officeId,
        currencyCode: input.currencyCode,
      },
    },
  });
  await tx.financeExchangeMovement.create({
    data: {
      balanceId: balance.id,
      delta: amount.negated(),
      afterAmount: balance.amount,
      kind: 'PAYMENT',
      actorUserId: input.actorUserId,
      supplierPaymentId: input.supplierPaymentId ?? null,
      ticketPaymentId: input.ticketPaymentId ?? null,
      invoicePaymentId: input.invoicePaymentId ?? null,
    },
  });
}
