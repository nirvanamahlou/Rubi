import { moneyUnits, moneyDecimal, type TicketOfferV1 } from '@nora/contracts';
export type TicketPriceRow = {
  id: string;
  offer: TicketOfferV1;
  returning?: TicketOfferV1 | undefined;
  returnOfferId: string | null;
  base?: { amount: string; currencyCode: string; revision: number } | undefined;
};
export function ticketPriceRows(
  offers: readonly TicketOfferV1[],
): TicketPriceRow[] {
  return offers.flatMap((offer) => [
    {
      id: offer.id,
      offer,
      returnOfferId: null,
      base:
        offer.baseStandaloneSalePrice ?? offer.standaloneSalePrice ?? undefined,
    },
    ...(offer.roundTripSalePrices ?? []).map((price) => ({
      id: offer.id + ':' + price.returnOfferId,
      offer,
      returnOfferId: price.returnOfferId,
      returning: offers.find((o) => o.id === price.returnOfferId),
      base: {
        amount: price.baseAmount ?? price.amount,
        currencyCode: price.currencyCode,
        revision: price.revision,
      },
    })),
  ]);
}
export function normalizePercent(value: string) {
  return value
    .replace(/[۰-۹]/g, (c) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c)))
    .replace(/[٠-٩]/g, (c) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)))
    .replace(/٫/g, '.')
    .trim();
}
export function validPercent(value: string) {
  return (
    /^(?:0|[1-9]\d?|100)(?:\.\d{1,4})?$/.test(value) &&
    moneyUnits(value) <= 1000000n
  );
}
export function netTicketPrice(
  amount: string,
  percent: string,
): string | undefined {
  if (!validPercent(percent)) return undefined;
  return moneyDecimal(
    (moneyUnits(amount) * (1000000n - moneyUnits(percent)) + 500000n) /
      1000000n,
  );
}
export function filterTicketRows(
  rows: readonly TicketPriceRow[],
  filters: {
    originId: string;
    destinationId: string;
    tripType: string;
    query: string;
    from: string;
    to: string;
  },
  label: (offer: TicketOfferV1) => string,
) {
  return rows.filter((row) => {
    if (filters.originId && row.offer.originId !== filters.originId)
      return false;
    if (
      filters.destinationId &&
      row.offer.destinationId !== filters.destinationId
    )
      return false;
    if (
      (filters.tripType === 'ONEWAY' && row.returnOfferId) ||
      (filters.tripType === 'ROUNDTRIP' && !row.returnOfferId)
    )
      return false;
    const day = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(row.offer.departureAt));
    if (
      (filters.from && day < filters.from) ||
      (filters.to && day > filters.to)
    )
      return false;
    return [label(row.offer), row.returning ? label(row.returning) : '']
      .join(' ')
      .toLocaleLowerCase()
      .includes(filters.query.trim().toLocaleLowerCase());
  });
}
