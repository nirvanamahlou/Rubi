import { ConflictException, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { Prisma, type SalesContractStatus } from '@nora/database';
import { planPartyReceipt } from '@nora/contracts';
import type {
  FinancePartyBalanceV1,
  FinancePartyReceiptCommandV1,
  FinancePartyReceiptResultV1,
} from '@nora/contracts';
import { calculateSalesBalances } from './sales.domain';
import {
  netSalesPayments,
  recalculateSalesSettlement,
} from './sales-financial-settlement';

const include = {
  priceComponents: true,
  payments: { include: { refunds: true, allocations: true } },
  receiptAllocations: true,
} satisfies Prisma.SalesContractInclude;
const active = {
  notIn: [
    'CANCELLED',
    'DRAFT',
    'PENDING_CONFIRMATION',
  ] as SalesContractStatus[],
};
const Money = Prisma.Decimal.clone({ precision: 40 });

/** Caller has authorized branch access; serialize with all existing Sales editors. */
export async function lockPartyContracts(
  tx: Prisma.TransactionClient,
  branchId: string,
  payerId: string,
) {
  await tx.$queryRaw`SELECT id FROM sales_contracts WHERE branch_id=${branchId}::uuid AND payer_customer_id=${payerId}::uuid ORDER BY id FOR UPDATE`;
}

/** Sales-owned canonical payer lookup. Names are search hints, never account identity. */
export async function contractParties(
  tx: Prisma.TransactionClient,
  branchIds: readonly string[],
  search: string,
) {
  const rows = await tx.salesContract.findMany({
    where: {
      branchId: { in: [...branchIds] },
      status: active,
      OR: [
        { customerNameSnapshot: { contains: search, mode: 'insensitive' } },
        { contractNumber: { contains: search } },
      ],
    },
    select: {
      payerCustomerId: true,
      branchId: true,
      customerNameSnapshot: true,
    },
    distinct: ['payerCustomerId', 'branchId'],
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    take: 50,
  });
  return rows.map((r) => ({
    payerId: r.payerCustomerId,
    branchId: r.branchId,
    name: r.customerNameSnapshot,
  }));
}

/** Branch authorization belongs to Finance; only this Sales adapter reads contract tables. */
export async function partyContractBalance(
  tx: Prisma.TransactionClient,
  branchId: string,
  payerId: string,
): Promise<FinancePartyBalanceV1> {
  const rows = await tx.salesContract.findMany({
    where: { branchId, payerCustomerId: payerId, status: active },
    include,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: 5001,
  });
  if (!rows.length)
    throw new NotFoundException(
      'قراردادی برای این طرف حساب در شعبه انتخاب‌شده یافت نشد.',
    );
  if (rows.length > 5000)
    throw new ConflictException(
      'تعداد قراردادها بیش از حد پردازش است؛ با پشتیبانی هماهنگ کنید.',
    );
  const totals = new Map<
    string,
    {
      total: Prisma.Decimal;
      confirmedPaid: Prisma.Decimal;
      outstanding: Prisma.Decimal;
    }
  >();
  const contracts = rows.map((row) => {
    const balances = calculateSalesBalances(
      row.priceComponents.map((c) => ({ ...c, amount: c.amount.toString() })),
      netSalesPayments(row.payments, row.receiptAllocations),
    );
    for (const b of balances) {
      const sum = totals.get(b.currencyCode) ?? {
        total: new Money(0),
        confirmedPaid: new Money(0),
        outstanding: new Money(0),
      };
      sum.total = sum.total.add(b.amount);
      sum.confirmedPaid = sum.confirmedPaid.add(b.confirmedPaid);
      sum.outstanding = sum.outstanding.add(b.outstanding);
      totals.set(b.currencyCode, sum);
    }
    return {
      id: row.id,
      number: row.contractNumber,
      createdAt: row.createdAt.toISOString(),
      balances: balances.map((b) => ({
        currencyCode: b.currencyCode,
        outstanding: b.outstanding,
        pendingFinance: b.pendingFinance,
      })),
    };
  });
  const revision = createHash('sha256')
    .update(
      JSON.stringify(
        rows.map((r, i) => [r.id, r.version, contracts[i]!.balances]),
      ),
    )
    .digest('hex');
  return {
    party: { payerId, branchId, name: rows.at(-1)!.customerNameSnapshot },
    revision,
    contracts,
    totals: [...totals].map(([currencyCode, b]) => ({
      currencyCode,
      total: b.total.toString(),
      confirmedPaid: b.confirmedPaid.toString(),
      outstanding: b.outstanding.toString(),
    })),
  };
}

/** Pure decimal FIFO plan; an excess remains explicit credit on the newest contract. */
export const partyReceiptPlan = planPartyReceipt;

export async function partyReceiptReplay(
  tx: Prisma.TransactionClient,
  input: FinancePartyReceiptCommandV1,
  fingerprint: string,
): Promise<FinancePartyReceiptResultV1 | null> {
  const rows = await tx.salesContractPaymentEntry.findMany({
    where: { idempotencyKey: `party-receipt:${input.operationId}` },
    include: {
      contract: {
        select: { contractNumber: true, payerCustomerId: true, branchId: true },
      },
    },
    orderBy: [{ contract: { createdAt: 'asc' } }, { contractId: 'asc' }],
  });
  if (!rows.length) return null;
  if (
    rows.some(
      (r) =>
        r.requestFingerprint !== fingerprint ||
        r.contract.branchId !== input.branchId ||
        r.contract.payerCustomerId !== input.payerId,
    )
  )
    throw new ConflictException(
      'شناسه دریافت قبلاً با اطلاعات دیگری استفاده شده است.',
    );
  return {
    operationId: input.operationId,
    allocations: rows.map((r) => ({
      contractId: r.contractId,
      contractNumber: r.contract.contractNumber,
      amount: r.amount.toString(),
      paymentId: r.id,
    })),
  };
}

/** Caller holds the payer lock and validated account; callback uses Finance's public event contract. */
export async function persistPartyReceipt(
  tx: Prisma.TransactionClient,
  input: FinancePartyReceiptCommandV1,
  fingerprint: string,
  actorId: string,
  context: FinancePartyBalanceV1,
  accountTitle: string,
  onReceipt: (part: {
    paymentId: string;
    contractId: string;
    createdAt: Date;
    amount: string;
  }) => Promise<void>,
  method: 'CASH' | 'BANK_TRANSFER' = 'BANK_TRANSFER',
) {
  const allocations = [];
  for (const part of partyReceiptPlan(
    context,
    input.currencyCode,
    input.amount,
  )) {
    const now = new Date(),
      paymentId = randomUUID();
    await tx.salesContractPaymentEntry.create({
      data: {
        id: paymentId,
        contractId: part.contractId,
        amount: part.amount,
        currencyCode: input.currencyCode,
        dueAt: now,
        method,
        status: 'FINANCE_CONFIRMED',
        description: `دریافت تجمیعی ${input.operationId}`,
        paymentReference: input.reference || null,
        destinationAccountId: input.accountId,
        destinationAccountTitle: accountTitle,
        financeReceiptAccountId: input.accountId,
        financePaymentReference: `PARTY:${input.operationId}`,
        financeConfirmedByRef: input.operationId,
        financeConfirmedAt: now,
        financeReviewedByUserId: actorId,
        financeReviewedAt: now,
        idempotencyKey: `party-receipt:${input.operationId}`,
        requestFingerprint: fingerprint,
        createdByUserId: actorId,
      },
    });
    await recalculateSalesSettlement(tx, part.contractId, actorId);
    await tx.salesContractAuditEvent.create({
      data: {
        contractId: part.contractId,
        actorUserId: actorId,
        actorBranchId: input.branchId,
        action: 'sales.payment.party_receipt_confirmed',
        outcome: 'SUCCESS',
        afterSnapshot: {
          ...part,
          paymentId,
          operationId: input.operationId,
          accountId: input.accountId,
          currencyCode: input.currencyCode,
        },
      },
    });
    await onReceipt({
      paymentId,
      contractId: part.contractId,
      amount: part.amount,
      createdAt: new Date(
        context.contracts.find((c) => c.id === part.contractId)!.createdAt,
      ),
    });
    allocations.push({ ...part, paymentId });
  }
  return { operationId: input.operationId, allocations };
}
