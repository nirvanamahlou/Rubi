import type { TicketOfferV1, TourDepartureV1 } from '@nora/contracts';
export const websiteDestinations = [
  { code: 'nss', name: 'نیایش سیر' },
  { code: 'jahan-bastan', name: 'جهان باستان' },
  { code: 'ghestiroo', name: 'قسطی رو' },
  { code: 'jahan-academy', name: 'جهان آکادمی' },
] as const;
export function publishableTours(rows: TourDepartureV1[], branchId: string) {
  return rows.filter(
    (row) =>
      row.branchId === branchId &&
      row.package.publicationStatus !== 'DRAFT' &&
      row.isDeleted !== true,
  );
}
export function publishableTickets(rows: TicketOfferV1[], branchId: string) {
  return rows.filter(
    (row) =>
      row.branchId === branchId &&
      row.status === 'ACTIVE' &&
      (Number(
        (row.baseStandaloneSalePrice ?? row.standaloneSalePrice)?.amount,
      ) > 0 ||
        (row.baseRoundTripSalePrices ?? row.roundTripSalePrices)?.some(
          (price) => Number(price.amount) > 0,
        )),
  );
}
