import { ConflictException } from '@nestjs/common';
import type { MasterDataResource } from '@rubi/contracts';
import type { Prisma } from '@rubi/database';

function errorRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

export function isMasterDataDependencyError(error: unknown): boolean {
  const failure = errorRecord(error);
  if (failure?.code === 'P2003') return true;
  if (failure?.code !== 'P2039') return false;
  const adapter = errorRecord(errorRecord(failure.meta)?.driverAdapterError);
  const cause = errorRecord(adapter?.cause);
  // PostgreSQL RESTRICT can reach Prisma's driver adapter as SQLSTATE 23001
  // rather than the standard P2003 FK error. Do not mask other adapter failures.
  return (
    cause?.kind === 'postgres' &&
    (cause.originalCode === '23001' || cause.originalCode === '23503')
  );
}

export function assertMasterDataDeletionAllowed(
  resource: MasterDataResource,
  row: Record<string, unknown>,
) {
  if (resource === 'exchange-rates' && row.status !== 'DRAFT')
    throw new ConflictException({
      code: 'CURRENCY_RATE_IMMUTABLE',
      message:
        'نرخ تأییدشده، ردشده یا منقضی بخشی از تاریخچه است و حذف نمی‌شود.',
    });
}

// Only aggregate-owned association rows may be removed. Referenced entities and
// references owned by consumers are protected by the existing restrictive FKs.
export async function removeOwnedMasterDataLinks(
  tx: Prisma.TransactionClient,
  resource: MasterDataResource,
  id: string,
) {
  switch (resource) {
    case 'organizations':
      await tx.masterOrganizationRole.deleteMany({
        where: { organizationId: id },
      });
      break;
    case 'suppliers':
      await tx.masterSupplierService.deleteMany({ where: { supplierId: id } });
      break;
    case 'brokers':
      await tx.masterBrokerService.deleteMany({ where: { brokerId: id } });
      break;
    case 'hotels':
      await tx.masterHotelFacility.deleteMany({ where: { hotelId: id } });
      await tx.masterHotelMealService.deleteMany({ where: { hotelId: id } });
      await tx.masterHotelRoomType.deleteMany({ where: { hotelId: id } });
      break;
    case 'composite-hotels':
      await tx.masterCompositeHotelMember.deleteMany({
        where: { compositeHotelId: id },
      });
      break;
    case 'insurance-plans':
      await tx.masterInsurancePlanCoverage.deleteMany({
        where: { planId: id },
      });
      break;
    case 'bus-types':
      await tx.masterBusTypeFacility.deleteMany({ where: { busTypeId: id } });
      break;
    case 'train-types':
      await tx.masterTrainTypeFacility.deleteMany({ where: { trainTypeId: id } });
      break;
  }
}
