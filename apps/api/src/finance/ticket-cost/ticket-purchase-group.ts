import { createHash } from 'node:crypto';
import type { TicketCatalogPurchaseV1 } from '@nora/contracts';

export function purchaseFlightGroup(
  request: Pick<
    TicketCatalogPurchaseV1,
    'branchId' | 'supplierDisplaySnapshot'
  >,
  offer?: {
    branchId: string;
    supplyType: string | null;
    departureAt: Date;
    carrierName: string;
    serviceNumber: string;
    originId: string;
    destinationId: string;
    originAirportId: string | null;
    destinationAirportId: string | null;
    cabinClassCode: string;
  },
) {
  if (
    !offer ||
    offer.supplyType !== 'COMPANY' ||
    offer.branchId !== request.branchId ||
    !offer.serviceNumber?.trim() ||
    !offer.carrierName?.trim() ||
    !offer.originId ||
    !offer.destinationId ||
    !offer.cabinClassCode ||
    !request.supplierDisplaySnapshot?.trim() ||
    !Number.isFinite(offer.departureAt?.getTime())
  )
    return undefined;
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(offer.departureAt);
  const weekday = new Date(day + 'T00:00:00Z').getUTCDay();
  const normalized = (v: string) => v.trim().toUpperCase();
  const key = createHash('sha256')
    .update(
      JSON.stringify([
        request.branchId,
        normalized(offer.carrierName),
        normalized(offer.serviceNumber),
        offer.originId,
        offer.destinationId,
        offer.originAirportId,
        offer.destinationAirportId,
        normalized(offer.cabinClassCode),
        normalized(request.supplierDisplaySnapshot),
        weekday,
      ]),
    )
    .digest('hex');
  return {
    key,
    weekday,
    flightNumber: offer.serviceNumber,
    departureDate: day,
  };
}
export function readPurchasePool(reason: string | undefined) {
  const match =
    /^purchase-group:([0-9a-f-]{36}):([0-9a-f]{64}):(\d+):((?:0|[1-9]\d*)(?:\.\d{1,4})?)$/.exec(
      reason ?? '',
    );
  if (!match || !Number.isSafeInteger(Number(match[3])) || Number(match[3]) < 1)
    return undefined;
  return {
    id: match[1]!,
    fingerprint: match[2]!,
    seatCount: Number(match[3]),
    totalCost: match[4]!,
  };
}
