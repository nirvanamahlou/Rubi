import { reservationStayKey, type AuthenticatedActor } from '@nora/contracts';
import type { Prisma } from '@nora/database';
import { boundedSource } from '../common/report-source';
import { fullySettledStatuses } from '../finance/document-delivery/financial-release.public';
import { floatingSalesServiceWhere } from './sales-supply-filter';

export async function readSettledHotelContracts(
  tx: Pick<Prisma.TransactionClient, 'salesContract'>,
  branchIds: AuthenticatedActor['branchIds'],
  companyId: string | null,
) {
  const columns = {
    hotelId: true,
    hotelNameSnapshot: true,
    checkInDate: true,
    checkOutDate: true,
  } as const;
  const rows = boundedSource(
    await tx.salesContract.findMany({
      where: {
        status: { notIn: ['CANCELLED', 'DRAFT', 'PENDING_CONFIRMATION'] },
        settlementStatus: { in: [...fullySettledStatuses] },
        branchId: { in: branchIds },
        ...(companyId ? { legalEntityId: companyId } : {}),
        hiddenAt: null,
        financeHiddenAt: null,
        reservationHiddenAt: null,
        hotelSelection: { isNot: null },
      },
      select: {
        id: true,
        branchId: true,
        contractNumber: true,
        _count: { select: { services: { where: floatingSalesServiceWhere } } },
        hotelSelection: {
          select: {
            ...columns,
            service: { select: { clientKey: true } },
            additionalStays: { orderBy: { ordinal: 'asc' }, select: columns },
          },
        },
      },
      orderBy: [{ contractNumber: 'asc' }, { id: 'asc' }],
      take: 10001,
    }),
  );
  return rows.flatMap(
    ({ id, branchId, contractNumber, _count, hotelSelection: primary }) =>
      primary
        ? [
            {
              contractId: id,
              branchId,
              contractNumber,
              floating: _count.services > 0,
              stays: [primary, ...primary.additionalStays].map(
                (hotel, index) => ({
                  key: reservationStayKey(
                    primary.service.clientKey,
                    index + 1,
                    hotel.hotelId,
                  ),
                  hotelId: hotel.hotelId,
                  hotelName: hotel.hotelNameSnapshot,
                  checkInDate: hotel.checkInDate.toISOString().slice(0, 10),
                  checkOutDate: hotel.checkOutDate.toISOString().slice(0, 10),
                }),
              ),
            },
          ]
        : [],
  );
}
