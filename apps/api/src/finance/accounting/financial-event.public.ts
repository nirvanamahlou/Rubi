import { createHash } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { Prisma } from '@nora/database';

/** Owner modules call this public sink inside their own business transaction.
 * A failed event insert must roll back the source confirmation as well. */
export interface FinancialEventV1 {
  source: 'SALES' | 'TICKET' | 'RESERVATIONS' | 'INVOICE' | 'OPERATIONAL';
  recordId: string;
  requestId: string;
  kind: string;
  branchId: string;
  actorId: string;
  occurredAt: Date;
  amount: string;
  currency: string;
  settlementAccountId?: string | null;
  partyId?: string | null;
  reference?: string | null;
}

export async function recordFinancialEvent(
  tx: Prisma.TransactionClient,
  input: FinancialEventV1,
): Promise<void> {
  const amount = new Prisma.Decimal(input.amount);
  if (!amount.isFinite() || !amount.isPositive() || amount.decimalPlaces() > 4)
    throw new ConflictException('مبلغ رویداد مالی معتبر نیست.');
  const sourceKey = `${input.source}:${input.recordId}`;
  const body = {
    ...input,
    amount: amount.toFixed(4),
    occurredAt: input.occurredAt.toISOString(),
    settlementAccountId: input.settlementAccountId ?? null,
    partyId: input.partyId ?? null,
    reference: input.reference ?? null,
  };
  const fingerprint = createHash('sha256')
    .update(JSON.stringify(Object.fromEntries(Object.entries(body).sort())))
    .digest('hex');
  await tx.financeAccountingEvent.createMany({
    data: [{ ...body, sourceKey, fingerprint }],
    skipDuplicates: true,
  });
  const saved = await tx.financeAccountingEvent.findUniqueOrThrow({
    where: { sourceKey },
  });
  if (saved.fingerprint !== fingerprint)
    throw new ConflictException('رویداد مالی قبلاً با اطلاعات دیگری ثبت شده است.');
}
