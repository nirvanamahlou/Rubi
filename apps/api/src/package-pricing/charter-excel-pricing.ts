import { BadRequestException } from '@nestjs/common';
import {
  packageRoomCode,
  publishedSaleTotals,
  tourStayPeriods,
  type FloatingTourMoney,
  type FloatingTourSaleRow,
  type PackagePublishedSaleV1,
  type TourDepartureV1,
} from '@nora/contracts';
import { floatingHotelKey } from './floating-tour-import';

export type CharterExcelSale = Omit<PackagePublishedSaleV1, 'publicationId'>;
export type CharterExcelHotel = {
  id: string;
  name: string;
  englishName: string;
  cityId: string;
  roomTypes: { id: string; name: string; code: string }[];
};

export function usesCharterTickets(tour: TourDepartureV1) {
  return (
    !tour.package.details?.isFloating &&
    tour.outbound.supplyType === 'COMPANY' &&
    (!tour.returnOfferId || tour.returning?.supplyType === 'COMPANY')
  );
}

const components = (money: readonly FloatingTourMoney[]) => ({
  prices: money.map(({ currency, amount }) => ({
    currencyCode: currency,
    amount,
  })),
});

/** The workbook is per traveler. The existing Sales catalog matches a whole room. */
export function charterExcelSales(
  rows: readonly FloatingTourSaleRow[],
  tour: TourDepartureV1,
  hotels: readonly CharterExcelHotel[],
): CharterExcelSale[] {
  const periods = tourStayPeriods(tour.package, tour.startsOn, tour.endsOn);
  return rows.flatMap((row) => {
    const fail = (reason: string): never => {
      throw new BadRequestException(
        `Row ${row.sourceRows.join(', ')}: ${reason}`,
      );
    };
    if (row.startsOn !== tour.startsOn || row.endsOn !== tour.endsOn)
      fail('تاریخ اکسل باید با نوبت چارتر انتخاب‌شده یکی باشد.');
    if (row.stays.length !== periods.length)
      fail('اقامت‌های اکسل باید با مسیر نوبت چارتر یکی باشند.');
    const stays = row.stays.map((stay, index) => {
      const period = periods[index]!;
      if (stay.cityId !== period.cityId || stay.nights !== period.nights)
        fail('شهر یا تعداد شب اقامت با نوبت چارتر مطابقت ندارد.');
      const hotel = hotels.find((hotel) => hotel.id === stay.hotelId);
      const key = floatingHotelKey(stay.room);
      const matches =
        hotel?.roomTypes.filter(
          (room) =>
            floatingHotelKey(room.name) === key ||
            floatingHotelKey(room.code) === key,
        ) ?? [];
      if (matches.length !== 1)
        fail(
          `نوع اتاق «${stay.room}» برای هتل «${stay.hotelName}» پیدا نشد یا مبهم است.`,
        );
      return {
        hotelId: stay.hotelId,
        hotelName: stay.hotelName,
        cityId: stay.cityId,
        checkIn: period.checkIn,
        checkOut: period.checkOut,
        roomTypeId: matches[0]!.id,
        roomTypeName: matches[0]!.name,
        board: stay.service,
      };
    });
    const { double, single, extra, childBed, childNoBed, infant } = row.prices;
    if (!double?.length && [extra, childBed, childNoBed, infant].some(Boolean))
      fail('برای قیمت نفر اضافه، کودک یا نوزاد، قیمت دوتخته لازم است.');
    const quote = (
      adults: number,
      money: FloatingTourMoney[][],
      band?: { min: number; maxExclusive: number },
      label?: string,
    ): CharterExcelSale => {
      const roomStays = stays.map(({ board, ...stay }) => ({
        ...stay,
        roomCode: packageRoomCode({
          roomTypeId: stay.roomTypeId,
          adults,
          childAges: band ? [band] : [],
          board: [board, label].filter(Boolean).join(' · ').slice(0, 120),
        }),
      }));
      const [first] = roomStays;
      const roomCode =
        roomStays.length === 1
          ? first!.roomCode
          : JSON.stringify({
              combined: 1,
              identity: first!.roomCode,
              stays: roomStays.map((stay) => [stay.hotelId, stay.roomTypeId]),
            });
      let prices: CharterExcelSale['prices'];
      try {
        prices = publishedSaleTotals(money.map(components));
      } catch (error) {
        return fail(
          error instanceof Error ? error.message : 'قیمت فروش معتبر نیست.',
        );
      }
      return {
        hotelId: first!.hotelId,
        hotelName: first!.hotelName,
        checkIn: first!.checkIn,
        checkOut: first!.checkOut,
        roomCode,
        roomTypeName: [
          stays.map((stay) => stay.roomTypeName).join(' / '),
          label,
        ]
          .filter(Boolean)
          .join(' · '),
        ...(roomStays.length > 1 ? { stays: roomStays } : {}),
        prices,
      };
    };
    return [
      ...(single ? [quote(1, [single])] : []),
      ...(double ? [quote(2, [double, double])] : []),
      ...(double && extra ? [quote(3, [double, double, extra])] : []),
      ...(double && childBed
        ? [
            quote(
              2,
              [double, double, childBed],
              { min: 2, maxExclusive: 12 },
              'کودک با تخت',
            ),
          ]
        : []),
      ...(double && childNoBed
        ? [
            quote(
              2,
              [double, double, childNoBed],
              { min: 2, maxExclusive: 12 },
              'کودک بدون تخت',
            ),
          ]
        : []),
      ...(double && infant
        ? [
            quote(
              2,
              [double, double, infant],
              { min: 0, maxExclusive: 2 },
              'نوزاد',
            ),
          ]
        : []),
    ];
  });
}
