import { ConflictException } from '@nestjs/common';
import type { TicketOfferCreateV1 } from '@nora/contracts';
import { Prisma } from '@nora/database';

const label = (value: string) =>
  value.trim().replace(/\s+/g, ' ').toLowerCase();

/** One dated service/cabin in a branch; capacity and arrival edits do not create new inventory. */
export async function assertUniqueTicketIdentity(
  tx: Prisma.TransactionClient,
  value: TicketOfferCreateV1,
  branchId: string,
  exceptId?: string,
) {
  // Both creation and revision use this transaction lock. A check outside a
  // transaction can let two different request keys publish duplicate stock.
  await tx.$queryRaw(
    Prisma.sql`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${`ticket-flight:${branchId}`}))`,
  );
  const candidates = await tx.ticketPublishedOffer.findMany({
    where: {
      branchId,
      originId: value.originId,
      destinationId: value.destinationId,
      departureAt: new Date(value.departureAt),
      cabinClassCode: value.cabinClassCode,
      ...(exceptId ? { id: { not: exceptId } } : {}),
      audit: { none: { action: 'ticket.offer.archived' } },
    },
    select: { carrierName: true, serviceNumber: true, supplyType: true },
  });
  if (
    candidates.some(
      (row) =>
        label(row.carrierName) === label(value.carrierName) &&
        label(row.serviceNumber) === label(value.serviceNumber) &&
        (row.supplyType ?? 'COMPANY') === (value.supplyType ?? 'COMPANY'),
    )
  )
    throw new ConflictException(
      'این پرواز با همین مسیر، تاریخ و کلاس قبلاً ثبت شده است؛ ظرفیت یا ساعت آن را از ویرایش همان بلیت تغییر دهید.',
    );
}
