import { exchangePaymentSource } from '../exchange-offices/exchange-payment';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@nora/database';
import type { MasterProcurementDirectory } from '../../master-data/master-procurement-directory';

export async function paymentSource(
  tx: Prisma.TransactionClient,
  directory: MasterProcurementDirectory | undefined,
  input: {
    accountId?: string | null;
    payingSupplierId?: string | null;
    exchangeOfficeId?: string | null;
  },
  currencyCode: string,
  branchId: string,
  policy:
    | 'SUPPLIER_FOR_FOREIGN'
    | 'ACCOUNT_ONLY'
    | 'ACCOUNT_OR_SUPPLIER' = 'SUPPLIER_FOR_FOREIGN',
) {
  if (input.exchangeOfficeId) {
    if (
      policy !== 'ACCOUNT_OR_SUPPLIER' ||
      input.accountId ||
      input.payingSupplierId
    )
      throw new BadRequestException('منبع پرداخت معتبر نیست.');
    return exchangePaymentSource(tx, input.exchangeOfficeId, currencyCode);
  }
  if (
    (policy === 'ACCOUNT_OR_SUPPLIER' && input.payingSupplierId) ||
    (currencyCode !== 'IRR' && policy === 'SUPPLIER_FOR_FOREIGN')
  ) {
    if (!input.payingSupplierId || input.accountId || !directory)
      throw new BadRequestException(
        'برای پرداخت ارزی تأمین‌کننده پرداخت‌کننده را انتخاب کنید.',
      );
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        input.payingSupplierId,
      )
    )
      throw new BadRequestException('اطلاعات پرداخت معتبر نیست.');
    const supplier = await directory.supplier(input.payingSupplierId, tx);
    return {
      account: null,
      payingSupplierId: supplier.id,
      payingSupplierName: supplier.label,
      exchangeOfficeId: null,
      exchangeOfficeName: null,
    };
  }
  if (!input.accountId || input.payingSupplierId)
    throw new BadRequestException('حساب فعال هم‌ارز برای پرداخت معتبر نیست.');
  const account = await tx.financeSettlementAccount.findFirst({
    where: {
      id: input.accountId,
      branchId,
      currencyCode:
        policy === 'ACCOUNT_OR_SUPPLIER' && currencyCode !== 'IRR'
          ? { in: [currencyCode, 'IRR'] }
          : currencyCode,
      isActive: true,
    },
  });
  if (!account || account.currencyCode === null || account.branchId === null)
    throw new BadRequestException('حساب فعال هم‌ارز برای پرداخت معتبر نیست.');
  return {
    account: {
      ...account,
      currencyCode: account.currencyCode,
      branchId: account.branchId,
    },
    payingSupplierId: null,
    payingSupplierName: null,
    exchangeOfficeId: null,
    exchangeOfficeName: null,
  };
}

/** The original foreign payment settles the supplier debt. The cash event must
 * match the real bank-account currency using the persisted actual equivalent. */
export function purchasePaymentCashMoney(
  account: { currencyCode: string } | null,
  currencyCode: string,
  paidAmount: string,
  rialEquivalent?: string | null,
) {
  if (!account || account.currencyCode === currencyCode)
    return { amount: paidAmount, currency: currencyCode };
  if (
    account.currencyCode !== 'IRR' ||
    currencyCode === 'IRR' ||
    !rialEquivalent
  )
    throw new BadRequestException('اطلاعات پرداخت معتبر نیست.');
  let amount: Prisma.Decimal;
  try {
    amount = new Prisma.Decimal(rialEquivalent).toDecimalPlaces(
      4,
      Prisma.Decimal.ROUND_HALF_UP,
    );
  } catch {
    throw new BadRequestException('اطلاعات پرداخت معتبر نیست.');
  }
  if (!amount.isFinite() || amount.lte(0))
    throw new BadRequestException('اطلاعات پرداخت معتبر نیست.');
  return { amount: amount.toString(), currency: 'IRR' };
}
