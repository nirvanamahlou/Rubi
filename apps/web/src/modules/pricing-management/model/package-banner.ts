import type {
  LoginResponse,
  PackageTourHotelPurchaseBatchV1,
  PackageTourPublicationV1,
  TourDepartureV1,
} from '@nora/contracts';

export type PackageBannerFailure =
  | 'DESTINATION_MISSING'
  | 'TRAVEL_WINDOW_INVALID'
  | 'FLIGHT_MISSING'
  | 'SALE_PRICE_MISSING'
  | 'SALEABLE_ROOM_MISSING';

export interface PackageBannerPrice {
  amount: string;
  currencyCode: string;
}

export interface PackageBannerRoom {
  hotelName: string;
  roomName: string;
  prices: readonly PackageBannerPrice[];
}

export interface PackageBannerViewModel {
  packageId: string;
  packageName: string;
  destination: string;
  route: string;
  startsOn: string;
  endsOn: string;
  flight: string;
  returnFlight: string | null;
  publicationStatus: string;
  priceVersion: number;
  rooms: readonly PackageBannerRoom[];
  displayPrices: readonly PackageBannerPrice[];
}

export interface PackageBannerValidation {
  value: PackageBannerViewModel | null;
  failures: readonly PackageBannerFailure[];
}

export const packageBannerFailureMessages: Record<
  PackageBannerFailure,
  string
> = {
  DESTINATION_MISSING: 'مقصد قابل نمایش برای این پکیج ثبت نشده است.',
  TRAVEL_WINDOW_INVALID: 'بازه تاریخ سفر کامل یا معتبر نیست.',
  FLIGHT_MISSING: 'پرواز قابل عرضه برای این نوبت تور ثبت نشده است.',
  SALE_PRICE_MISSING: 'قیمت فروش معتبر و منتشرشده برای بنر وجود ندارد.',
  SALEABLE_ROOM_MISSING:
    'هیچ نوع اتاق قابل‌فروش با ضریب و قیمت معتبر برای بنر وجود ندارد.',
};

export function canViewPackageBanner(session: LoginResponse) {
  const permissions = session.user.permissions;
  return (
    permissions.includes('package_pricing.read') &&
    permissions.includes('package_pricing.render')
  );
}

export function packageBannerHref(input: {
  packageId: string;
  tourPackageId: string;
  batchId: string;
  publicationId: string;
}) {
  const returnQuery = new URLSearchParams({
    package: input.tourPackageId,
    departure: input.packageId,
    batch: input.batchId,
    publication: input.publicationId,
  });
  const bannerQuery = new URLSearchParams({
    batchId: input.batchId,
    publicationId: input.publicationId,
    returnTo: `/sales/pricing?${returnQuery.toString()}`,
  });
  return `/sales/pricing/packages/${encodeURIComponent(input.packageId)}/banner?${bannerQuery.toString()}`;
}

function positive(value: string | null | undefined) {
  return Boolean(value && Number.isFinite(Number(value)) && Number(value) > 0);
}

function roomFactor(
  batchRow: PackageTourHotelPurchaseBatchV1['rows'][number],
  roomCode: string,
) {
  const legacyRoomNames: Readonly<Record<string, string>> = {
    double: 'دوتخته',
    single: 'یک‌تخته',
    triple: 'سه‌تخته',
    doubleChild: 'دوتخته + کودک',
    doubleTwoChildren: 'دوتخته + دو کودک',
    family: 'خانوادگی',
  };
  const explicit = batchRow.roomRates.find(
    (room) => room.roomTypeId === roomCode,
  );
  return explicit
    ? { factor: explicit.factor, title: explicit.roomTypeName }
    : {
        factor: batchRow.factors[roomCode],
        title: legacyRoomNames[roomCode] ?? roomCode,
      };
}

function salePrices(
  room: PackageTourPublicationV1['roomPrices'][number],
): readonly PackageBannerPrice[] {
  if (room.currencyAmounts?.length)
    return room.currencyAmounts
      .filter((item) => positive(item.sale))
      .map((item) => ({ amount: item.sale!, currencyCode: item.currencyCode }));
  return positive(room.packageSale)
    ? [{ amount: room.packageSale!, currencyCode: room.currencyCode }]
    : [];
}

function displayPrices(rooms: readonly PackageBannerRoom[]) {
  const candidates = new Map<string, PackageBannerPrice>();
  for (const room of rooms)
    for (const price of room.prices) {
      const current = candidates.get(price.currencyCode);
      if (!current || Number(price.amount) < Number(current.amount))
        candidates.set(price.currencyCode, price);
    }
  return [...candidates.values()];
}

function routeLabels(tour: TourDepartureV1) {
  const locations = (tour.package.details?.itinerary ?? [])
    .map((item) => item.location?.trim())
    .filter((item): item is string => Boolean(item));
  const origin =
    locations[0] ??
    tour.package.details?.originAirportCode?.trim() ??
    tour.outbound.originId;
  const destination =
    locations.at(-1) ?? tour.package.name.trim() ?? tour.outbound.destinationId;
  return { origin, destination };
}

export function buildPackageBannerViewModel(input: {
  tour: TourDepartureV1;
  batch: PackageTourHotelPurchaseBatchV1;
  publication: PackageTourPublicationV1;
}): PackageBannerValidation {
  const { tour, batch, publication } = input;
  const failures: PackageBannerFailure[] = [];
  const route = routeLabels(tour);
  if (!tour.package.destinationId.trim() || !route.destination)
    failures.push('DESTINATION_MISSING');
  const starts = Date.parse(tour.startsOn);
  const ends = Date.parse(tour.endsOn);
  if (!Number.isFinite(starts) || !Number.isFinite(ends) || ends < starts)
    failures.push('TRAVEL_WINDOW_INVALID');
  if (
    tour.outbound.status !== 'ACTIVE' ||
    !tour.outbound.carrierName.trim() ||
    !tour.outbound.serviceNumber.trim()
  )
    failures.push('FLIGHT_MISSING');

  const rooms = publication.roomPrices.flatMap((publishedRoom) => {
    const row = batch.rows.find(
      (candidate) => candidate.id === publishedRoom.hotelRateId,
    );
    if (!row) return [];
    const room = roomFactor(row, publishedRoom.roomCode);
    const prices = salePrices(publishedRoom);
    if (!positive(room.factor) || prices.length === 0) return [];
    return [
      {
        hotelName: row.hotelName,
        roomName: room.title,
        prices,
      } satisfies PackageBannerRoom,
    ];
  });
  const prices = displayPrices(rooms);
  if (publication.roomPrices.length === 0 || prices.length === 0)
    failures.push('SALE_PRICE_MISSING');
  if (rooms.length === 0) failures.push('SALEABLE_ROOM_MISSING');
  if (failures.length) return { value: null, failures };

  return {
    failures: [],
    value: {
      packageId: tour.id,
      packageName: tour.package.name,
      destination: route.destination,
      route: `${route.origin} ← ${route.destination}`,
      startsOn: tour.startsOn,
      endsOn: tour.endsOn,
      flight: `${tour.outbound.carrierName} · ${tour.outbound.serviceNumber}`,
      returnFlight: tour.returning
        ? `${tour.returning.carrierName} · ${tour.returning.serviceNumber}`
        : null,
      publicationStatus: 'منتشرشده',
      priceVersion: publication.priceVersion,
      rooms,
      displayPrices: prices,
    },
  };
}
