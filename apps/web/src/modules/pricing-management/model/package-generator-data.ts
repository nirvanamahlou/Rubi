import { packageRoomIdentity } from '@nora/contracts';
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
  if (publication.roomPrices.some((p) => packageRoomIdentity(p.roomCode)))
    return compositionGeneratorData(grid, batch, publication);
  return {
    sourceId: publication.id,
    title: grid.destinationName ?? grid.tour.package.name,
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

function compositionGeneratorData(
  grid: PackageTourCostGridV1,
  batch: PackageTourHotelPurchaseBatchV1,
  publication: PackageTourPublicationV1,
) {
  const groups = new Map<
    string,
    {
      hotels: { hotel: string; room: string; service: string }[];
      prices: Record<
        string,
        { parts: { amount: string; currencyCode: string }[] }
      >;
    }
  >();
  for (const price of publication.roomPrices) {
    const identity = packageRoomIdentity(price.roomCode);
    if (
      !identity ||
      identity.childAges.length ||
      ![1, 2].includes(identity.adults)
    )
      continue;
    const row = batch.rows.find((r) => r.id === price.hotelRateId);
    if (!row || !publication.selectedHotelRateIds?.includes(row.id)) continue;
    const key = JSON.stringify([row.id, identity.roomTypeId, identity.board]);
    let group = groups.get(key);
    if (!group) {
      group = {
        hotels: [
          {
            hotel: row.hotelName,
            room: price.roomTypeName ?? '',
            service: identity.board,
          },
        ],
        prices: {},
      };
      groups.set(key, group);
    }
    group.prices[identity.adults === 1 ? 'single' : 'double'] = {
      parts: (price.currencyAmounts ?? [])
        .filter((p) => !/^0(?:\.0+)?$/.test(p.sale))
        .map((p) => {
          const precision = p.currencyCode === 'IRR' ? 0 : 2;
          const [whole, fraction = ''] = p.sale.split('.');
          const units =
            BigInt(whole!) * 10n ** BigInt(precision) +
            BigInt(fraction.padEnd(precision, '0').slice(0, precision) || '0');
          const n =
            (units + BigInt(identity.adults) - 1n) / BigInt(identity.adults);
          const scale = 10n ** BigInt(precision);
          return {
            currencyCode: p.currencyCode,
            amount:
              String(n / scale) +
              (precision
                ? '.' + String(n % scale).padStart(precision, '0')
                : ''),
          };
        }),
    };
  }
  if (!groups.size)
    throw Error('قیمت فروش معتبر و منتشرشده برای بنر وجود ندارد.');
  return {
    version: 2 as const,
    template: packageDestinationTemplate(
      grid.destinationName ?? grid.tour.package.name,
    ),
    notes: [
      grid.tour.package.details?.description,
      grid.tour.package.details?.requiredDocuments,
      grid.tour.package.details?.refundRules,
      grid.tour.package.details?.installmentTerms,
    ]
      .filter(Boolean)
      .join('\n'),
    sourceId: publication.id,
    title: grid.destinationName ?? grid.tour.package.name,
    date: grid.tour.startsOn + ' — ' + grid.tour.endsOn,
    duration: String(grid.nights) + ' شب',
    services: grid.tour.package.details?.services ?? '',
    groups: [...groups.values()],
  };
}

function packageDestinationTemplate(destination: string) {
  if (/استانبول|istanbul/i.test(destination)) return 'istanbul-4';
  if (/آنتالیا|انتالیا|antalya/i.test(destination)) return 'antalya';
  if (/کوش|kusadasi|kuşadası/i.test(destination)) return 'kus';
  if (/بدروم|bodrum/i.test(destination)) return 'bodrum';
  if (/کوالا|kuala/i.test(destination)) return 'malaysia-kuala';
  if (/پنانگ|penang/i.test(destination)) return 'malaysia-penang';
  if (/لنگکاوی|langkawi/i.test(destination)) return 'malaysia-langkawi';
  if (/سنگاپور|singapore/i.test(destination)) return 'malaysia-singapore';
  if (/پاتایا|pattaya/i.test(destination)) return 'thailand-pattaya';
  if (/بانکوک|bangkok/i.test(destination)) return 'thailand-bangkok-phuket';
  if (/پوکت|phuket/i.test(destination)) return 'thailand-phuket';
  return '';
}
