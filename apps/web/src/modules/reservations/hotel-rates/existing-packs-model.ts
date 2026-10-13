import type { PackDetail, PackSummary } from './packs-workspace';

export type PackPage = { data: PackSummary[]; total: number };
type Request = <T>(path: string, init?: RequestInit) => Promise<T>;

/** Never present a partial page as the complete city/date directory. */
export async function loadPackDirectory(branchId: string, request: Request) {
  const packs: PackSummary[] = [];
  const ids = new Set<string>();
  let expected: number | undefined;
  for (let page = 1; page <= 100; page += 1) {
    const result = await request<PackPage>(
      `/packs?branchId=${encodeURIComponent(branchId)}&page=${page}`,
    );
    if (
      !Number.isSafeInteger(result.total) ||
      result.total < 0 ||
      result.total > 5000 ||
      (expected !== undefined && expected !== result.total) ||
      result.data.length > 50 ||
      result.data.some((pack) => pack.branchId !== branchId || ids.has(pack.id))
    )
      throw new Error('فهرست بسته‌ها تغییر کرده یا کامل نیست؛ تازه‌سازی کنید.');
    expected = result.total;
    for (const pack of result.data) {
      if (ids.has(pack.id))
        throw new Error('بستهٔ تکراری؛ فهرست را تازه‌سازی کنید.');
      ids.add(pack.id);
      packs.push(pack);
    }
    if (packs.length === expected) return packs;
    if (!result.data.length || packs.length > expected)
      throw new Error('فهرست بسته‌ها کامل دریافت نشد؛ تازه‌سازی کنید.');
  }
  throw new Error('فهرست بسته‌ها بسیار بزرگ است؛ نمایش کامل ممکن نشد.');
}

export function packCities(packs: readonly PackSummary[]) {
  return [
    ...new Map(
      packs.map((pack) => [
        pack.cityId,
        {
          value: pack.cityId,
          label: pack.cityName,
        },
      ]),
    ).values(),
  ];
}

export function packsForCity(packs: readonly PackSummary[], cityId: string) {
  return packs
    .filter((pack) => pack.cityId === cityId)
    .map((pack) => ({
      value: pack.id,
      label: `${pack.checkIn} تا ${pack.checkOut} (خروج) · ${pack.currency} · نسخه ${pack.version} · ${pack.hotelCount} هتل${pack.tourLabel ? ` · ${pack.tourLabel}` : ''}`,
    }));
}

export function visiblePackHotels(pack: PackDetail, search: string) {
  const normalize = (value: string) =>
    value
      .normalize('NFKC')
      .replace(/ي/g, 'ی')
      .replace(/ك/g, 'ک')
      .replace(/\u200c/g, '')
      .trim()
      .toLocaleLowerCase();
  const key = normalize(search);
  return pack.rows.filter((row) => normalize(row.hotelName).includes(key));
}

/** Search is deliberately not an input: every stored hotel/room is preserved. */
export function packPriceUpdateBody(pack: PackDetail) {
  return JSON.stringify({
    branchId: pack.branchId,
    cityId: pack.cityId,
    checkIn: pack.checkIn,
    checkOut: pack.checkOut,
    currency: pack.currency,
    method: pack.method,
    ...(pack.tourDepartureId ? { tourDepartureId: pack.tourDepartureId } : {}),
    expectedVersion: pack.version,
    rows: pack.rows.map((row) => ({
      hotelId: row.hotelId,
      brokerId: row.brokerId,
      base: row.base,
      currency: row.currency,
      factors: row.factors,
      roomRates: row.roomRates.map((room) => ({
        roomTypeId: room.roomTypeId,
        factor: room.factor,
        maxAdults: room.maxAdults,
        maxChildren: room.maxChildren,
        maxChildren2To6: room.maxChildren2To6 ?? room.maxChildren,
        maxChildren6To12: room.maxChildren6To12 ?? 0,
        maxInfants: room.maxInfants ?? 0,
        ...(room.occupancyRates ? { occupancyRates: room.occupancyRates } : {}),
      })),
    })),
  });
}

export class PackPriceSave {
  private pending: { route: string; body: string; key: string } | null = null;
  private saving = false;
  async save(
    pack: PackDetail,
    request: Request,
    createKey = () => crypto.randomUUID(),
  ) {
    if (this.saving) throw new Error('ثبت قبلی هنوز در حال انجام است.');
    const body = packPriceUpdateBody(pack);
    if (new TextEncoder().encode(body).byteLength > 90000)
      throw new Error('حجم بسته زیاد است؛ هیچ تغییری ثبت نشده است.');
    const route = `/packs/${encodeURIComponent(pack.id)}`;
    if (this.pending?.route !== route || this.pending.body !== body)
      this.pending = { route, body, key: createKey() };
    this.saving = true;
    try {
      const result = await request<{ id: string; version: number }>(route, {
        method: 'PATCH',
        body,
        headers: { 'idempotency-key': this.pending.key },
      });
      if (
        result.id !== pack.id ||
        !Number.isSafeInteger(result.version) ||
        result.version <= pack.version
      )
        throw new Error(
          'پاسخ ثبت معتبر نیست؛ برای بررسی نتیجه دوباره تلاش کنید.',
        );
      this.pending = null;
      return result;
    } finally {
      this.saving = false;
    }
  }
}
