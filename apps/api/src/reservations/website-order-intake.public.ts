import { ConflictException } from '@nestjs/common';
import type { SalesContractDetail } from '@nora/contracts';
import { Prisma } from '@nora/database';
import { createHash } from 'node:crypto';
import { reservationSnapshot } from '../sales/reservation-snapshot.public';

export function hasEarlyWebsiteIntake(site: unknown) {
  return site === 'jahan-bastan' || site === 'ghestiroo';
}

// Called inside the transaction linking a website order to its Sales contract.
// The contract UUID identifies its provisional intake until Sales confirms it.
export async function receiveWebsiteOrder(
  tx: Prisma.TransactionClient,
  contract: SalesContractDetail,
) {
  const [locked] = await tx.$queryRaw<{ status: string; version: number }[]>`
    SELECT status, version FROM sales_contracts
    WHERE id = ${contract.id}::uuid AND branch_id = ${contract.branchId}::uuid FOR UPDATE
  `;
  if (!locked) throw new ConflictException('قرارداد سایت پیدا نشد.');
  if (!['DRAFT', 'PENDING_CONFIRMATION'].includes(locked.status)) return;
  if (
    await tx.reservationIntake.findFirst({
      where: { contractId: contract.id },
      select: { id: true },
    })
  )
    return;
  if (locked.version !== contract.version)
    throw new ConflictException('نسخه قرارداد تغییر کرده است.');
  const snapshot = reservationSnapshot(
    contract,
    contract.id,
    contract.version,
    contract.createdAt,
  );
  await tx.reservationIntake.create({
    data: {
      requestId: contract.id,
      contractId: contract.id,
      contractVersion: contract.version,
      branchId: contract.branchId,
      salesOwnerUserId: contract.ownerUserId,
      snapshot: snapshot as unknown as Prisma.InputJsonValue,
      fingerprint: createHash('sha256')
        .update(JSON.stringify({ branchId: contract.branchId, snapshot }))
        .digest('hex'),
    },
  });
}
