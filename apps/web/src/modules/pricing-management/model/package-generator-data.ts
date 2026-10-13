import type {
  PackageTourCostGridV1,
  PackageTourHotelPurchaseBatchV1,
  PackageTourPublicationV1,
} from '@nora/contracts';

/** Only published sale amounts cross the frame boundary; never purchase costs or profit. */
export function packageGeneratorData(
  grid: PackageTourCostGridV1,
  batch: PackageTourHotelPurchaseBatchV1,
  publication: PackageTourPublicationV1,
) {
  if (!publication.selectedHotelRateIds?.length)
    throw Error('هتلی برای خروجی انتخاب نشده است.');
  return {
    sourceId: publication.id,
    title: grid.tour.package.name,
    date: grid.tour.startsOn + ' — ' + grid.tour.endsOn,
    duration: String(grid.nights) + ' شب',
    services:
      grid.tour.package.details?.services ||
      (grid.tour.returnOfferId
        ? 'اقامت هتل و پرواز رفت‌وبرگشت'
        : 'اقامت هتل و پرواز رفت'),
    groups: publication.selectedHotelRateIds.map((id) => {
      const row = batch.rows.find((item) => item.id === id);
      if (!row) throw Error('هتل منتشرشده در این بازه موجود نیست.');
      const prices = Object.fromEntries(
        (['single', 'double', 'doubleChild'] as const).map((code) => {
          const price = publication.roomPrices.find(
            (item) => item.hotelRateId === id && item.roomCode === code,
          );
          if (!price?.currencyAmounts?.length)
            throw Error('جدول قیمت منتشرشده کامل نیست.');
          return [
            code === 'doubleChild' ? 'child' : code,
            {
              parts: (price.currencyAmounts.some(
                (part) => !/^0(?:\.0+)?$/.test(part.sale),
              )
                ? price.currencyAmounts.filter(
                    (part) => !/^0(?:\.0+)?$/.test(part.sale),
                  )
                : price.currencyAmounts.slice(0, 1)
              ).map((part) => ({
                amount: part.sale,
                currencyCode: part.currencyCode,
              })),
            },
          ];
        }),
      );
      const types = [
        ...new Set(
          publication.roomPrices
            .filter((price) => price.hotelRateId === id)
            .map((price) => price.roomTypeName)
            .filter(Boolean),
        ),
      ].join(' / ');
      const boards = [
        ...new Set(
          publication.roomPrices
            .filter((price) => price.hotelRateId === id)
            .map((price) => price.board)
            .filter(Boolean),
        ),
      ].join(' / ');
      return {
        hotels: [{ hotel: row.hotelName, room: types, service: boards }],
        prices,
      };
    }),
  };
}
export type PackageGeneratorData = ReturnType<typeof packageGeneratorData>;
