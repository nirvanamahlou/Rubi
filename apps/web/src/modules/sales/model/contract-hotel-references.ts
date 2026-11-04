import type { MasterDataRecord, SalesContractOutputV1 } from '@nora/contracts';
import type { ContractPrintReferences } from './contract-print';

export async function enrichContractHotels(
  output: SalesContractOutputV1,
  refs: ContractPrintReferences,
  read: (
    resource: 'hotels' | 'cities',
    id: string,
  ) => Promise<MasterDataRecord | undefined>,
) {
  const primary = output.contract.hotelSelection;
  if (!primary) return;
  refs.hotels ??= {};
  await Promise.all(
    [primary, ...(primary.additionalStays ?? [])].map(async (stay) => {
      const hotel = await read('hotels', stay.hotelId).catch(() => undefined);
      const attributes = hotel?.attributes ?? {};
      const cityId =
        typeof attributes.cityId === 'string' ? attributes.cityId : stay.cityId;
      const city = cityId
        ? await read('cities', cityId).catch(() => undefined)
        : undefined;
      const english = (value: unknown) =>
        typeof value === 'string' && value.trim() ? value.trim() : undefined;
      const cityName =
        english(city?.attributes?.englishName) ??
        (city?.name && !/[\u0600-\u06ff]/.test(city.name)
          ? city.name
          : undefined);
      refs.hotels![stay.hotelId] = {
        name: english(attributes.englishName) ?? stay.hotelNameSnapshot,
        ...(cityName ? { city: cityName } : {}),
        ...(attributes.starRating != null
          ? { grade: String(attributes.starRating) }
          : {}),
        ...(english(attributes.website)
          ? { website: english(attributes.website)! }
          : {}),
      };
    }),
  );
}
