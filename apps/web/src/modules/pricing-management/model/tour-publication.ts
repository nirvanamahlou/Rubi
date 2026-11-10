import {
  tourPriceFields,
  type PackageTourDraftV1,
  type PackageTourDraftSaveV1,
} from '@nora/contracts';

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, stable(item)]),
    );
  if (typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value))
    return value.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
  return value;
}
const sorted = (rows: readonly unknown[]) =>
  rows
    .map(stable)
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
function comparable(
  value: Pick<
    PackageTourDraftSaveV1,
    | 'hotelCombinations'
    | 'convertToRial'
    | 'selectedRoomKeys'
    | 'roomSaleOverrides'
    | 'selectedHotelRateIds'
    | 'priceFields'
    | 'familyAdults'
    | 'familyChildren'
    | 'adjustments'
  >,
) {
  return JSON.stringify(
    stable({
      combinations: value.hotelCombinations ?? [],
      convertToRial: value.convertToRial ?? false,
      rooms: [...(value.selectedRoomKeys ?? [])].sort(),
      sales: sorted(value.roomSaleOverrides ?? []),
      hotels: [...(value.selectedHotelRateIds ?? [])].sort(),
      prices: sorted(tourPriceFields(value)),
      adults: value.familyAdults ?? 2,
      children: value.familyChildren ?? 0,
      adjustments: sorted(value.adjustments),
    }),
  );
}
export function tourDraftChanged(
  draft: PackageTourDraftV1 | null,
  current: Parameters<typeof comparable>[0],
) {
  return !draft || comparable(draft) !== comparable(current);
}
export function tourPublicationBlockers(input: {
  canAccess: boolean;
  saving: boolean;
  hasDraft: boolean;
  unsaved: boolean;
  invalidSale: boolean;
  hasHotels: boolean;
  capacity: number;
  validReason: boolean;
}) {
  const reasons: string[] = [];
  if (!input.canAccess) reasons.push('دسترسی مدیریت قیمت در دسترس نیست.');
  if (!input.hasDraft) reasons.push('ابتدا پیش‌نویس قیمت را ذخیره کنید.');
  else if (input.unsaved)
    reasons.push('تغییرات قیمت را پیش از انتشار ذخیره کنید.');
  if (input.invalidSale || !input.hasHotels)
    reasons.push('هتل، ترکیب اتاق و قیمت‌های انتخاب‌شده را تکمیل کنید.');
  if (input.capacity < 1) reasons.push('ظرفیت تور برای انتشار قیمت کافی نیست.');
  if (!input.validReason) reasons.push('دلیل انتشار نسخهٔ قیمت معتبر نیست.');
  return { reasons, disabled: input.saving || reasons.length > 0 };
}
