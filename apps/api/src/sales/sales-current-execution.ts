import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { SalesReservationRequestV1 } from '@nora/contracts';
import type { Prisma } from '@nora/database';
import { salesDetailInclude } from './sales.repository';
import { presentSalesContract } from './sales.service';

export async function currentSalesExecution(
  tx: Pick<Prisma.TransactionClient, 'salesContract'>,
  snapshot: SalesReservationRequestV1,
  branchIds: readonly string[],
): Promise<SalesReservationRequestV1> {
  const row = await tx.salesContract.findFirst({
    where: { id: snapshot.contractId, branchId: { in: [...branchIds] } },
    include: salesDetailInclude,
  });
  if (!row) throw new ForbiddenException('قرارداد در دسترس نیست.');
  if (row.status === 'CANCELLED')
    throw new ConflictException('قرارداد ابطال شده است.');
  if (['DRAFT', 'PENDING_CONFIRMATION'].includes(row.status))
    throw new ConflictException('قرارداد برای اصلاح عملیاتی در دسترس نیست.');
  const detail = presentSalesContract(row);
  return {
    ...snapshot,
    contractVersion: detail.version,
    contractNumber: detail.contractNumber,
    customerId: detail.customerId,
    passengerIds: detail.passengersDetail.map((p) => p.customerId),
    passengerAssignments: detail.passengersDetail.map((p) => ({
      customerId: p.customerId,
      displayNameSnapshot: p.displayNameSnapshot,
      ageCategory: p.ageCategory,
      ...(p.childAgeBand ? { childAgeBand: p.childAgeBand } : {}),
      serviceClientKeys: p.serviceClientKeys,
    })),
    serviceSelections: detail.servicesDetail,
    ticketSelections: detail.ticketSelections ?? [],
    selectedTicketOfferIds: (detail.ticketSelections ?? []).map(
      (t) => t.offerId,
    ),
    hotelSelection: detail.hotelSelection ?? null,
  };
}
