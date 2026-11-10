import type { PackageTourCostGridV1, PackagePublishedSaleV1 } from './index';
import {
  buildHotelOnlyPackageCompositions,
  packageRoomCode,
  packageRoomIdentity,
} from './room-compositions';
import { publishedSaleTotals } from './published-sale-quote';
import { tourStayPeriods } from '../travel/tours';

export interface CombinedHotelPackageV1 {
  id: string;
  rooms: { rateId: string; roomCode: string }[];
  /** Optional explicit whole-combination hotel sale, one amount per currency. */
  sales?: undefined | { currencyCode: string; amount: string }[];
}
export interface CombinedHotelStayV1 {
  hotelId: string;
  hotelName: string;
  cityId: string;
  checkIn: string;
  checkOut: string;
  roomTypeId: string;
  roomTypeName: string;
  roomCode: string;
}
export interface CombinedHotelQuoteV1 {
  definition: CombinedHotelPackageV1;
  roomCode: string;
  stays: CombinedHotelStayV1[];
  purchase: { currencyCode: string; amount: string }[];
  prices: { currencyCode: string; amount: string }[];
}
export function combinedHotelOptions(
  grid: PackageTourCostGridV1,
  index: number,
) {
  const stay = tourStayPeriods(
    grid.tour.package,
    grid.tour.startsOn,
    grid.tour.endsOn,
  )[index];
  if (!stay) return [];
  return grid.purchaseBatches
    .filter(
      (b) =>
        b.cityId === stay.cityId &&
        b.branchId === grid.tour.branchId &&
        b.checkIn <= stay.checkIn &&
        (b.method === 'CHECK_IN'
          ? b.checkOut > stay.checkIn
          : b.checkOut >= stay.checkOut),
    )
    .flatMap((b) =>
      b.rows.map((row) => ({
        row,
        stay,
        prices: buildHotelOnlyPackageCompositions({
          row,
          checkIn: stay.checkIn,
          checkOut: stay.checkOut,
          currencyCode: b.currencyCode,
          calculation: {
            adjustment: { direction: 'increase', mode: 'percent', value: '0' },
            adultFlight: { amount: '0', currencyCode: b.currencyCode },
            childFlight: { amount: '0', currencyCode: b.currencyCode },
            businessUplift: { amount: '0', currencyCode: b.currencyCode },
            businessCabin: false,
            commissionPercent: '0',
          },
        }),
      })),
    );
}
export function quoteCombinedHotels(
  grid: PackageTourCostGridV1,
  input: readonly CombinedHotelPackageV1[],
): CombinedHotelQuoteV1[] {
  const periods = tourStayPeriods(
    grid.tour.package,
    grid.tour.startsOn,
    grid.tour.endsOn,
  );
  if (
    !grid.tour.package.details?.isCombined ||
    periods.length < 2 ||
    periods.at(-1)?.checkOut !== grid.tour.endsOn
  )
    throw Error('مقصدها و شب‌های تور ترکیبی را تکمیل کنید.');
  if (
    !Array.isArray(input) ||
    input.length > 50 ||
    input.some(
      (c) => !c || typeof c !== 'object' || typeof c.id !== 'string',
    ) ||
    new Set(input.map((c) => c.id)).size !== input.length
  )
    throw Error('ترکیب‌های هتل معتبر نیستند.');
  const optionsByStay = periods.map(
    (_, i) => new Map(combinedHotelOptions(grid, i).map((o) => [o.row.id, o])),
  );
  return input.map((c: CombinedHotelPackageV1) => {
    if (
      !c ||
      !/^[a-zA-Z0-9-]{1,80}$/.test(c.id) ||
      !Array.isArray(c.rooms) ||
      c.rooms.length !== periods.length
    )
      throw Error('برای هر مقصد یک هتل و تعرفه انتخاب کنید.');
    const selected = c.rooms.map(
      (room: CombinedHotelPackageV1['rooms'][number], i: number) => {
        if (
          !room ||
          typeof room.rateId !== 'string' ||
          typeof room.roomCode !== 'string'
        )
          throw Error('برای هر مقصد یک هتل و تعرفه انتخاب کنید.');
        const option = optionsByStay[i]!.get(room.rateId);
        const price = option?.prices.find((p) => p.roomCode === room.roomCode);
        const identity = packageRoomIdentity(room.roomCode);
        if (!option || !price || !identity)
          throw Error(
            'نرخ اتاق باید برای مقصد و تمام شب‌های همان اقامت موجود باشد.',
          );
        return { option, price, identity };
      },
    );
    const first = selected[0]!.identity;
    const bands = first.childAges.map((a) => ({ ...a }));
    for (const { identity } of selected) {
      if (
        identity.adults !== first.adults ||
        identity.childAges.length !== bands.length
      )
        throw Error('ترکیب نفرات اتاق‌ها در تمام مقصدها باید یکسان باشد.');
      identity.childAges.forEach((a, i) => {
        bands[i]!.min = Math.max(bands[i]!.min, a.min);
        bands[i]!.maxExclusive = Math.min(
          bands[i]!.maxExclusive,
          a.maxExclusive,
        );
      });
    }
    if (bands.some((a) => a.min >= a.maxExclusive))
      throw Error('رده سنی کودک در تعرفه‌های انتخاب‌شده مشترک نیست.');
    const purchase = publishedSaleTotals(
      selected.map(({ price }) => ({
        prices: price.currencyAmounts.map((p) => ({
          currencyCode: p.currencyCode,
          amount: p.sale,
        })),
      })),
    );
    if (
      c.sales !== undefined &&
      (!Array.isArray(c.sales) ||
        c.sales.length !== purchase.length ||
        new Set(c.sales.map((p) => p.currencyCode)).size !== purchase.length ||
        c.sales.some(
          (p) =>
            !purchase.some((v) => v.currencyCode === p.currencyCode) ||
            !/^\d{1,15}(?:\.\d{1,2})?$/.test(p.amount),
        ))
    )
      throw Error('قیمت مشترک و ارز ترکیب را بررسی کنید.');
    const prices =
      c.sales === undefined
        ? purchase
        : publishedSaleTotals([{ prices: c.sales }]);
    const roomCode = JSON.stringify({
      combined: 1,
      id: c.id,
      rooms: c.rooms,
      identity: packageRoomCode({ ...first, childAges: bands }),
    });
    if (roomCode.length > 2000) throw Error('ترکیب اتاق بیش از حد بزرگ است.');
    return {
      definition: c,
      roomCode,
      purchase,
      prices,
      stays: selected.map(({ option, price, identity }) => ({
        hotelId: option.row.hotelId,
        hotelName: option.row.hotelName,
        cityId: option.stay.cityId,
        checkIn: option.stay.checkIn,
        checkOut: option.stay.checkOut,
        roomTypeId: identity.roomTypeId,
        roomTypeName: price.roomTypeName,
        roomCode: price.roomCode,
      })),
    };
  });
}
export function combinedPublishedSale(
  quote: CombinedHotelQuoteV1,
  publicationId: string,
): PackagePublishedSaleV1 {
  const first = quote.stays[0]!;
  return {
    publicationId,
    hotelId: first.hotelId,
    hotelName: quote.stays.map((s) => s.hotelName).join(' / '),
    roomTypeName: quote.stays.map((s) => s.roomTypeName).join(' / '),
    roomCode: quote.roomCode,
    checkIn: first.checkIn,
    checkOut: first.checkOut,
    prices: quote.prices,
    stays: quote.stays,
  };
}
