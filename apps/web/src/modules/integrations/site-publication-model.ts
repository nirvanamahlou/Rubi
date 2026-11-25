import {
  canUseMasterDataResource,
  type TicketOfferV1,
  type TourDepartureV1,
} from '@nora/contracts';

export const commerceWebsites = [
  { code: 'nss', name: 'نیایش سیر', url: 'https://niyayeshseir.ir' },
  { code: 'jahan-bastan', name: 'جهان باستان', url: 'https://jahanbastan.ir' },
  { code: 'ghestiroo', name: 'قسطی رو', url: 'https://ghestiroo.ir' },
] as const;
export type CommerceWebsiteCode = (typeof commerceWebsites)[number]['code'];

export const websiteDestinations = [
  ...commerceWebsites,
  { code: 'jahan-academy', name: 'جهان آکادمی' },
] as const;

export const publicationViews = [
  { id: 'tours', label: 'تورهای تاریخ‌دار و شناور' },
  { id: 'tickets', label: 'بلیط‌ها' },
  { id: 'hotels', label: 'هتل‌ها' },
  { id: 'countries', label: 'کشورها و پرچم‌ها' },
  { id: 'cities', label: 'شهرها' },
  { id: 'visa-services', label: 'خدمات ویزا' },
] as const;
export type PublicationView = (typeof publicationViews)[number]['id'];
export type ProfilePublicationResource = Exclude<
  PublicationView,
  'tours' | 'tickets'
>;

export function canPublishWebsiteView(
  permissions: readonly string[],
  view: PublicationView,
) {
  const canManageTickets = permissions.includes('ticket_catalog.manage');
  if (view === 'tours' || view === 'tickets') return canManageTickets;
  return (
    permissions.includes('master_data.read') &&
    canUseMasterDataResource(permissions, view) &&
    (view === 'hotels'
      ? canManageTickets
      : permissions.includes('master_data.update'))
  );
}

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
