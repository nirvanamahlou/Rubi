import { bankContractVisible } from '../../sales/finance-bank-contract.public';
import { currentFinanceFiscalRequest } from '../fiscal-context/finance-fiscal-storage';
import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@nora/database';
import type { Source } from './broker-transfer';
import {
  reservationBankPurchase,
  supersededReservationPurchase,
} from '../../reservations/bank-obligation.public';
import { purchaseBankInvoice } from '../../procurement/bank-obligation.public';
export async function readBankObligation(
  tx: Prisma.TransactionClient,
  source: Source,
  branchId: string,
  historical = false,
  asOf?: Date,
) {
  let brokerId: string | null = null,
    organizationId: string | null = null,
    contractId: string | null = null,
    contractNumber: string | null = null;
  let total: Prisma.Decimal, remaining: Prisma.Decimal, currency: string;
  if ('purchaseId' in source) {
    const p = await reservationBankPurchase(tx, source.purchaseId, branchId);
    const issuer = currentFinanceFiscalRequest()?.issuerCompanyId;
    if (
      !p ||
      (issuer &&
        !(await bankContractVisible(tx, p.intake.contractId, branchId, issuer)))
    )
      throw new NotFoundException('خرید در این شرکت پیدا نشد.');
    const paid = await tx.financeSupplierPaymentRevision.findFirst({
      where: { purchaseId: p.id },
      orderBy: { version: 'desc' },
    });
    if (
      !historical &&
      (paid?.status === 'REJECTED' ||
        (await supersededReservationPurchase(tx, p.id)))
    )
      throw new NotFoundException('خرید برگشت داده شده است.');
    total = p.amount;
    remaining =
      paid?.remainingAmount ??
      (paid?.status === 'PAID' ? new Prisma.Decimal(0) : total);
    currency = p.currencyCode;
    brokerId = p.supplierBrokerId;
    organizationId = p.supplierOrganizationId;
    contractId = p.intake.contractId;
    contractNumber =
      (p.intake.snapshot as { contractNumber?: string }).contractNumber ?? null;
  } else if ('costId' in source) {
    const cost = await tx.financeTicketPurchaseCostRevision.findFirst({
      where: { id: source.costId, branchId },
      include: { payments: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (
      !cost ||
      (!historical &&
        (await tx.financeTicketPurchaseCostRevision.count({
          where: { requestId: cost.requestId, version: { gt: cost.version } },
        })))
    )
      throw new NotFoundException('نسخه جاری قیمت خرید پیدا نشد.');
    total = cost.invoiceAmount;
    remaining = cost.payments[0]?.remainingAmount ?? total;
    currency = cost.currencyCode;
  } else {
    const invoice = await purchaseBankInvoice(
      tx,
      source.invoiceId,
      branchId,
      currentFinanceFiscalRequest()?.issuerCompanyId,
    );
    const revision = await tx.financeProcurementInvoiceRevision.findFirst({
      where: { sourceId: source.invoiceId, branchId },
      orderBy: { version: 'desc' },
    });
    if (
      !invoice ||
      !revision ||
      !['APPROVED', 'PARTIALLY_PAID', 'PAID'].includes(revision.status)
    )
      throw new NotFoundException('فاکتور تأییدشده یافت نشد.');
    total = invoice.totalAmount;
    remaining = revision.remainingAmount;
    currency = invoice.currencyCode;
  }
  if (asOf) {
    let paid: Prisma.Decimal | null;
    if ('purchaseId' in source) {
      paid = (
        await tx.financeSupplierPaymentRevision.aggregate({
          where: { ...source, transferAt: { lt: asOf } },
          _sum: { paidAmount: true },
        })
      )._sum.paidAmount;
      if (
        !paid &&
        (await tx.financeSupplierPaymentRevision.count({
          where: {
            ...source,
            status: 'PAID',
            paidAmount: null,
            createdAt: { lt: asOf },
          },
        }))
      )
        paid = total;
    } else if ('costId' in source) {
      paid = (
        await tx.financeTicketPurchasePaymentRevision.aggregate({
          where: { costRevisionId: source.costId, transferAt: { lt: asOf } },
          _sum: { paidAmount: true },
        })
      )._sum.paidAmount;
    } else {
      paid = (
        await tx.financeProcurementInvoiceRevision.aggregate({
          where: { sourceId: source.invoiceId, transferAt: { lt: asOf } },
          _sum: { paidAmount: true },
        })
      )._sum.paidAmount;
    }
    remaining = new Prisma.Decimal(total).sub(paid ?? 0);
  }
  return {
    total,
    remaining,
    currency,
    brokerId,
    organizationId,
    contractId,
    contractNumber,
  };
}
