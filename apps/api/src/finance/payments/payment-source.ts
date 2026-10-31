import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@nora/database';
import type { MasterProcurementDirectory } from '../../master-data/master-procurement-directory';

export async function paymentSource(
  tx: Prisma.TransactionClient,
  directory: MasterProcurementDirectory | undefined,
  input: { accountId?: string | null; payingSupplierId?: string | null },
  currencyCode: string,
  branchId: string,
  policy: 'SUPPLIER_FOR_FOREIGN' | 'ACCOUNT_ONLY' = 'SUPPLIER_FOR_FOREIGN',
) {
  if (currencyCode !== 'IRR' && policy !== 'ACCOUNT_ONLY') {
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
    };
  }
  if (!input.accountId || input.payingSupplierId)
    throw new BadRequestException('حساب فعال هم‌ارز برای پرداخت معتبر نیست.');
  const account = await tx.financeSettlementAccount.findFirst({
    where: { id: input.accountId, branchId, currencyCode, isActive: true },
  });
  if (!account)
    throw new BadRequestException('حساب فعال هم‌ارز برای پرداخت معتبر نیست.');
  return { account, payingSupplierId: null, payingSupplierName: null };
}
