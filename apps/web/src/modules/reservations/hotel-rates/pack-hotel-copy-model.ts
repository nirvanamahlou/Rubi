import type { PackDetail, PackSummary } from './packs-workspace';
import type { Factors } from './model';
import { kinds } from './model';

export function copyableHotelPacks(
  packs: readonly PackSummary[],
  branchId: string,
  cityId: string,
  currentPackId?: string,
) {
  return packs.filter(
    (pack) =>
      pack.branchId === branchId &&
      pack.cityId === cityId &&
      !pack.archivedAt &&
      pack.id !== currentPackId,
  );
}

export async function loadCopiedHotelIds(
  packId: string,
  branchId: string,
  cityId: string,
  availableHotelIds: readonly string[],
  request: <T>(path: string) => Promise<T>,
) {
  const pack = await request<PackDetail>(
    `/packs/${encodeURIComponent(packId)}`,
  );
  if (
    pack.id !== packId ||
    pack.branchId !== branchId ||
    pack.cityId !== cityId ||
    pack.archivedAt
  )
    throw new Error(
      'بسته با شهر و شعبهٔ فعلی مطابقت ندارد؛ فهرست را دوباره باز کنید.',
    );
  const available = new Set(availableHotelIds);
  const source = [...new Set(pack.rows.map((row) => row.hotelId))];
  const hotelIds = source.filter((id) => available.has(id));
  if (!hotelIds.length)
    throw new Error(
      'هیچ‌یک از هتل‌های این بسته در فهرست هتل‌های قابل انتخاب شهر موجود نیست.',
    );
  return { hotelIds, skipped: source.length - hotelIds.length };
}

/** Match manual ticking for newly selected hotels, preserving every existing draft rate. */
export function selectCopiedHotels<
  T extends {
    hotel: { id: string };
    inCityList: boolean;
    selected: boolean;
    base: string;
    factors: Factors;
  },
>(rows: readonly T[], hotelIds: readonly string[]): T[] {
  const ids = new Set(hotelIds);
  return rows.map((row) =>
    row.inCityList && ids.has(row.hotel.id) && !row.selected
      ? {
          ...row,
          selected: true,
          base: '1',
          factors: Object.fromEntries(
            kinds.map((kind) => [kind, '']),
          ) as Factors,
        }
      : row,
  );
}
