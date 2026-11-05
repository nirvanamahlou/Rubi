import { ConflictException } from '@nestjs/common';
import { CONTRACT_TOTAL_PURCHASE_KEY } from '@nora/contracts';
import { Prisma } from '@nora/database';
/** Serialize both entry points across intake revisions; never count total plus components. */
export async function assertFloatingPurchaseMode(
  tx: Prisma.TransactionClient,
  contractId: string,
  branchId: string,
  total: boolean,
) {
  await tx.$queryRaw(
    Prisma.sql`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${'purchase-mode:' + contractId},0))`,
  );
  const opposite = await tx.reservationServicePurchase.findFirst({
    where: {
      intake: { contractId, branchId },
      serviceClientKey: total
        ? { not: CONTRACT_TOTAL_PURCHASE_KEY }
        : CONTRACT_TOTAL_PURCHASE_KEY,
    },
    select: { id: true },
  });
  const legacy = total
    ? await tx.reservationHotelPurchase.findFirst({
        where: { intake: { contractId, branchId } },
        select: { id: true },
      })
    : null;
  if (opposite || legacy)
    throw new ConflictException(
      'برای این قرارداد خرید ثبت شده است؛ قیمت کل و خرید تفکیکی را هم‌زمان ثبت نکنید.',
    );
}
