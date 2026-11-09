import { ConflictException } from '@nestjs/common';
import { Prisma } from '@nora/database';
import type { SalesTicketSelectionInput } from '@nora/contracts';

/** Reacquire the original quantities, never increase the published seat block. */
export async function restoreContractCapacity(
  tx: Prisma.TransactionClient,
  contractId: string,
  branchId: string,
  selections: readonly SalesTicketSelectionInput[],
) {
  if (!selections.length) return;
  if (
    new Set(selections.map((s) => s.direction)).size !== selections.length ||
    new Set(selections.map((s) => s.offerId)).size !== selections.length
  )
    throw new ConflictException(
      'بلیط انتخاب‌شده تغییر کرده یا قابل رزرو نیست.',
    );
  const ids = [...new Set(selections.map((s) => s.offerId))].sort();
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "TicketPublishedOffer" WHERE "id" IN (${Prisma.join(ids)}) ORDER BY "id" FOR UPDATE`,
  );
  // Read allocations only after the inventory lock, including concurrent reopen/sale.
  const rows = await tx.ticketOfferCapacityAllocation.findMany({
    where: { contractId },
  });
  const current = selections.map((s) =>
    rows.find((r) => r.offerId === s.offerId && r.direction === s.direction),
  );
  if (
    current.some(
      (r) =>
        !r ||
        !['ACTIVE', 'RELEASED'].includes(r.status) ||
        !Number.isSafeInteger(r.quantity) ||
        r.quantity < 1,
    )
  )
    throw new ConflictException(
      'بلیط انتخاب‌شده تغییر کرده یا قابل رزرو نیست.',
    );
  const allocations = current.filter((r) => r !== undefined);
  const restoringIds = new Set(allocations.map((r) => r.id));
  const offers = await tx.ticketPublishedOffer.findMany({
    where: { id: { in: ids }, branchId },
    include: {
      capacityAllocations: { where: { status: 'ACTIVE' } },
      capacityHolds: {
        where: { status: 'ACTIVE', expiresAt: { gt: new Date() } },
      },
    },
  });
  for (const allocation of allocations) {
    const offer = offers.find((o) => o.id === allocation.offerId);
    const used = offer
      ? offer.capacityAllocations
          .filter((a) => !restoringIds.has(a.id))
          .reduce((n, a) => n + a.quantity, 0) +
        offer.capacityHolds.reduce((n, h) => n + h.quantity, 0)
      : 0;
    if (
      !offer ||
      offer.status !== 'ACTIVE' ||
      offer.totalCapacity - used < allocation.quantity
    )
      throw new ConflictException(
        'ظرفیت باقی‌مانده برای این تعداد نفر کافی نیست.',
      );
  }
  await tx.ticketOfferCapacityAllocation.updateMany({
    where: {
      id: { in: allocations.map((r) => r.id) },
      contractId,
      status: 'RELEASED',
    },
    data: { status: 'ACTIVE', releasedAt: null },
  });
}
