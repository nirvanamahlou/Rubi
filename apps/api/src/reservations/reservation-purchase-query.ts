import { BadRequestException } from '@nestjs/common';
import type { TicketPurchaseInboxItemV1 } from '@nora/contracts';

export type PurchaseQueryInput = Partial<
  Record<
    | 'page'
    | 'kind'
    | 'contractNumber'
    | 'status'
    | 'dateBy'
    | 'from'
    | 'to'
    | 'direction',
    string | undefined
  >
>;
export function parsePurchaseQuery(input: PurchaseQueryInput) {
  if (
    Object.values(input).some((v) => v !== undefined && typeof v !== 'string')
  )
    throw new BadRequestException('فیلتر کارتابل خرید معتبر نیست.');
  const result = {
    page: input.page === undefined ? 1 : Number(input.page),
    kind: input.kind ?? 'ALL',
    contractNumber: input.contractNumber?.trim() ?? '',
    status: input.status ?? 'ALL',
    dateBy: input.dateBy ?? 'ENTRY',
    from: input.from ?? '',
    to: input.to ?? '',
    direction: input.direction ?? 'DESC',
  };
  const validDay = (s: string) =>
    !s ||
    (/^\d{4}-\d{2}-\d{2}$/.test(s) &&
      Number.isFinite(Date.parse(s)) &&
      new Date(s).toISOString().slice(0, 10) === s);
  if (
    !Number.isSafeInteger(result.page) ||
    result.page < 1 ||
    result.page > 1000000 ||
    !['ALL', 'HOTEL', 'FLIGHT', 'TRANSFER', 'INSURANCE'].includes(
      result.kind,
    ) ||
    !['ALL', 'REGISTERED', 'UNREGISTERED'].includes(result.status) ||
    !['ENTRY', 'DEPARTURE', 'CHECK_IN', 'PURCHASE'].includes(result.dateBy) ||
    !['ASC', 'DESC'].includes(result.direction) ||
    result.contractNumber.length > 100 ||
    !validDay(result.from) ||
    !validDay(result.to) ||
    (result.from && result.to && result.from > result.to)
  )
    throw new BadRequestException('فیلتر کارتابل خرید معتبر نیست.');
  return result;
}
/** Only an authorized public Finance/Procurement projection crosses the boundary. */
export function purchaseFlightFacts(
  items: readonly TicketPurchaseInboxItemV1[],
) {
  return items
    .filter((i) => i.request.status !== 'CANCELLED')
    .map((i) => ({
      id: i.request.id,
      branchId: i.request.branchId,
      offerId: i.request.offerId,
      referenceId: i.request.catalogProductReference,
      registered: !!i.cost,
      entryAt: i.request.createdAt,
      departureAt: i.request.serviceDate,
      purchasedAt: i.cost?.createdAt ?? null,
    }));
}
export type PurchaseFlightFacts = ReturnType<typeof purchaseFlightFacts>;
export interface PurchaseServiceRow {
  id: string;
  clientKey: string;
  status: 'REGISTERED' | 'UNREGISTERED' | 'UNKNOWN';
  entryAt: string;
  departureAt: string | null;
  checkInAt: string | null;
  purchasedAt: string | null;
  sortAt: string | null;
}
